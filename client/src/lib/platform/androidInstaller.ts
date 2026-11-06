import { followTransfer, type TransferState } from "./androidTransfers";

interface AndroidInstallerBridge {
  start(url: string): void;
  cancel(): void;
  canInstall(): boolean;
  requestPermission(): void;
  install(): boolean;
}

type InstallHook = { __cconnectInstall?: (state: TransferState) => void };

export const androidInstaller = (): AndroidInstallerBridge | undefined =>
  (window as unknown as { AndroidInstaller?: AndroidInstallerBridge }).AndroidInstaller;

export const trackAndroidInstall = (bridge: AndroidInstallerBridge, url: string, onProgress: (value: number) => void) =>
  new Promise<boolean>((resolve) => {
    const hook = window as unknown as InstallHook;
    hook.__cconnectInstall = followTransfer(onProgress, (done) => {
      hook.__cconnectInstall = undefined;
      resolve(done);
    });
    bridge.start(url);
  });
