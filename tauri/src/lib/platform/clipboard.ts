import { isDesktop } from "./index";

const nativeCopy = async (text: string): Promise<boolean> => {
  if (!isDesktop) return false;
  try {
    const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
    await writeText(text);
    return true;
  } catch {
    return false;
  }
};

const legacyCopy = (text: string): boolean => {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0";
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  return copied;
};

export const copyText = async (text: string): Promise<boolean> => {
  if (await nativeCopy(text)) return true;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return legacyCopy(text);
  }
};

const selectionText = (): string => {
  const field = document.activeElement;
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    return field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0);
  }
  return getSelection()?.toString() ?? "";
};

export const mirrorNativeCopy = () => {
  if (!isDesktop) return;
  const text = selectionText();
  if (text) void nativeCopy(text);
};
