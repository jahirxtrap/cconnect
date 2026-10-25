const CHUNK = 0x8000;

export const decodeBase64 = (text: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

export const encodeBase64 = (bytes: Uint8Array): string => {
  let text = "";
  for (let start = 0; start < bytes.length; start += CHUNK) {
    text += String.fromCharCode(...bytes.subarray(start, start + CHUNK));
  }
  return btoa(text);
};
