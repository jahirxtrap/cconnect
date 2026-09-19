interface AndroidGoogleAuthBridge {
  isAvailable(): boolean;
  authorize(interactive: boolean): void;
}

const bridge = (): AndroidGoogleAuthBridge | undefined =>
  (window as unknown as { AndroidGoogleAuth?: AndroidGoogleAuthBridge }).AndroidGoogleAuth;

const WAIT_LIMIT_MS = 300_000;

declare global {
  interface Window {
    __cconnectGoogleToken?: (token: string) => void;
  }
}

export const androidGoogleAuth = (): boolean => bridge()?.isAvailable() === true;

export const androidGoogleToken = (interactive: boolean): Promise<string> =>
  new Promise((resolve) => {
    const native = bridge();
    if (!native) {
      resolve("");
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (token: string) => {
      clearTimeout(timer);
      delete window.__cconnectGoogleToken;
      resolve(token);
    };
    timer = setTimeout(() => finish(""), WAIT_LIMIT_MS);
    window.__cconnectGoogleToken = finish;
    native.authorize(interactive);
  });
