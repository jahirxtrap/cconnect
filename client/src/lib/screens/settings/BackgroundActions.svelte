<script lang="ts">
  import ImageUp from "@lucide/svelte/icons/image-up";
  import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
  import { chatBackground } from "$lib/data/chatBackground.svelte";
  import { NO_BACKGROUND } from "$lib/design/backgrounds";
  import { t } from "$lib/i18n/index.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    onAdjust: () => void;
  }

  const { onAdjust }: Props = $props();

  let picker = $state<HTMLInputElement | null>(null);

  const upload = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    chatBackground.apply(await chatBackground.upload(file), {});
    onAdjust();
  };
</script>

<TooltipIconButton label={t("UPLOAD")} onclick={() => picker?.click()}>
  <ImageUp />
</TooltipIconButton>
<TooltipIconButton
  label={t("BACKGROUND_SETTINGS")}
  enabled={chatBackground.current !== NO_BACKGROUND}
  onclick={onAdjust}
>
  <SlidersHorizontal />
</TooltipIconButton>
<input bind:this={picker} type="file" accept="image/*" onchange={(event) => void upload(event)} class="hidden" />
