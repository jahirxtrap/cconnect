import { followTransfer, type TransferState } from "./androidTransfers";

interface AndroidDownloadsBridge {
  enqueue: (url: string, filename: string, headersJson: string) => string;
  cancel: (id: string) => void;
  saveAs: (url: string, filename: string, headersJson: string) => void;
  share: (url: string, filename: string, headersJson: string) => void;
  open: (url: string, filename: string, headersJson: string) => void;
  openSaved: (id: string) => boolean;
  saveData: (filename: string, base64: string) => boolean;
  shareData: (filename: string, base64: string) => void;
  shareText?: (text: string) => void;
  openData: (filename: string, base64: string) => void;
}

const followed = new Map<string, (state: TransferState) => void>();

(window as unknown as { __cconnectDownload?: (state: TransferState & { id: string }) => void }).__cconnectDownload = (
  state,
) => followed.get(state.id)?.(state);

export const androidDownloads = (): AndroidDownloadsBridge | undefined =>
  (window as unknown as { AndroidDownloads?: AndroidDownloadsBridge }).AndroidDownloads;

export const trackAndroidDownload = (
  bridge: AndroidDownloadsBridge,
  id: string,
  onProgress: (value: number) => void,
  signal: AbortSignal,
) =>
  new Promise<boolean>((resolve) => {
    const stop = (result: boolean) => {
      followed.delete(id);
      signal.removeEventListener("abort", abort);
      resolve(result);
    };
    const abort = () => {
      bridge.cancel(id);
      stop(false);
    };
    followed.set(id, followTransfer(onProgress, stop));
    signal.addEventListener("abort", abort);
  });
