const CODEC = "vp09.00.10.08";
const KEY = 1;
const DELTA = 2;
const HEADER = 9;
const QUEUE_LIMIT = 2;
const FEED_BACKLOG = 8 * 1024 * 1024;
const STILL_MS = 200;
const FRAME_RATE = 60;

let session = null;

const frameOptions = (key, quantizer) => ({ keyFrame: key, vp9: { quantizer } });

const send = (current, chunk) => {
  if (current.socket.readyState !== WebSocket.OPEN) return;
  if (current.socket.bufferedAmount > FEED_BACKLOG) {
    current.wantKey = true;
    return;
  }
  const buffer = new ArrayBuffer(HEADER + chunk.byteLength);
  const view = new DataView(buffer);
  view.setUint8(0, chunk.type === "key" ? KEY : DELTA);
  view.setFloat64(1, chunk.timestamp);
  chunk.copyTo(new Uint8Array(buffer, HEADER));
  current.socket.send(buffer);
};

const keyNow = (current) => {
  if (!current.held || current.encoder.state !== "configured" || current.encoder.encodeQueueSize) {
    current.wantKey = true;
    return;
  }
  current.wantKey = false;
  current.encoder.encode(current.held, frameOptions(true, current.dirty ? current.motion : current.still));
};

const refine = (current) => {
  current.timer = null;
  if (!current.held || !current.dirty || current.encoder.state !== "configured" || current.encoder.encodeQueueSize) return;
  current.dirty = false;
  current.encoder.encode(current.held, frameOptions(false, current.still));
};

const pump = async (current, reader) => {
  while (session === current) {
    const { value: frame, done } = await reader.read();
    if (done || session !== current) {
      frame?.close();
      return;
    }
    current.held?.close();
    current.held = frame.clone();
    if (current.timer !== null) clearTimeout(current.timer);
    current.timer = setTimeout(() => refine(current), STILL_MS);
    if (current.encoder.encodeQueueSize > QUEUE_LIMIT) {
      frame.close();
      continue;
    }
    const key = current.wantKey;
    current.wantKey = false;
    current.dirty = true;
    current.encoder.encode(frame, frameOptions(key, current.motion));
    frame.close();
  }
};

const stop = () => {
  const current = session;
  session = null;
  if (!current) return;
  if (current.timer !== null) clearTimeout(current.timer);
  current.held?.close();
  if (current.encoder.state !== "closed") current.encoder.close();
  current.stream.getTracks().forEach((track) => track.stop());
  if (current.socket.readyState <= WebSocket.OPEN) current.socket.close();
};

const capture = async ({ streamId, width, height, feed, motion, still }) => {
  stop();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
        minWidth: width,
        maxWidth: width,
        minHeight: height,
        maxHeight: height,
        maxFrameRate: FRAME_RATE,
      },
    },
  });
  const track = stream.getVideoTracks()[0];
  const settings = track.getSettings();
  const socket = new WebSocket(feed);
  socket.binaryType = "arraybuffer";
  await new Promise((done, fail) => {
    socket.addEventListener("open", done, { once: true });
    socket.addEventListener("error", () => fail(new Error("feed refused")), { once: true });
  });
  const current = { stream, socket, encoder: null, held: null, timer: null, wantKey: true, dirty: false, motion, still };
  session = current;
  socket.onmessage = (event) => {
    if (event.data === "key") keyNow(current);
  };
  socket.onclose = () => {
    if (session === current) stop();
  };
  current.encoder = new VideoEncoder({
    output: (chunk) => send(current, chunk),
    error: () => {
      if (session === current) stop();
    },
  });
  current.encoder.configure({
    codec: CODEC,
    width: settings.width,
    height: settings.height,
    framerate: FRAME_RATE,
    latencyMode: "realtime",
    bitrateMode: "quantizer",
  });
  socket.send(JSON.stringify({ type: "stream", codec: CODEC, width: settings.width, height: settings.height }));
  void pump(current, new MediaStreamTrackProcessor({ track }).readable.getReader());
  return { width: settings.width, height: settings.height };
};

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.op === "capture") {
    capture(message).then(respond, (error) => respond({ error: String(error) }));
    return true;
  }
  if (message.op === "stop") {
    stop();
    respond({});
  }
  return false;
});
