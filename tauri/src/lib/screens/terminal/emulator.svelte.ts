const SCROLLBACK_CAP = 2000;
const TAB_WIDTH = 8;
const CUBE_BASE = 55;
const CUBE_STEP = 40;
const GREY_BASE = 8;
const GREY_STEP = 10;

export interface TerminalCell {
  char: string;
  fg: string;
  bg: string;
  bold: boolean;
}

export interface TerminalSnapshot {
  lines: TerminalCell[][];
  cursorRow: number;
  cursorCol: number;
  columns: number;
}

const ANSI_BASE = [
  "#000000",
  "#cd3131",
  "#0dbc79",
  "#e5e510",
  "#2472c8",
  "#bc3fbc",
  "#11a8cd",
  "#e5e5e5",
  "#666666",
  "#f14c4c",
  "#23d18b",
  "#f5f543",
  "#3b8eea",
  "#d670d6",
  "#29b8db",
  "#ffffff",
];

const hex = (value: number) => value.toString(16).padStart(2, "0");
const rgb = (r: number, g: number, b: number) => `#${hex(r)}${hex(g)}${hex(b)}`;

type Mode = "ground" | "esc" | "csi" | "osc" | "designate";

export class TerminalEmulator {
  rows: number;
  cols: number;

  #defaultFg: string;
  #defaultBg: string;
  #onInput: (data: Uint8Array) => void;
  #onResize: (cols: number, rows: number) => void;

  #scrollback: TerminalCell[][] = [];
  #screen: TerminalCell[][];
  #cursorRow = 0;
  #cursorCol = 0;
  #savedRow = 0;
  #savedCol = 0;
  #scrollTop = 0;
  #scrollBottom: number;

  #fg: string;
  #bg: string;
  #bold = false;

  #mode: Mode = "ground";
  #csi = "";
  #decoder = new TextDecoder("utf-8");
  #encoder = new TextEncoder();

  frame = $state(0);

  constructor(
    rows: number,
    cols: number,
    defaultFg: string,
    defaultBg: string,
    onInput: (data: Uint8Array) => void,
    onResize: (cols: number, rows: number) => void,
  ) {
    this.rows = Math.max(1, rows);
    this.cols = Math.max(1, cols);
    this.#defaultFg = defaultFg;
    this.#defaultBg = defaultBg;
    this.#fg = defaultFg;
    this.#bg = defaultBg;
    this.#onInput = onInput;
    this.#onResize = onResize;
    this.#scrollBottom = this.rows - 1;
    this.#screen = Array.from({ length: this.rows }, () => this.#blankRow());
  }

  #blankCell(): TerminalCell {
    return { char: " ", fg: this.#defaultFg, bg: this.#defaultBg, bold: false };
  }

  #blankRow(): TerminalCell[] {
    return Array.from({ length: this.cols }, () => this.#blankCell());
  }

  send(data: Uint8Array) {
    this.#onInput(data);
  }

  sendText(text: string) {
    this.#onInput(this.#encoder.encode(text));
  }

  snapshot(): TerminalSnapshot {
    return {
      lines: [...this.#scrollback, ...this.#screen],
      cursorRow: this.#scrollback.length + this.#cursorRow,
      cursorCol: this.#cursorCol,
      columns: this.cols,
    };
  }

  resize(cols: number, rows: number) {
    const c = Math.max(1, cols);
    const r = Math.max(1, rows);
    if (c === this.cols && r === this.rows) return;
    const old = this.#screen;
    this.cols = c;
    this.rows = r;
    this.#screen = Array.from({ length: r }, (_, row) =>
      Array.from({ length: c }, (_, col) => old[row]?.[col] ?? this.#blankCell()),
    );
    this.#scrollTop = 0;
    this.#scrollBottom = r - 1;
    this.#cursorRow = Math.min(Math.max(this.#cursorRow, 0), r - 1);
    this.#cursorCol = Math.min(Math.max(this.#cursorCol, 0), c - 1);
    this.frame++;
    this.#onResize(c, r);
  }

  write(bytes: Uint8Array) {
    const text = this.#decoder.decode(bytes, { stream: true });
    for (const ch of text) this.#consume(ch);
    this.frame++;
  }

  #consume(ch: string) {
    switch (this.#mode) {
      case "ground":
        this.#ground(ch);
        break;
      case "esc":
        this.#esc(ch);
        break;
      case "csi":
        this.#csiChar(ch);
        break;
      case "osc": {
        const oscCode = ch.codePointAt(0) ?? 0;
        if (oscCode === 0x07) this.#mode = "ground";
        else if (oscCode === 0x1b) this.#mode = "esc";
        break;
      }
      case "designate":
        this.#mode = "ground";
        break;
    }
  }

