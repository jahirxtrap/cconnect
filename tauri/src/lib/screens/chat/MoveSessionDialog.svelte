<script lang="ts">
  import { untrack } from "svelte";
  import type { ProjectInfo, SessionInfo } from "$lib/data/models";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";

  interface Props {
    session: SessionInfo;
    projects: ProjectInfo[];
    onConfirm: (cwd: string) => void;
    onDismiss: () => void;
  }

  const { session, projects, onConfirm, onDismiss }: Props = $props();

  const targets = $derived([
    ...new Set(
      projects.filter((item) => item.projectKey !== session.projectKey).flatMap((item) => (item.path ? [item.path] : [])),
    ),
  ]);

  let path = $state(untrack(() => targets[0] ?? ""));
</script>

<CompactDialog title={t("MOVE_TO_PROJECT")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={() => onConfirm(path)} enabled={!!path.trim() && path !== session.path}>
      {t("MOVE")}
    </Button>
  {/snippet}
  <div class="flex flex-col gap-2.5">
    {#if targets.length}
      <SelectField
        label={t("PROJECT")}
        selected={path}
        options={targets.map((item) => ({ value: item, label: item }))}
        onSelect={(value) => (path = value)}
      />
    {/if}
    <InputField value={path} oninput={(value) => (path = value)} singleLine label={t("MOVE_PROJECT_PATH")} />
    <p class="text-body-sm text-on-surface-variant">{t("MOVE_PROJECT_HINT")}</p>
  </div>
</CompactDialog>
