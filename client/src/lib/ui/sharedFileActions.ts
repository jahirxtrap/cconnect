import Download from "@lucide/svelte/icons/download";
import ExternalLink from "@lucide/svelte/icons/external-link";
import Save from "@lucide/svelte/icons/save";
import Share2 from "@lucide/svelte/icons/share-2";
import { downloadShared, openSharedExternally, saveSharedAs, shareShared } from "$lib/services/sharedFiles";
import type { IconSource } from "./icons";

export interface SharedFileAction {
  label: string;
  icon: IconSource;
  run: (url: string, filename: string) => unknown;
}

export const SHARED_FILE_ACTIONS: readonly SharedFileAction[] = [
  { label: "SAVE", icon: Download, run: downloadShared },
  { label: "SAVE_AS", icon: Save, run: saveSharedAs },
  { label: "OPEN_EXTERNALLY", icon: ExternalLink, run: openSharedExternally },
  { label: "SHARE", icon: Share2, run: shareShared },
];
