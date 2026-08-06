interface AndroidDownloadsBridge {
  enqueue: (url: string, filename: string, headersJson: string) => string;
  status: (id: string) => string;
  cancel: (id: string) => void;
  saveAs: (url: string, filename: string, headersJson: string) => void;
  share: (url: string, filename: string, headersJson: string) => void;
  saveText: (filename: string, text: string) => boolean;
  shareText: (filename: string, text: string) => void;
}

interface DownloadState {
  status: "active" | "done" | "failed";
  bytes: number;
  total: number;
}

const POLL_INTERVAL = 300;

export const androidDownloads = (): AndroidDownloadsBridge | undefined =>
  (window as unknown as { AndroidDownloads?: AndroidDownloadsBridge }).AndroidDownloads;

export const trackAndroidDownload = (
  bridge: AndroidDownloadsBridge,
  id: string,
  onProgress: (value: number) => void,
  signal: AbortSignal,
) =>
  new Promise<boolean>((resolve) => {
    const stop = (result: boolean) => {
      clearInterval(timer);
      signal.removeEventListener("abort", abort);
      resolve(result);
    };
    const abort = () => {
      bridge.cancel(id);
      stop(false);
    };
    const timer = setInterval(() => {
      let state: DownloadState;
      try {
        state = JSON.parse(bridge.status(id)) as DownloadState;
      } catch {
        stop(false);
        return;
      }
      if (state.total > 0) onProgress(Math.min(1, state.bytes / state.total));
      if (state.status === "done") stop(true);
      else if (state.status === "failed") stop(false);
    }, POLL_INTERVAL);
    signal.addEventListener("abort", abort);
  });
