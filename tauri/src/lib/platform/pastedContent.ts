/** Files the Android host hands over when the system takes the paste before the page can see it:
 *  a <textarea> only accepts plain text, so media never reaches a `paste` event there. The native
 *  side reads it and calls back here. Nothing to do on the other platforms. */
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
  host.__cconnectPaste = (payload: string) => {
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
  return () => {
    delete host.__cconnectPaste;
  };
};
