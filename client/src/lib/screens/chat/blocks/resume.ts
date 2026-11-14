import Play from "@lucide/svelte/icons/play";
import RotateCw from "@lucide/svelte/icons/rotate-cw";
import type { Resume } from "$lib/data/chatModels";
import type { IconSource } from "$lib/ui/icons";

export const RESUME_LOOK: Record<Resume, { label: string; prompt: string; icon: IconSource }> = {
  continue: { label: "CONTINUE", prompt: "CONTINUE_PROMPT", icon: Play },
  retry: { label: "RETRY", prompt: "RETRY_PROMPT", icon: RotateCw },
};
