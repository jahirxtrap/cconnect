import { previewKindOf } from "./previewKind";
import { downloadUrl } from "$lib/services/sharedApi";
import type { ChatMessage } from "./chatModels";

export interface UserAttachment {
  url: string;
  name: string;
}

export interface UserContent {
  body: string;
  attachments: UserAttachment[];
}

const IMAGE_MARKER_RE = /\[Image #\d+\]/g;
const UPLOADS = "uploads";

const isMentionLine = (line: string) =>
  line.startsWith("@") && (line.includes("shared/uploads/") || line.includes("shared\\uploads\\"));

const basename = (value: string) => value.split("/").pop()?.split("\\").pop() ?? value;

export const userContent = (message: ChatMessage): UserContent => {
  const media: UserAttachment[] = [];
  const files: UserAttachment[] = [];
  let body = message.text;

  const push = (name: string, url: string) => {
    (previewKindOf(name) === "image" ? media : files).push({ url, name });
  };

  if (message.attachments) {
    for (const name of message.attachments) push(name, downloadUrl(`${UPLOADS}/${name}`));
    body = body
      .split("\n")
      .filter((line) => !isMentionLine(line))
      .join("\n");
  } else if (body.includes("@")) {
    const images = message.images ?? [];
    let imageIndex = 0;
    body = body
      .split("\n")
      .filter((line) => {
        if (!isMentionLine(line)) return true;
        for (const raw of line.split(" @")) {
          const name = basename(raw.replace(/^@/, ""));
          const url = downloadUrl(`${UPLOADS}/${name}`);
          if (previewKindOf(name) === "image") {
            const fallback = images[imageIndex];
            imageIndex++;
            media.push({ url: fallback ? `${url}?fb=${encodeURIComponent(fallback)}` : url, name });
          } else {
            files.push({ url, name });
          }
        }
        return false;
      })
      .join("\n");
  }

  return { body: body.replace(IMAGE_MARKER_RE, "").trim(), attachments: [...media, ...files] };
};
