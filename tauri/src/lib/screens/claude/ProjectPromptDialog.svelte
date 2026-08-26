<script lang="ts">
  import Eraser from "@lucide/svelte/icons/eraser";
  import { untrack } from "svelte";
  import { projectLabel, type ProjectInfo } from "$lib/data/models";
  import { t } from "$lib/i18n/index.svelte";
  import { claudeApi } from "$lib/services/claudeApi";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    projects: ProjectInfo[];
    initialProject: string;
    onSave: (project: string, text: string) => void;
    onDismiss: () => void;
  }

  const { projects, initialProject, onSave, onDismiss }: Props = $props();

  const MIN_LINES = 6;

  let project = $state(untrack(() => initialProject));
  let text = $state("");

  const options = $derived(
    projects.map((item) => ({ value: item.projectKey, label: projectLabel(item) })),
  );

  $effect(() => {
    const current = project;
    void claudeApi.projectPrompt(current).then((value) => {
      if (project === current) text = value ?? "";
    });
  });
</script>

<CompactDialog title={t("PROJECT_PROMPT")} {onDismiss}>
  {#snippet titleTrailing()}
    <TooltipIconButton label={t("CLEAR")} enabled={!!text} onclick={() => (text = "")}>
      <Eraser size={20} />
    </TooltipIconButton>
  {/snippet}
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={() => onSave(project, text)}>{t("SAVE")}</Button>
  {/snippet}
  <SelectField label={t("PROJECT")} selected={project} {options} onSelect={(value) => (project = value)} />
  <p class="mt-2.5 text-body-sm text-on-surface-variant">{t("PROJECT_PROMPT_SUMMARY")}</p>
  <div class="mt-2.5">
    <InputField value={text} oninput={(value) => (text = value)} minLines={MIN_LINES} />
  </div>
</CompactDialog>
