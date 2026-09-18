const MARK = "cconnect-encrypted";
const FORMAT = 1;
const KDF = "PBKDF2-SHA256";
const ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BITS = 256;
const CHUNK = 0x8000;

interface Envelope {
  app: string;
  version: number;
  kdf: string;
  iterations: number;
  salt: string;
  iv: string;
  data: string;
}

const encode = (bytes: Uint8Array): string => {
  let text = "";
  for (let at = 0; at < bytes.length; at += CHUNK) text += String.fromCharCode(...bytes.subarray(at, at + CHUNK));
  return btoa(text);
};

const decode = (text: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

const keyOf = async (passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> => {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: KEY_BITS },
    false,
    ["encrypt", "decrypt"],
  );
};

export const encryptionAvailable = (): boolean => typeof crypto.subtle !== "undefined";

export const isEncrypted = (raw: string): boolean => {
  try {
    return (JSON.parse(raw) as Envelope).app === MARK;
  } catch {
    return false;
  }
};

export const encryptBackup = async (plain: string, passphrase: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await keyOf(passphrase, salt, ITERATIONS);
  const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  const envelope: Envelope = {
    app: MARK,
    version: FORMAT,
    kdf: KDF,
    iterations: ITERATIONS,
    salt: encode(salt),
    iv: encode(iv),
    data: encode(new Uint8Array(sealed)),
  };
  return JSON.stringify(envelope);
};

export const decryptBackup = async (raw: string, passphrase: string): Promise<string | null> => {
  try {
    const envelope = JSON.parse(raw) as Envelope;
    if (envelope.app !== MARK) return null;
    const key = await keyOf(passphrase, decode(envelope.salt), envelope.iterations);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(envelope.iv) }, key, decode(envelope.data));
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
};
