interface PastedFile {
  name: string;
  mime: string;
  data: string;
}

const decode = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return buffer;
};

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
      (item) => new File([decode(item.data)], item.name, { type: item.mime }),
    );
    if (files.length) handler(files);
  };
  host.__cconnectPaste = listener;
  return () => {
    if (host.__cconnectPaste === listener) delete host.__cconnectPaste;
  };
};
