export const decodeBase64 = (text: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
