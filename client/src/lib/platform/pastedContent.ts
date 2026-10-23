import { decodeBase64 } from "$lib/data/base64";

interface PastedFile {
  name: string;
  mime: string;
  data: string;
}


type Host = { __cconnectPaste?: (payload: string) => void };

export const onNativePaste = (handler: (files: File[]) => void): (() => void) => {
  const host = window as unknown as Host;
  const listener = (payload: string) => {
    let items: PastedFile[];
    try {
      items = JSON.parse(payload) as PastedFile[];
    } catch {
      return;
    }
    const files = items.map(
      (item) => new File([decodeBase64(item.data)], item.name, { type: item.mime }),
    );
    if (files.length) handler(files);
  };
  host.__cconnectPaste = listener;
  return () => {
    if (host.__cconnectPaste === listener) delete host.__cconnectPaste;
  };
};
