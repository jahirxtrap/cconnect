<script lang="ts">
  import Eraser from "@lucide/svelte/icons/eraser";
  import { untrack } from "svelte";
  import { projectLabel, type ProjectInfo } from "$lib/data/models";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    projects: ProjectInfo[];
    prompts: Record<string, string>;
    initialProject: string;
    onSave: (project: string, text: string) => void;
    onDismiss: () => void;
  }

  const { projects, prompts, initialProject, onSave, onDismiss }: Props = $props();

  const MIN_LINES = 6;

  let project = $state(untrack(() => initialProject));
  let text = $state(untrack(() => prompts[initialProject] ?? ""));

  const options = $derived(
    projects.map((item) => ({ value: item.projectKey, label: projectLabel(item) })),
  );

  const choose = (next: string) => {
    project = next;
    text = prompts[next] ?? "";
  };
</script>

<CompactDialog title={t("PROJECT_PROMPT")} {onDismiss}>
  {#snippet titleTrailing()}
    <TooltipIconButton label={t("CLEAR")} enabled={!!text} onclick={() => (text = "")}>
      <Eraser />
    </TooltipIconButton>
  {/snippet}
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={() => onSave(project, text)}>{t("SAVE")}</Button>
  {/snippet}
  <SelectField label={t("PROJECT")} selected={project} {options} onSelect={choose} />
  <p class="mt-2.5 text-body-sm text-on-surface-variant">{t("PROJECT_PROMPT_SUMMARY")}</p>
  <div class="mt-2.5">
    <InputField value={text} oninput={(value) => (text = value)} minLines={MIN_LINES} />
  </div>
</CompactDialog>
