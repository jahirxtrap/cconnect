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
  import OutputPanel from "$lib/ui/OutputPanel.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    onDismiss: () => void;
  }

  const { onDismiss }: Props = $props();

  let source = $state(settings.localServerSource);
  let commandPath = $state(settings.localServerCommandPath);
  let dir = $state(settings.localServerDir);
  let python = $state(settings.localServerPython);
  let pythonPath = $state(settings.localServerPythonPath);
  let mode = $state(settings.localServerMode);
  let publicHost = $state(settings.localServerPublicHost);

  type Target = "dir" | "python" | "command";

  const SOURCE_OPTIONS = [
    { value: "native", label: t("LOCAL_SERVER_NATIVE") },
    { value: "python", label: t("LOCAL_SERVER_REPOSITORY") },
  ];

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

  let browsing = $state<Target | null>(null);

  const apply = (target: Target, chosen: string) => {
    if (target === "dir") dir = chosen;
    else if (target === "python") pythonPath = chosen;
    else commandPath = chosen;
  };

  const pick = async (target: Target) => {
    const selected = await pickPath(target === "dir" ? "dir" : "file");
    if (selected === "fallback") browsing = target;
    else if (selected) apply(target, selected);
  };

  const info = $derived(localServer.info);

  const failure = $derived.by(() => {
    if (info.error === "bad_dir") return t("LOCAL_SERVER_BAD_DIR");
    if (info.error === "no_python") return t("LOCAL_SERVER_NO_PYTHON");
    if (info.error === "no_command") return t("LOCAL_SERVER_NO_COMMAND");
    if (info.error === "launch_failed") return t("LOCAL_SERVER_LAUNCH_FAILED");
    if (info.error === "port_busy") return t("LOCAL_SERVER_PORT_BUSY", info.port);
    if (info.error === "mode_mismatch") return t("LOCAL_SERVER_MODE_MISMATCH");
    if (info.error === "crashed") return info.errorDetail ?? t("LOCAL_SERVER_STOPPED");
    return null;
  });

  const panel = $derived.by(() => {
    if (failure) return failure;
    const lines = [`${t("LOCAL_URL")}: http://localhost:${info.port}`];
    if (info.publicUrl) lines.push(`${t("PUBLIC_URL")}: ${info.publicUrl}`);
    if (info.token) lines.push(`${t("TOKEN")}: ${info.token}`);
    if (info.securityKey) lines.push(`${t("SECURITY_KEY")}: ${info.securityKey}`);
    return lines.join("\n");
  });

  const save = () => {
    settings.localServerSource = source;
    settings.localServerCommandPath = commandPath.trim();
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
    <SelectField
      label={t("LOCAL_SERVER_SOURCE")}
      selected={source}
      options={SOURCE_OPTIONS}
      onSelect={(value) => (source = value)}
    />

    {#if source === "native"}
      <InputField
        value={commandPath}
        oninput={(value) => (commandPath = value)}
        label={t("COMMAND_PATH")}
        placeholder={t("COMMAND_PATH_AUTO")}
        singleLine
      >
        {#snippet trailing()}
          <TooltipIconButton label={t("CHOOSE")} onclick={() => void pick("command")} class="size-6 [&_svg]:size-[18px]">
            <Folder />
          </TooltipIconButton>
        {/snippet}
      </InputField>
    {:else}
      <InputField value={dir} oninput={(value) => (dir = value)} label={t("LOCAL_SERVER_FOLDER")} singleLine>
        {#snippet trailing()}
          <TooltipIconButton label={t("CHOOSE")} onclick={() => void pick("dir")} class="size-6 [&_svg]:size-[18px]">
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
            <TooltipIconButton label={t("CHOOSE")} onclick={() => void pick("python")} class="size-6 [&_svg]:size-[18px]">
              <Folder />
            </TooltipIconButton>
          {/snippet}
        </InputField>
      {/if}
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
      <OutputPanel text={panel} failure={failure !== null} class="mt-1" />
    {/if}
  </div>
</CompactDialog>

{#if browsing}
  {@const target = browsing}
  <PathPickerDialog
    mode={target === "dir" ? "dir" : "file"}
    start={target === "dir" ? dir : target === "python" ? pythonPath : commandPath}
    onConfirm={(chosen) => {
      apply(target, chosen);
      browsing = null;
    }}
    onDismiss={() => (browsing = null)}
  />
{/if}
