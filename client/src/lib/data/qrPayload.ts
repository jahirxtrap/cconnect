import {
  authOf,
  originOf,
  parseHostInput,
  type EnvironmentProfile,
  type HostAddress,
} from "$lib/services/backend.svelte";
import { emptyAuth, type AuthInput } from "./auth";

export interface QrEnvironment {
  address: HostAddress;
  name: string;
  auth: AuthInput;
}

type Wire = Record<string, unknown>;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const record = (value: unknown): Wire | null => (typeof value === "object" && value !== null ? (value as Wire) : null);

const decoded = (raw: string): Wire | null => {
  try {
    return record(JSON.parse(raw));
  } catch {
    return null;
  }
};

const credentials = (auth: AuthInput): Wire => {
  if (auth.kind === "bearer") return { token: auth.token };
  if (auth.kind === "basic") return { auth: { kind: auth.kind, user: auth.user, password: auth.password } };
  if (auth.kind === "header") return { auth: { kind: auth.kind, name: auth.headerName, value: auth.headerValue } };
  return {};
};

const authIn = (data: Wire): AuthInput | null => {
  const token = text(data.token);
  if (token) return { ...emptyAuth(), kind: "bearer", token };
  if (data.auth === undefined) return emptyAuth();
  const auth = record(data.auth);
  if (auth?.kind === "basic") {
    return { ...emptyAuth(), kind: "basic", user: text(auth.user), password: typeof auth.password === "string" ? auth.password : "" };
  }
  if (auth?.kind === "header") return { ...emptyAuth(), kind: "header", headerName: text(auth.name), headerValue: text(auth.value) };
  return null;
};

export const environmentQrText = (url: string, name: string, auth: AuthInput) =>
  JSON.stringify({ url, ...(name ? { name } : {}), ...credentials(auth) });

export const environmentQr = (profile: EnvironmentProfile) =>
  environmentQrText(originOf(profile), profile.name, authOf(profile));

export const parseEnvironmentQr = (raw: string): QrEnvironment | null => {
  const data = decoded(raw);
  const address = data && parseHostInput(text(data.url));
  const auth = data && authIn(data);
  return data && address && auth ? { address, name: text(data.name), auth } : null;
};

export const securityKeyQr = (key: string) => JSON.stringify({ security_key: key });

export const parseSecurityKeyQr = (raw: string) => text(decoded(raw)?.security_key) || null;
