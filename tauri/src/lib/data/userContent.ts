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
const SHARED_RE = /[/\\]shared[/\\](.+)$/;

const sharedPath = (mention: string): string | null => {
  const match = SHARED_RE.exec(mention.replace(/^@/, "").trim());
  return match ? match[1].replace(/\\/g, "/") : null;
};

const isMentionLine = (line: string) =>
  line.startsWith("@") && line.split(" @").every((part) => sharedPath(part) !== null);

const basename = (value: string) => value.split("/").pop() ?? value;

export const userContent = (message: ChatMessage): UserContent => {
  const media: UserAttachment[] = [];
  const files: UserAttachment[] = [];
  let body = message.text;

  const push = (path: string, url: string) => {
    const name = basename(path);
    (previewKindOf(name) === "image" ? media : files).push({ url, name });
  };

  if (message.attachments) {
    for (const path of message.attachments) push(path, downloadUrl(path));
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
          const path = sharedPath(raw);
          if (path === null) continue;
          const name = basename(path);
          const url = downloadUrl(path);
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
