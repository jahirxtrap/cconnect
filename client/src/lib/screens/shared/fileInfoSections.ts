import { formatDecimal, formatSize, formatUnit } from "$lib/data/format";
import { formatDateTime, formatMediaTime, MILLIS_PER_SECOND, parseIsoMillis } from "$lib/data/time";
import { plural, t } from "$lib/i18n/index.svelte";
import type { AudioStream, FileInfo, ImageInfo, MediaInfo, MediaTag, PdfInfo, VideoStream } from "$lib/services/fileInfo";

export interface InfoLine {
  label: string;
  value: string;
}

export interface InfoSection {
  title: string;
  lines: InfoLine[];
}

const BITS_PER_KILOBIT = 1000;
const HERTZ_PER_KILOHERTZ = 1000;
const MONO = 1;
const STEREO = 2;
const COORDINATE_DECIMALS = 5;

const TAG_LABELS: Record<MediaTag, string> = {
  title: "FILE_INFO_TITLE",
  artist: "FILE_INFO_ARTIST",
  album: "FILE_INFO_ALBUM",
  album_artist: "FILE_INFO_ALBUM_ARTIST",
  genre: "FILE_INFO_GENRE",
  date: "FILE_INFO_DATE",
  track: "FILE_INFO_TRACK",
  composer: "FILE_INFO_COMPOSER",
};

const line = (key: string, value: string | number | null | undefined): InfoLine[] =>
  value === null || value === undefined || value === "" ? [] : [{ label: t(key), value: String(value) }];

const section = (key: string, lines: InfoLine[][]): InfoSection[] => {
  const flat = lines.flat();
  return flat.length ? [{ title: t(key), lines: flat }] : [];
};

const isoDate = (value: string | null) => {
  const millis = value ? parseIsoMillis(value) : null;
  return millis === null ? null : formatDateTime(millis);
};

const dimensions = (width: number | null, height: number | null) =>
  width && height ? t("FILE_INFO_DIMENSIONS_VALUE", width, height) : null;

const bitrate = (bits: number | null) => (bits ? formatUnit(bits / BITS_PER_KILOBIT, "kilobit-per-second") : null);

const exposure = (seconds: number | null) =>
  seconds
    ? t("FILE_INFO_EXPOSURE_VALUE", seconds < 1 ? `1/${Math.round(1 / seconds)}` : formatDecimal(seconds, 1, 0))
    : null;

const channels = (count: number | null) =>
  count === MONO
    ? t("FILE_INFO_MONO")
    : count === STEREO
      ? t("FILE_INFO_STEREO")
      : count
        ? plural("FILE_INFO_CHANNEL_COUNT", count)
        : null;

const fileLines = (info: FileInfo) => [
  line("FILE_INFO_TYPE", info.mime),
  line("FILE_INFO_SIZE", info.size === null ? null : formatSize(info.size)),
  line("FILE_INFO_MODIFIED", info.modified === null ? null : formatDateTime(info.modified * MILLIS_PER_SECOND)),
];

const imageSections = (image: ImageInfo) => [
  ...section("FILE_INFO_IMAGE", [
    line("FILE_INFO_DIMENSIONS", dimensions(image.width, image.height)),
    line("FORMAT", image.format),
    line("FILE_INFO_COLOR_MODE", image.mode),
    line("FILE_INFO_FRAMES", image.frames),
    line("FILE_INFO_RESOLUTION", image.dpi ? t("FILE_INFO_DPI_VALUE", image.dpi) : null),
  ]),
  ...section("FILE_INFO_CAMERA", [
    line("FILE_INFO_MODEL", image.camera),
    line("FILE_INFO_LENS", image.lens),
    line("FILE_INFO_TAKEN", isoDate(image.taken)),
    line("FILE_INFO_EXPOSURE", exposure(image.exposure)),
    line("FILE_INFO_APERTURE", image.aperture ? `f/${formatDecimal(image.aperture, 1, 0)}` : null),
    line("FILE_INFO_ISO", image.iso),
    line("FILE_INFO_FOCAL_LENGTH", image.focalLength ? formatUnit(image.focalLength, "millimeter", 1) : null),
    line("FILE_INFO_SOFTWARE", image.software),
    line(
      "FILE_INFO_LOCATION",
      image.location
        ? `${formatDecimal(image.location.latitude, COORDINATE_DECIMALS)}, ${formatDecimal(image.location.longitude, COORDINATE_DECIMALS)}`
        : null,
    ),
  ]),
];

const videoLines = (media: MediaInfo, video: VideoStream) => [
  line("FILE_INFO_DURATION", media.duration === null ? null : formatMediaTime(media.duration)),
  line("FILE_INFO_DIMENSIONS", dimensions(video.width, video.height)),
  line("FILE_INFO_FRAME_RATE", video.fps ? t("FILE_INFO_FPS_VALUE", formatDecimal(video.fps, 2, 0)) : null),
  line("FILE_INFO_CODEC", video.codec),
  line("FILE_INFO_BITRATE", bitrate(video.bitrate)),
  line("FILE_INFO_CONTAINER", media.container),
];

const audioLines = (audio: AudioStream) => [
  line("FILE_INFO_CODEC", audio.codec),
  line(
    "FILE_INFO_SAMPLE_RATE",
    audio.sampleRate ? t("FILE_INFO_KHZ_VALUE", formatDecimal(audio.sampleRate / HERTZ_PER_KILOHERTZ, 1, 0)) : null,
  ),
  line("FILE_INFO_CHANNELS", channels(audio.channels)),
  line("FILE_INFO_BITRATE", bitrate(audio.bitrate)),
];

const mediaSections = (media: MediaInfo) => [
  ...(media.video ? section("FILE_INFO_VIDEO", videoLines(media, media.video)) : []),
  ...section(
    "FILE_INFO_AUDIO",
    media.video
      ? media.audio
        ? audioLines(media.audio)
        : []
      : [
          line("FILE_INFO_DURATION", media.duration === null ? null : formatMediaTime(media.duration)),
          ...(media.audio ? audioLines(media.audio) : []),
          line("FILE_INFO_CONTAINER", media.container),
        ],
  ),
  ...section(
    "FILE_INFO_TAGS",
    (Object.keys(TAG_LABELS) as MediaTag[]).map((tag) => line(TAG_LABELS[tag], media.tags[tag])),
  ),
];

const pdfSections = (pdf: PdfInfo) =>
  section("FILE_INFO_DOCUMENT", [
    line("FILE_INFO_PAGES", pdf.pages),
    line("FILE_INFO_TITLE", pdf.title),
    line("FILE_INFO_AUTHOR", pdf.author),
    line("FILE_INFO_SUBJECT", pdf.subject),
    line("FILE_INFO_CREATED", isoDate(pdf.created)),
    line("FILE_INFO_MODIFIED", isoDate(pdf.modified)),
    line("FILE_INFO_CREATOR", pdf.creator),
    line("FILE_INFO_PRODUCER", pdf.producer),
    line("VERSION", pdf.version),
    line("FILE_INFO_ENCRYPTED", pdf.encrypted ? t("YES") : t("NO")),
  ]);

export const fileInfoSections = (info: FileInfo): InfoSection[] => [
  ...section("FILE_INFO_FILE", fileLines(info)),
  ...(info.image ? imageSections(info.image) : []),
  ...(info.media ? mediaSections(info.media) : []),
  ...(info.pdf ? pdfSections(info.pdf) : []),
];
