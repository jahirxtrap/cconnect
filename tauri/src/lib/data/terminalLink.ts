export type TerminalStatus = "connecting" | "connected" | "closed" | "failed";

export interface TerminalHooks {
  onData: (bytes: Uint8Array) => void;
  onStatus: (status: TerminalStatus) => void;
}

export interface TerminalLink {
  send: (data: Uint8Array) => void;
  resize: (cols: number, rows: number) => void;
  close: () => void;
}

export type TerminalConnector = (hooks: TerminalHooks, cols: number, rows: number) => TerminalLink;
