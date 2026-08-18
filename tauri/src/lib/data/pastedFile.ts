const GENERIC = /^image\.[a-z0-9]+$/i;
const ID_DIGITS = 20;

const randomId = () => {
  const digits = new Uint8Array(ID_DIGITS);
  crypto.getRandomValues(digits);
  return Array.from(digits, (value) => value % 10).join("").replace(/^0+/, "1");
};

const extensionOf = (file: File) => {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName !== file.name) return fromName.toLowerCase();
  return file.type.split("/").pop()?.toLowerCase() || "png";
};

export const pastedName = (file: File): File =>
  GENERIC.test(file.name)
    ? new File([file], `pasted-${randomId()}.${extensionOf(file)}`, { type: file.type })
    : file;
