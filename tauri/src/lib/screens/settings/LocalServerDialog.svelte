<script lang="ts">
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Folder from "@lucide/svelte/icons/folder";
  import PathPickerDialog from "$lib/ui/PathPickerDialog.svelte";
  import { pickPath } from "$lib/ui/pathPicker.svelte";
  import { localServer } from "$lib/services/localServer.svelte";
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

  let browsing = $state<"dir" | "file" | null>(null);

  const pick = async (directory: boolean) => {
    const mode = directory ? "dir" : "file";
    const selected = await pickPath(mode);
    if (selected === "fallback") browsing = mode;
    else if (selected) {
      if (directory) dir = selected;
      else pythonPath = selected;
    }
  };

  const info = $derived(localServer.info);

  const failure = $derived.by(() => {
    if (info.error === "bad_dir") return t("LOCAL_SERVER_BAD_DIR");
    if (info.error === "no_python") return t("LOCAL_SERVER_NO_PYTHON");
    if (info.error === "launch_failed") return t("LOCAL_SERVER_LAUNCH_FAILED");
    if (info.error === "crashed") return info.errorDetail ?? t("LOCAL_SERVER_STOPPED");
    return null;
  });

  const panel = $derived.by(() => {
    if (failure) return failure;
    const lines = [`${t("LOCAL_URL")}: http://localhost:${info.port}`];
    if (info.publicUrl) lines.push(`${t("PUBLIC_URL")}: ${info.publicUrl}`);
    if (info.token) lines.push(`${t("TOKEN")}: ${info.token}`);
    if (info.terminalKey) lines.push(`${t("TERMINAL_KEY")}: ${info.terminalKey}`);
    return lines.join("\n");
  });

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
  <div class="flex flex-col gap-2">
    <InputField value={dir} oninput={(value) => (dir = value)} label={t("LOCAL_SERVER_FOLDER")} singleLine>
      {#snippet trailing()}
        <TooltipIconButton label={t("CHOOSE")} onclick={() => void pick(true)} class="size-6 [&_svg]:size-[18px]">
          <Folder />
        </TooltipIconButton>
      {/snippet}
    </InputField>

    <SelectField
      label={t("PYTHON")}
      selected={python}
      options={PYTHON_OPTIONS}
      onSelect={(value) => (python = value)}
    />

    {#if python === "custom"}
      <InputField
        value={pythonPath}
        oninput={(value) => (pythonPath = value)}
        label={t("PYTHON_PATH")}
        singleLine
      >
        {#snippet trailing()}
          <TooltipIconButton label={t("CHOOSE")} onclick={() => void pick(false)} class="size-6 [&_svg]:size-[18px]">
            <Folder />
          </TooltipIconButton>
        {/snippet}
      </InputField>
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

    {#if panel}
      <p
        class="selectable mt-1 rounded-md border-2 px-2.5 py-2 font-mono text-body-sm wrap-anywhere whitespace-pre-wrap {failure
          ? 'border-red text-red'
          : 'border-outline-variant text-on-surface'}"
      >{panel}</p>
    {/if}
  </div>
</CompactDialog>

{#if browsing}
  {@const mode = browsing}
  <PathPickerDialog
    {mode}
    start={mode === "dir" ? dir : pythonPath}
    onConfirm={(chosen) => {
      if (mode === "dir") dir = chosen;
      else pythonPath = chosen;
      browsing = null;
    }}
    onDismiss={() => (browsing = null)}
  />
{/if}
