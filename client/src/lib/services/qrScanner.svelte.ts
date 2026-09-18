import { isTauri, systemName } from "$lib/platform";
import { androidQrScan } from "$lib/platform/androidQrScan";

const isMobile = () => isTauri && /android|iphone|ipad/i.test(navigator.userAgent);

const handheld = () => systemName() === "android" || systemName() === "ios";

const browserScanAvailable = () =>
  !isTauri && handheld() && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;

export const qrScanAvailable = () => isMobile() || browserScanAvailable();

const codeScannerAvailable = () => {
  try {
    return androidQrScan()?.isAvailable() ?? false;
  } catch {
    return false;
  }
};

export const cameraScan = $state({ active: false, browser: false });

let settle: ((raw: string | null) => void) | null = null;

const scanWithBrowser = () =>
  new Promise<string | null>((resolve) => {
    settle = resolve;
    cameraScan.browser = true;
    cameraScan.active = true;
  });

export const finishBrowserScan = (raw: string | null) => {
  const resolve = settle;
  settle = null;
  cameraScan.active = false;
  cameraScan.browser = false;
  resolve?.(raw);
};

const scanWithCodeScanner = () =>
  new Promise<string | null>((resolve) => {
    const host = window as unknown as { __cconnectQrResult?: (raw: string | null) => void };
    host.__cconnectQrResult = (raw) => {
      delete host.__cconnectQrResult;
      resolve(raw ?? null);
    };
    androidQrScan()?.scan();
  });

const scanWithCamera = async (): Promise<string | null> => {
  const { scan, Format, requestPermissions, checkPermissions } = await import(
    "@tauri-apps/plugin-barcode-scanner"
  );
  const state = await checkPermissions();
  if (state !== "granted" && (await requestPermissions()) !== "granted") return null;
  cameraScan.active = true;
  document.documentElement.classList.add("scanning");
  try {
    const result = await scan({ windowed: false, formats: [Format.QRCode] });
    return result.content || null;
  } finally {
    cameraScan.active = false;
    document.documentElement.classList.remove("scanning");
  }
};

export const cancelCameraScan = async () => {
  if (cameraScan.browser) {
    finishBrowserScan(null);
    return;
  }
  const { cancel } = await import("@tauri-apps/plugin-barcode-scanner");
  await cancel().catch(() => undefined);
};

export const scanQr = async (): Promise<string | null> => {
  try {
    if (browserScanAvailable()) return await scanWithBrowser();
    return codeScannerAvailable() ? await scanWithCodeScanner() : await scanWithCamera();
  } catch {
    return null;
  }
};