  #ground(ch: string) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0x1b) this.#mode = "esc";
    else if (code === 0x0a || code === 0x0b || code === 0x0c) this.#lineFeed();
    else if (code === 0x0d) this.#cursorCol = 0;
    else if (code === 0x08) this.#cursorCol = Math.max(0, this.#cursorCol - 1);
    else if (code === 0x09) this.#cursorCol = Math.min(this.cols - 1, (Math.floor(this.#cursorCol / TAB_WIDTH) + 1) * TAB_WIDTH);
    else if (code >= 0x00 && code <= 0x1f) return;
    else this.#putChar(ch);
  }

  #esc(ch: string) {
    switch (ch) {
      case "[":
        this.#csi = "";
        this.#mode = "csi";
        break;
      case "]":
        this.#mode = "osc";
        break;
      case "(":
      case ")":
      case "*":
      case "+":
        this.#mode = "designate";
        break;
      case "7":
        this.#savedRow = this.#cursorRow;
        this.#savedCol = this.#cursorCol;
        this.#mode = "ground";
        break;
      case "8":
        this.#cursorRow = this.#savedRow;
        this.#cursorCol = this.#savedCol;
        this.#mode = "ground";
        break;
      case "M":
        if (this.#cursorRow > this.#scrollTop) this.#cursorRow--;
        else this.#scrollDown();
        this.#mode = "ground";
        break;
      default:
        this.#mode = "ground";
    }
  }

  #csiChar(ch: string) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x40 && code <= 0x7e) {
      this.#dispatchCsi(this.#csi, ch);
      this.#mode = "ground";
    } else {
      this.#csi += ch;
    }
  }

  #dispatchCsi(body: string, final: string) {
    const isPrivate = body.startsWith("?");
    const nums = body
      .replace(/^\?/, "")
      .split(";")
      .map((part) => (part === "" ? null : Number.parseInt(part, 10)));
    const arg = (index: number, fallback = 0) => {
      const value = nums[index];
      return value === null || value === undefined || Number.isNaN(value) ? fallback : value;
    };

    if (isPrivate) {
      if (final === "h" || final === "l") {
        const value = arg(0);
        if (value === 1049 || value === 47 || value === 1047) this.#eraseAll();
      }
      return;
    }

    const clampRow = (value: number) => Math.min(Math.max(value, 0), this.rows - 1);
    const clampCol = (value: number) => Math.min(Math.max(value, 0), this.cols - 1);

    switch (final) {
      case "m":
        this.#applySgr(nums);
        break;
      case "H":
      case "f":
        this.#cursorRow = clampRow(arg(0, 1) - 1);
        this.#cursorCol = clampCol(arg(1, 1) - 1);
        break;
      case "A":
        this.#cursorRow = Math.max(0, this.#cursorRow - Math.max(1, arg(0, 1)));
        break;
      case "B":
        this.#cursorRow = Math.min(this.rows - 1, this.#cursorRow + Math.max(1, arg(0, 1)));
        break;
      case "C":
        this.#cursorCol = Math.min(this.cols - 1, this.#cursorCol + Math.max(1, arg(0, 1)));
        break;
      case "D":
        this.#cursorCol = Math.max(0, this.#cursorCol - Math.max(1, arg(0, 1)));
        break;
      case "E":
        this.#cursorRow = Math.min(this.rows - 1, this.#cursorRow + Math.max(1, arg(0, 1)));
        this.#cursorCol = 0;
        break;
      case "F":
        this.#cursorRow = Math.max(0, this.#cursorRow - Math.max(1, arg(0, 1)));
        this.#cursorCol = 0;
        break;
      case "G":
      case "`":
        this.#cursorCol = clampCol(arg(0, 1) - 1);
        break;
      case "d":
        this.#cursorRow = clampRow(arg(0, 1) - 1);
        break;
      case "J":
        this.#eraseDisplay(arg(0));
        break;
      case "K":
        this.#eraseLine(arg(0));
        break;
      case "L":
        this.#insertLines(Math.max(1, arg(0, 1)));
        break;
      case "M":
        this.#deleteLines(Math.max(1, arg(0, 1)));
        break;
      case "P":
        this.#deleteChars(Math.max(1, arg(0, 1)));
        break;
      case "@":
        this.#insertChars(Math.max(1, arg(0, 1)));
        break;
      case "X":
        this.#eraseChars(Math.max(1, arg(0, 1)));
        break;
      case "r":
        this.#scrollTop = clampRow(arg(0, 1) - 1);
        this.#scrollBottom = Math.min(Math.max(arg(1, this.rows) - 1, this.#scrollTop), this.rows - 1);
        this.#cursorRow = 0;
        this.#cursorCol = 0;
        break;
      case "s":
        this.#savedRow = this.#cursorRow;
        this.#savedCol = this.#cursorCol;
        break;
      case "u":
        this.#cursorRow = this.#savedRow;
        this.#cursorCol = this.#savedCol;
        break;
    }
  }

  #applySgr(nums: (number | null)[]) {
    if (!nums.length) {
      this.#reset();
      return;
    }
    for (let i = 0; i < nums.length; i++) {
      const code = nums[i] ?? 0;
      if (code === 0) this.#reset();
      else if (code === 1) this.#bold = true;
      else if (code === 22) this.#bold = false;
      else if (code >= 30 && code <= 37) this.#fg = this.#ansiColor(code - 30);
      else if (code >= 90 && code <= 97) this.#fg = this.#ansiColor(code - 90 + 8);
      else if (code === 39) this.#fg = this.#defaultFg;
      else if (code >= 40 && code <= 47) this.#bg = this.#ansiColor(code - 40);
      else if (code >= 100 && code <= 107) this.#bg = this.#ansiColor(code - 100 + 8);
      else if (code === 49) this.#bg = this.#defaultBg;
      else if (code === 38) i = this.#extendedColor(nums, i, (color) => (this.#fg = color));
      else if (code === 48) i = this.#extendedColor(nums, i, (color) => (this.#bg = color));
    }
  }

  #extendedColor(nums: (number | null)[], start: number, set: (color: string) => void): number {
    const kind = nums[start + 1];
    if (kind === 5) {
      const index = nums[start + 2];
      if (index !== null && index !== undefined) set(this.#ansiColor(index));
      return start + 2;
    }
    if (kind === 2) {
      set(rgb(nums[start + 2] ?? 0, nums[start + 3] ?? 0, nums[start + 4] ?? 0));
      return start + 4;
    }
    return start;
  }

  #reset() {
    this.#fg = this.#defaultFg;
    this.#bg = this.#defaultBg;
    this.#bold = false;
  }

  #putChar(ch: string) {
    if (this.#cursorCol >= this.cols) {
      this.#cursorCol = 0;
      this.#lineFeed();
    }
    this.#screen[this.#cursorRow][this.#cursorCol] = { char: ch, fg: this.#fg, bg: this.#bg, bold: this.#bold };
    this.#cursorCol++;
  }

  #lineFeed() {
    if (this.#cursorRow === this.#scrollBottom) this.#scrollUp();
    else this.#cursorRow = Math.min(this.rows - 1, this.#cursorRow + 1);
  }

  #scrollUp() {
    if (this.#scrollTop === 0) {
      this.#scrollback.push(this.#screen[0]);
      while (this.#scrollback.length > SCROLLBACK_CAP) this.#scrollback.shift();
    }
    for (let r = this.#scrollTop; r < this.#scrollBottom; r++) this.#screen[r] = this.#screen[r + 1];
    this.#screen[this.#scrollBottom] = this.#blankRow();
  }

  #scrollDown() {
    for (let r = this.#scrollBottom; r > this.#scrollTop; r--) this.#screen[r] = this.#screen[r - 1];
    this.#screen[this.#scrollTop] = this.#blankRow();
  }

  #insertLines(count: number) {
    if (this.#cursorRow < this.#scrollTop || this.#cursorRow > this.#scrollBottom) return;
    const limit = Math.min(count, this.#scrollBottom - this.#cursorRow + 1);
    for (let n = 0; n < limit; n++) {
      for (let r = this.#scrollBottom; r > this.#cursorRow; r--) this.#screen[r] = this.#screen[r - 1];
      this.#screen[this.#cursorRow] = this.#blankRow();
    }
  }

  #deleteLines(count: number) {
    if (this.#cursorRow < this.#scrollTop || this.#cursorRow > this.#scrollBottom) return;
    const limit = Math.min(count, this.#scrollBottom - this.#cursorRow + 1);
    for (let n = 0; n < limit; n++) {
      for (let r = this.#cursorRow; r < this.#scrollBottom; r++) this.#screen[r] = this.#screen[r + 1];
      this.#screen[this.#scrollBottom] = this.#blankRow();
    }
  }

  #deleteChars(count: number) {
    const row = this.#screen[this.#cursorRow];
    for (let c = this.#cursorCol; c < this.cols; c++) {
      const from = c + count;
      row[c] = from < this.cols ? row[from] : this.#blankCell();
    }
  }

  #insertChars(count: number) {
    const row = this.#screen[this.#cursorRow];
    for (let c = this.cols - 1; c >= this.#cursorCol; c--) {
      const from = c - count;
      row[c] = from >= this.#cursorCol ? row[from] : this.#blankCell();
    }
  }

  #eraseChars(count: number) {
    const row = this.#screen[this.#cursorRow];
    for (let c = this.#cursorCol; c < Math.min(this.cols, this.#cursorCol + count); c++) row[c] = this.#blankCell();
  }

  #eraseLine(mode: number) {
    const row = this.#screen[this.#cursorRow];
    if (mode === 0) for (let c = this.#cursorCol; c < this.cols; c++) row[c] = this.#blankCell();
    else if (mode === 1) for (let c = 0; c <= Math.min(this.#cursorCol, this.cols - 1); c++) row[c] = this.#blankCell();
    else if (mode === 2) for (let c = 0; c < this.cols; c++) row[c] = this.#blankCell();
  }

  #eraseDisplay(mode: number) {
    if (mode === 0) {
      this.#eraseLine(0);
      for (let r = this.#cursorRow + 1; r < this.rows; r++) this.#screen[r] = this.#blankRow();
    } else if (mode === 1) {
      this.#eraseLine(1);
      for (let r = 0; r < this.#cursorRow; r++) this.#screen[r] = this.#blankRow();
    } else if (mode === 2) {
      this.#eraseAll();
    } else if (mode === 3) {
      this.#scrollback = [];
    }
  }

  #eraseAll() {
    for (let r = 0; r < this.rows; r++) this.#screen[r] = this.#blankRow();
    this.#cursorRow = 0;
    this.#cursorCol = 0;
  }

  #ansiColor(index: number): string {
    if (index >= 0 && index < ANSI_BASE.length) return ANSI_BASE[index];
    if (index >= 16 && index <= 231) {
      const n = index - 16;
      const comp = (value: number) => (value === 0 ? 0 : CUBE_BASE + value * CUBE_STEP);
      return rgb(comp(Math.floor(n / 36)), comp(Math.floor((n % 36) / 6)), comp(n % 6));
    }
    if (index >= 232 && index <= 255) {
      const value = GREY_BASE + (index - 232) * GREY_STEP;
      return rgb(value, value, value);
    }
    return this.#defaultFg;
  }
}
