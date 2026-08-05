import { isTauri } from "$lib/platform";

const isMobile = () => isTauri && /android|iphone|ipad/i.test(navigator.userAgent);

export const nativeScanAvailable = () => isMobile();

export const browserScanAvailable = () =>
  "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;

export const qrScanAvailable = () => nativeScanAvailable() || browserScanAvailable();

export const scanNative = async (): Promise<string | null> => {
  try {
    const { scan, Format, requestPermissions, checkPermissions } = await import(
      "@tauri-apps/plugin-barcode-scanner"
    );
    const state = await checkPermissions();
    if (state !== "granted" && (await requestPermissions()) !== "granted") return null;
    const result = await scan({ windowed: false, formats: [Format.QRCode] });
    return result.content || null;
  } catch {
    return null;
  }
};
