<script lang="ts">
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Folder from "@lucide/svelte/icons/folder";
  import { isTauri } from "$lib/platform";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    onDismiss: () => void;
  }

  const { onDismiss }: Props = $props();

  let dir = $state(settings.localServerDir);
  let python = $state(settings.localServerPython);
  let pythonPath = $state(settings.localServerPythonPath);
  let mode = $state(settings.localServerMode);
  let publicHost = $state(settings.localServerPublicHost);

  const PYTHON_OPTIONS = [
    { value: "auto", label: t("PYTHON_AUTO") },
    { value: "system", label: t("PYTHON_SYSTEM") },
    { value: "custom", label: t("PYTHON_CUSTOM") },
  ];

  const MODE_OPTIONS = [
    { value: "local", label: t("MODE_LOCAL") },
    { value: "tailscale", label: t("MODE_TAILSCALE") },
    { value: "caddy", label: t("MODE_CADDY") },
  ];

  const pick = async (directory: boolean) => {
    if (!isTauri) return;
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({ directory, multiple: false });
    if (typeof selected !== "string") return;
    if (directory) dir = selected;
    else pythonPath = selected;
  };

  const save = () => {
    settings.localServerDir = dir.trim();
    settings.localServerPython = python;
    settings.localServerPythonPath = pythonPath.trim();
    settings.localServerMode = mode;
    settings.localServerPublicHost = publicHost.trim();
    onDismiss();
  };
</script>

<CompactDialog title={t("LOCAL_SERVER")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={save}>{t("SAVE")}</Button>
  {/snippet}
  <div class="flex flex-col gap-3">
    <div class="flex items-end gap-2">
      <div class="min-w-0 flex-1">
        <InputField value={dir} oninput={(value) => (dir = value)} label={t("LOCAL_SERVER_FOLDER")} singleLine />
      </div>
      <TooltipIconButton label={t("CHOOSE")} onclick={() => void pick(true)}>
        <Folder size={20} />
      </TooltipIconButton>
    </div>

    <SelectField
      label={t("PYTHON")}
      selected={python}
      options={PYTHON_OPTIONS}
      onSelect={(value) => (python = value)}
    />

    {#if python === "custom"}
      <div class="flex items-end gap-2">
        <div class="min-w-0 flex-1">
          <InputField
            value={pythonPath}
            oninput={(value) => (pythonPath = value)}
            label={t("PYTHON_PATH")}
            singleLine
          />
        </div>
        <TooltipIconButton label={t("CHOOSE")} onclick={() => void pick(false)}>
          <Folder size={20} />
        </TooltipIconButton>
      </div>
    {/if}

    <SelectField label={t("RUN_MODE")} selected={mode} options={MODE_OPTIONS} onSelect={(value) => (mode = value)} />

    {#if mode === "caddy"}
      <InputField
        value={publicHost}
        oninput={(value) => (publicHost = value)}
        label={t("PUBLIC_HOST")}
        singleLine
      />
    {/if}
  </div>
</CompactDialog>
