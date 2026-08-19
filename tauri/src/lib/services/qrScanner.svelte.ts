import { isTauri } from "$lib/platform";
import { androidQrScan } from "$lib/platform/androidQrScan";

const isMobile = () => isTauri && /android|iphone|ipad/i.test(navigator.userAgent);

export const qrScanAvailable = () => isMobile();

const codeScannerAvailable = () => {
  try {
    return androidQrScan()?.isAvailable() ?? false;
  } catch {
    return false;
  }
};

export const cameraScan = $state({ active: false });

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
  const { cancel } = await import("@tauri-apps/plugin-barcode-scanner");
  await cancel().catch(() => undefined);
};

export const scanQr = async (): Promise<string | null> => {
  try {
    return codeScannerAvailable() ? await scanWithCodeScanner() : await scanWithCamera();
  } catch {
    return null;
  }
};
