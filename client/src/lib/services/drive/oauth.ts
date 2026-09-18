import { t } from "$lib/i18n/index.svelte";
import { isDesktop, isTauri, openExternal } from "$lib/platform";
import { DRIVE_SCOPE, GOOGLE_OAUTH, googleClientId, request } from "./config";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const IDENTITY_URL = "https://accounts.google.com/gsi/client";
const ANDROID_REDIRECT = "com.jahirtrap.cconnect:/oauth2redirect";
const FORM_TYPE = "application/x-www-form-urlencoded";
const WAIT_LIMIT_MS = 300_000;
const VERIFIER_BYTES = 32;
const STATE_BYTES = 16;

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface Redirect {
  code: string;
  state: string;
  error: string;
}

interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
}

interface Identity {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: () => void;
  }) => TokenClient;
  revoke: (token: string, done: () => void) => void;
}

declare global {
  interface Window {
    __cconnectOauth?: (url: string) => void;
    google?: { accounts: { oauth2: Identity } };
  }
}

const base64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const randomText = (bytes: number): string => base64Url(crypto.getRandomValues(new Uint8Array(bytes)));

const challengeOf = async (verifier: string): Promise<string> =>
  base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));

const authUrl = (redirect: string, challenge: string, state: string): string =>
  `${AUTH_URL}?${new URLSearchParams({
    client_id: googleClientId(),
    redirect_uri: redirect,
    response_type: "code",
    scope: DRIVE_SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
    state,
  })}`;

const exchange = async (params: Record<string, string>): Promise<Tokens | null> => {
  const body = new URLSearchParams({ client_id: googleClientId(), ...params });
  if (isDesktop && GOOGLE_OAUTH.desktopSecret) body.set("client_secret", GOOGLE_OAUTH.desktopSecret);
  const response = await request(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": FORM_TYPE },
    body: body.toString(),
  }).catch(() => null);
  if (!response?.ok) return null;
  const data = (await response.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!data.access_token) return null;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? "",
    expiresAt: Date.now() + (data.expires_in ?? 0) * 1000,
  };
};

const desktopTokens = async (): Promise<Tokens | null> => {
  const { invoke } = await import("@tauri-apps/api/core");
  const port = await invoke<number>("oauth_start").catch(() => 0);
  if (!port) return null;
  const redirect = `http://127.0.0.1:${port}`;
  const verifier = randomText(VERIFIER_BYTES);
  const state = randomText(STATE_BYTES);
  openExternal(authUrl(redirect, await challengeOf(verifier), state));
  const answer = await invoke<Redirect>("oauth_wait", { message: t("DRIVE_BROWSER_DONE") }).catch(() => null);
  if (!answer?.code || answer.state !== state) return null;
  return exchange({
    code: answer.code,
    code_verifier: verifier,
    redirect_uri: redirect,
    grant_type: "authorization_code",
  });
};

const awaitRedirect = (): Promise<string> =>
  new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (url: string) => {
      clearTimeout(timer);
      delete window.__cconnectOauth;
      resolve(url);
    };
    timer = setTimeout(() => finish(""), WAIT_LIMIT_MS);
    window.__cconnectOauth = finish;
  });

const androidTokens = async (): Promise<Tokens | null> => {
  const verifier = randomText(VERIFIER_BYTES);
  const state = randomText(STATE_BYTES);
  const redirected = awaitRedirect();
  openExternal(authUrl(ANDROID_REDIRECT, await challengeOf(verifier), state));
  const url = await redirected;
  if (!url) return null;
  const answer = new URLSearchParams(url.split("?")[1] ?? "");
  if (!answer.get("code") || answer.get("state") !== state) return null;
  return exchange({
    code: answer.get("code") ?? "",
    code_verifier: verifier,
    redirect_uri: ANDROID_REDIRECT,
    grant_type: "authorization_code",
  });
};

const loadIdentity = (): Promise<Identity | null> =>
  new Promise((resolve) => {
    if (window.google?.accounts.oauth2) {
      resolve(window.google.accounts.oauth2);
      return;
    }
    const script = document.createElement("script");
    script.src = IDENTITY_URL;
    script.async = true;
    script.onload = () => resolve(window.google?.accounts.oauth2 ?? null);
    script.onerror = () => resolve(null);
    document.head.append(script);
  });

const webTokens = async (prompt: string): Promise<Tokens | null> => {
  const identity = await loadIdentity();
  if (!identity) return null;
  return new Promise((resolve) => {
    const client = identity.initTokenClient({
      client_id: googleClientId(),
      scope: DRIVE_SCOPE,
      callback: (response) =>
        resolve(
          response.access_token
            ? {
                accessToken: response.access_token,
                refreshToken: "",
                expiresAt: Date.now() + (response.expires_in ?? 0) * 1000,
              }
            : null,
        ),
      error_callback: () => resolve(null),
    });
    client.requestAccessToken({ prompt });
  });
};

export const connectTokens = (): Promise<Tokens | null> => {
  if (isDesktop) return desktopTokens();
  if (isTauri) return androidTokens();
  return webTokens("consent");
};

export const silentTokens = (): Promise<Tokens | null> => (isTauri ? Promise.resolve(null) : webTokens(""));

export const refreshTokens = (refreshToken: string): Promise<Tokens | null> =>
  exchange({ refresh_token: refreshToken, grant_type: "refresh_token" });

export const cancelConnect = async () => {
  window.__cconnectOauth?.("");
  if (!isDesktop) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("oauth_cancel").catch(() => undefined);
};

export const revokeTokens = async (token: string) => {
  if (!isTauri) {
    window.google?.accounts.oauth2.revoke(token, () => undefined);
    return;
  }
  await request(REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": FORM_TYPE },
    body: new URLSearchParams({ token }).toString(),
  }).catch(() => null);
};
