interface AndroidQrScanBridge {
  isAvailable(): boolean;
  scan(): void;
}

export const androidQrScan = (): AndroidQrScanBridge | undefined =>
  (window as unknown as { AndroidQrScan?: AndroidQrScanBridge }).AndroidQrScan;
