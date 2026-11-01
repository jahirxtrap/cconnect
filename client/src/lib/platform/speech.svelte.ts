import { settings } from "$lib/data/settings.svelte";
import { i18n } from "$lib/i18n/index.svelte";
import { speakableParagraphs } from "$lib/markdown/render";

interface AndroidSpeech {
  isAvailable: () => boolean;
  voices: () => string;
  speak: (key: string, chunks: string, language: string, voice: string, rate: number) => void;
  stop: () => void;
}

interface SpeechEvent {
  id: string;
  kind: "ready" | "done" | "error";
}

export interface SpeechVoice {
  id: string;
  label: string;
  language: string;
}

export interface Voicing {
  voice: string;
  rate: number;
}

export const AUTO_READ_OFF = "off";
export const AUTO_READ_ALWAYS = "always";
export const AUTO_READ_BACKGROUND = "background";
export const AUTO_READ_MODES = [AUTO_READ_OFF, AUTO_READ_ALWAYS, AUTO_READ_BACKGROUND];

const CHUNK_LENGTH = 220;
const SENTENCE_RE = /[^.!?。！？\n]+[.!?。！？]*\s*/g;
const LINE_RE = /\n+/;

const scope = () =>
  window as unknown as {
    AndroidSpeech?: AndroidSpeech;
    __cconnectSpeech?: (event: SpeechEvent) => void;
  };

const android = (): AndroidSpeech | null => {
  const bridge = scope().AndroidSpeech;
  return bridge && bridge.isAvailable() ? bridge : null;
};

const synth = (): SpeechSynthesis | null => ("speechSynthesis" in window ? window.speechSynthesis : null);

const languageOf = (code: string) => code.split("-")[0].toLowerCase();

export const speechKey = (scope: string | null, id: number) => `${scope ?? ""}:${id}`;

const chunked = (paragraphs: string[]): string[] =>
  paragraphs.flatMap((paragraph) => {
    const pieces: string[] = [];
    let current = "";
    for (const sentence of paragraph.match(SENTENCE_RE) ?? [paragraph]) {
      if (current && current.length + sentence.length > CHUNK_LENGTH) {
        pieces.push(current.trim());
        current = "";
      }
      current += sentence;
    }
    if (current.trim()) pieces.push(current.trim());
    return pieces;
  });

class Speech {
  speaking = $state<string | null>(null);
  voices = $state<SpeechVoice[]>([]);

  readonly available: boolean;

  #run = 0;

  constructor() {
    this.available = android() !== null || synth() !== null;
    scope().__cconnectSpeech = (event) => this.#received(event);
    if (!android()) synth()?.addEventListener("voiceschanged", () => this.#loadVoices());
    this.#loadVoices();
  }

  get language(): string {
    return i18n.resolved;
  }

  voicesForLanguage(): SpeechVoice[] {
    const wanted = languageOf(this.language);
    return this.voices.filter((voice) => languageOf(voice.language) === wanted || voice.id === settings.speechVoice);
  }

  speakMarkdown(key: string, markdown: string) {
    this.#speak(key, chunked(speakableParagraphs(markdown)), this.#saved());
  }

  speakText(key: string, text: string, voicing: Voicing = this.#saved()) {
    this.#speak(key, chunked(text.split(LINE_RE).map((line) => line.trim()).filter(Boolean)), voicing);
  }

  #saved(): Voicing {
    return { voice: settings.speechVoice, rate: settings.speechRate };
  }

  stop() {
    this.#run++;
    this.speaking = null;
    android()?.stop();
    synth()?.cancel();
  }

  #loadVoices() {
    const bridge = android();
    if (bridge) {
      try {
        this.voices = JSON.parse(bridge.voices()) as SpeechVoice[];
      } catch {
        this.voices = [];
      }
      return;
    }
    this.voices = (synth()?.getVoices() ?? []).map((voice) => ({
      id: voice.voiceURI,
      label: voice.name,
      language: voice.lang,
    }));
  }

  #received(event: SpeechEvent) {
    if (event.kind === "ready") this.#loadVoices();
    else if (event.id && event.id === this.speaking) this.speaking = null;
  }

  #webVoice(engine: SpeechSynthesis, id: string): SpeechSynthesisVoice | null {
    const voices = engine.getVoices();
    const chosen = voices.find((voice) => voice.voiceURI === id);
    if (chosen) return chosen;
    const wanted = languageOf(this.language);
    const local = voices.filter((voice) => languageOf(voice.lang) === wanted);
    return local.find((voice) => voice.default) ?? local.find((voice) => voice.localService) ?? local[0] ?? null;
  }

  #speak(key: string, chunks: string[], voicing: Voicing) {
    this.stop();
    if (!chunks.length) return;
    const run = this.#run;
    this.speaking = key;
    const bridge = android();
    if (bridge) {
      bridge.speak(key, JSON.stringify(chunks), this.language, voicing.voice, voicing.rate);
      return;
    }
    const engine = synth();
    if (!engine) {
      this.speaking = null;
      return;
    }
    const voice = this.#webVoice(engine, voicing.voice);
    const settle = () => {
      if (this.#run === run) this.speaking = null;
    };
    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = voice?.lang ?? this.language;
      utterance.voice = voice;
      utterance.rate = voicing.rate;
      utterance.onerror = settle;
      if (index === chunks.length - 1) utterance.onend = settle;
      engine.speak(utterance);
    });
  }
}

export const speech = new Speech();
