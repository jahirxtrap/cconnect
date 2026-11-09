interface AndroidPdfBridge {
  open: (url: string) => string;
  close: (id: string) => void;
  focus: (id: string, generation: number) => void;
}

interface PdfReady {
  id: string;
  base?: string;
}

export interface PdfRegion {
  page: number;
  full: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NativePdf {
  file: string;
  region: (region: PdfRegion, generation: number) => string;
  focus: (generation: number) => void;
  close: () => void;
}

interface AndroidPdfScreenBridge {
  present: (url: string, background: string) => void;
  layer: (json: string) => boolean;
  dismiss: () => void;
}

const screen = (): AndroidPdfScreenBridge | undefined =>
  (window as unknown as { AndroidPdfScreen?: AndroidPdfScreenBridge }).AndroidPdfScreen;

let presented: ((ready: boolean) => void) | null = null;

(window as unknown as { __cconnectPdfScreen?: (state: { ready: boolean }) => void }).__cconnectPdfScreen = ({ ready }) => {
  presented?.(ready);
  presented = null;
};

export const pdfScreenAvailable = () => screen() !== undefined;

export const presentPdfScreen = (url: string, background: string): Promise<boolean> =>
  new Promise((resolve) => {
    const native = screen();
    if (!native) {
      resolve(false);
      return;
    }
    presented = resolve;
    native.present(url, background);
  });

export const pdfScreenLayer = (shape: object): Promise<boolean> =>
  Promise.resolve(screen()?.layer(JSON.stringify(shape)) ?? false);

export const dismissPdfScreen = () => screen()?.dismiss();

const waiting = new Map<string, (base: string | null) => void>();

(window as unknown as { __cconnectPdf?: (ready: PdfReady) => void }).__cconnectPdf = (ready) => {
  waiting.get(ready.id)?.(ready.base ?? null);
  waiting.delete(ready.id);
};

const bridge = (): AndroidPdfBridge | undefined => (window as unknown as { AndroidPdf?: AndroidPdfBridge }).AndroidPdf;

export const nativePdfAvailable = () => bridge() !== undefined;

export const openNativePdf = (url: string): Promise<NativePdf> => {
  const pdf = bridge();
  if (!pdf) return Promise.reject(new Error("native pdf unavailable"));
  const id = pdf.open(url);
  return new Promise((resolve, reject) => {
    waiting.set(id, (base) => {
      if (base === null) {
        reject(new Error("native pdf failed"));
        return;
      }
      resolve({
        file: `${base}/file`,
        region: ({ page, full, x, y, width, height }, generation) =>
          `${base}/${page}?fw=${full}&x=${x}&y=${y}&w=${width}&h=${height}&g=${generation}`,
        focus: (generation) => pdf.focus(id, generation),
        close: () => pdf.close(id),
      });
    });
  });
};
