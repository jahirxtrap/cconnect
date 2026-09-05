import { i18n } from "$lib/i18n/index.svelte";

interface RecognitionAlternative {
  transcript: string;
}

interface RecognitionResult {
  isFinal: boolean;
  0: RecognitionAlternative;
}

interface RecognitionEvent {
  resultIndex: number;
  results: { length: number; [index: number]: RecognitionResult };
}

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type RecognitionClass = new () => Recognition;

interface AndroidVoice {
  isAvailable: () => boolean;
  start: (language: string) => void;
  stop: () => void;
}

interface VoiceEvent {
  kind: "partial" | "final" | "end";
  text: string;
  error: string | null;
}

export interface Dictation {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onEnd: (error: string | null) => void;
}

const REGIONS: Record<string, string> = { es: "es-ES", en: "en-US" };

const scope = () =>
  window as unknown as {
    SpeechRecognition?: RecognitionClass;
    webkitSpeechRecognition?: RecognitionClass;
    AndroidVoice?: AndroidVoice;
    __cconnectVoice?: (event: VoiceEvent) => void;
  };

const android = (): AndroidVoice | null => {
  const bridge = scope().AndroidVoice;
  return bridge && bridge.isAvailable() ? bridge : null;
};

const engine = (): RecognitionClass | null =>
  scope().SpeechRecognition ?? scope().webkitSpeechRecognition ?? null;

export const voiceAvailable = (): boolean => android() !== null || engine() !== null;

export const dictationLanguage = (): string =>
  navigator.language.includes("-") ? navigator.language : (REGIONS[i18n.resolved] ?? "en-US");

let active: (() => void) | null = null;

const startAndroid = (bridge: AndroidVoice, { onPartial, onFinal, onEnd }: Dictation): (() => void) => {
  const finish = () => {
    if (scope().__cconnectVoice === receive) delete scope().__cconnectVoice;
  };

  const receive = (event: VoiceEvent) => {
    if (event.kind === "partial") onPartial(event.text);
    else if (event.kind === "final") onFinal(event.text.trim());
    else {
      finish();
      if (active === stop) active = null;
      onEnd(event.error);
    }
  };

  const stop = () => bridge.stop();

  scope().__cconnectVoice = receive;
  bridge.start(dictationLanguage());
  return stop;
};

export const startDictation = (dictation: Dictation): (() => void) => {
  active?.();

  const bridge = android();
  if (bridge) {
    const stop = startAndroid(bridge, dictation);
    active = stop;
    return stop;
  }

  const Engine = engine();
  if (!Engine) {
    dictation.onEnd("unavailable");
    return () => {};
  }

  const recognition = new Engine();
  recognition.lang = dictationLanguage();
  recognition.continuous = true;
  recognition.interimResults = true;

  let failure: string | null = null;

  recognition.onresult = (event) => {
    let partial = "";
    for (let index = event.resultIndex; index < event.results.length; index++) {
      const result = event.results[index];
      const transcript = result[0].transcript;
      if (result.isFinal) dictation.onFinal(transcript.trim());
      else partial += transcript;
    }
    dictation.onPartial(partial.trim());
  };

  recognition.onerror = (event) => {
    if (event.error !== "aborted" && event.error !== "no-speech") failure = event.error;
  };

  const stop = () => recognition.stop();

  recognition.onend = () => {
    if (active === stop) active = null;
    dictation.onEnd(failure);
  };

  recognition.start();
  active = stop;

  return stop;
};
