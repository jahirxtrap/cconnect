interface AndroidInstallerBridge {
  start(url: string): void;
  status(): string;
  cancel(): void;
  canInstall(): boolean;
  requestPermission(): void;
  install(): boolean;
}

interface InstallerState {
  status: "idle" | "active" | "done" | "failed";
  bytes: number;
  total: number;
}

const POLL_INTERVAL = 300;

export const androidInstaller = (): AndroidInstallerBridge | undefined =>
  (window as unknown as { AndroidInstaller?: AndroidInstallerBridge }).AndroidInstaller;

export const trackAndroidInstall = (bridge: AndroidInstallerBridge, onProgress: (value: number) => void) =>
  new Promise<boolean>((resolve) => {
    const timer = setInterval(() => {
      let state: InstallerState;
      try {
        state = JSON.parse(bridge.status()) as InstallerState;
      } catch {
        clearInterval(timer);
        resolve(false);
        return;
      }
      if (state.total > 0) onProgress(state.bytes / state.total);
      if (state.status === "done") {
        clearInterval(timer);
        resolve(true);
      } else if (state.status === "failed" || state.status === "idle") {
        clearInterval(timer);
        resolve(false);
      }
    }, POLL_INTERVAL);
  });
