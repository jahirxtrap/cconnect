import { siAndroid, siApple, siCentos, siFedora, siLinux, siRaspberrypi, siRedhat, siSuse, siUbuntu } from "simple-icons";

const normalize = (os: string | null | undefined) => os?.trim().toLowerCase() ?? "";

const BRANDS: Record<string, string> = {
  macos: siApple.path,
  darwin: siApple.path,
  apple: siApple.path,
  ios: siApple.path,
  android: siAndroid.path,
  ubuntu: siUbuntu.path,
  fedora: siFedora.path,
  centos: siCentos.path,
  rhel: siRedhat.path,
  redhat: siRedhat.path,
  "red-hat": siRedhat.path,
  rocky: siRedhat.path,
  almalinux: siRedhat.path,
  alma: siRedhat.path,
  opensuse: siSuse.path,
  "opensuse-leap": siSuse.path,
  "opensuse-tumbleweed": siSuse.path,
  suse: siSuse.path,
  sles: siSuse.path,
  raspbian: siRaspberrypi.path,
  raspberrypi: siRaspberrypi.path,
  "raspberry-pi": siRaspberrypi.path,
};

const COLORS: Record<string, string> = {
  windows: "#00a4ef",
  macos: "#a2aaad",
  darwin: "#a2aaad",
  apple: "#a2aaad",
  ios: "#a2aaad",
  android: "#3ddc84",
  ubuntu: "#e95420",
  debian: "#a81d33",
  fedora: "#51a2da",
  centos: "#932279",
  rhel: "#ee0000",
  redhat: "#ee0000",
  "red-hat": "#ee0000",
  rocky: "#10b981",
  almalinux: "#0fb37d",
  alma: "#0fb37d",
  opensuse: "#73ba25",
  "opensuse-leap": "#73ba25",
  "opensuse-tumbleweed": "#73ba25",
  suse: "#73ba25",
  sles: "#73ba25",
  arch: "#1793d1",
  archlinux: "#1793d1",
  manjaro: "#35bf5c",
  endeavouros: "#7f3fbf",
  linuxmint: "#87cf3e",
  mint: "#87cf3e",
  pop: "#48b9c7",
  popos: "#48b9c7",
  pop_os: "#48b9c7",
  kali: "#367bf0",
  kalilinux: "#367bf0",
  "kali-linux": "#367bf0",
  alpine: "#0d597f",
  raspbian: "#c51a4a",
  raspberrypi: "#c51a4a",
  "raspberry-pi": "#c51a4a",
  freebsd: "#ab2b28",
  openbsd: "#f2ca30",
  nixos: "#5277c3",
  nix: "#5277c3",
  gentoo: "#54487a",
  elementary: "#64baff",
  void: "#478061",
  voidlinux: "#478061",
  linux: "#fcc624",
};

const WINDOWS_PATH =
  "M0 3.449 9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801";

export const osIconPath = (os: string | null | undefined): string | null => {
  const key = normalize(os);
  if (!key) return null;
  if (key === "windows") return WINDOWS_PATH;
  return BRANDS[key] ?? siLinux.path;
};

export const osColor = (os: string | null | undefined): string | null => COLORS[normalize(os)] ?? null;
