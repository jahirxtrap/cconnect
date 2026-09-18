import { isDesktop, isTauri } from "$lib/platform";

declare const __GOOGLE_OAUTH__: {
  desktopId: string;
  desktopSecret: string;
  androidId: string;
  webId: string;
};

export const GOOGLE_OAUTH = __GOOGLE_OAUTH__;

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export const googleClientId = (): string =>
  isDesktop ? GOOGLE_OAUTH.desktopId : isTauri ? GOOGLE_OAUTH.androidId : GOOGLE_OAUTH.webId;

export const driveAvailable = (): boolean => googleClientId() !== "";

export const request = async (url: string, init: RequestInit = {}): Promise<Response> => {
  if (!isTauri) return fetch(url, init);
  const { fetch: nativeFetch } = await import("@tauri-apps/plugin-http");
  return nativeFetch(url, init);
};
