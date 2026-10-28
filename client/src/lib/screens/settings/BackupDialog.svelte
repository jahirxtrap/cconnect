<script lang="ts">
  import { exportSettings } from "$lib/data/backup";
  import { chatBackground } from "$lib/data/chatBackground.svelte";
  import { packs } from "$lib/design/packs/registry.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { copyText } from "$lib/platform/clipboard";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ErrorText from "$lib/ui/ErrorText.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";

  interface Props {
    mode: "export" | "import";
    onImport?: (raw: string) => boolean;
    onDismiss: () => void;
  }

  const { mode, onImport, onDismiss }: Props = $props();

  const TITLES = { export: "EXPORT_SETTINGS", import: "IMPORT_SETTINGS" } as const;

  const LINES = 10;

  let draft = $state("");
  let failed = $state(false);
  let notes = $state(false);
  let background = $state(false);
  let withPacks = $state(false);
  let payload = $state("");

  $effect(() => {
    if (mode !== "export") return;
    let current = true;
    void exportSettings({ notes, background, packs: withPacks }).then((text) => {
      if (current) payload = text;
    });
    return () => {
      current = false;
    };
  });
</script>

<CompactDialog title={t(TITLES[mode])} {onDismiss}>
  {#snippet buttons()}
    {#if mode === "export"}
      <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
      <Button onclick={() => void copyText(payload)}>{t("COPY")}</Button>
    {:else}
      <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
      <Button
        enabled={!!draft.trim()}
        onclick={() => {
          if (onImport?.(draft.trim())) onDismiss();
          else failed = true;
        }}>{t("ACCEPT")}</Button
      >
    {/if}
  {/snippet}

  <div class="flex w-full flex-col gap-2">
    {#if mode !== "import"}
      <p class="text-body-sm text-on-surface-variant">{t("EXPORT_SETTINGS_WARNING")}</p>
      <div>
        <SwitchRow title={t("INCLUDE_NOTES")} checked={notes} onChange={(value) => (notes = value)} />
        {#if chatBackground.uploads.length}
          <SwitchRow title={t("INCLUDE_BACKGROUND")} checked={background} onChange={(value) => (background = value)} />
        {/if}
        {#if packs.installed.length}
          <SwitchRow title={t("INCLUDE_PACKS")} checked={withPacks} onChange={(value) => (withPacks = value)} />
        {/if}
      </div>
      <InputField value={payload} oninput={() => {}} minLines={LINES} maxLines={LINES} />
    {:else}
      <p class="text-body-sm text-on-surface-variant">{t("IMPORT_SETTINGS_HINT")}</p>
      <InputField
        value={draft}
        oninput={(value) => {
          draft = value;
          failed = false;
        }}
        minLines={LINES}
        maxLines={LINES}
        autofocus
      />
      {#if failed}
        <ErrorText text={t("IMPORT_SETTINGS_FAILED")} class="-mt-0.5" />
      {/if}
    {/if}
  </div>
</CompactDialog>
