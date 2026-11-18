export interface ShellRun {
  command: string;
  stdout: string;
  stderr: string;
  code: number | null;
}

export const SHELL_MARK = "!";

const INPUT_TAG = "bash-input";

const between = (text: string, tag: string, last: boolean): string | null => {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const start = text.indexOf(open);
  if (start < 0) return null;
  const end = last ? text.lastIndexOf(close) : text.indexOf(close, start);
  return end < start ? null : text.slice(start + open.length, end);
};

export const shellInput = (command: string): string => `<${INPUT_TAG}>${command}</${INPUT_TAG}>`;

export const shellRunOf = (text: string): ShellRun | null => {
  if (!text.startsWith(`<${INPUT_TAG}>`)) return null;
  const command = between(text, INPUT_TAG, false);
  if (command === null) return null;
  const stdout = between(text, "bash-stdout", true);
  return {
    command: command.trim(),
    stdout: stdout ?? "",
    stderr: between(text, "bash-stderr", true) ?? "",
    code: stdout === null ? null : Number(between(text, "bash-exit-code", false) ?? 0) || 0,
  };
};

export const promptLine = (text: string): string => {
  const run = shellRunOf(text);
  return run ? `${SHELL_MARK}${run.command}` : text;
};

export const shellOutput = (run: ShellRun): string =>
  [run.stdout, run.stderr]
    .map((part) => part.replace(/\s+$/, ""))
    .filter(Boolean)
    .join("\n");
