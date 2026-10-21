<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import type { PluginOption } from "$lib/services/claudeApi";
  import Button from "$lib/ui/Button.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import LinearProgress from "$lib/ui/LinearProgress.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";

  interface Props {
    title: string;
    fields: PluginOption[] | null;
    busy: boolean;
    onConfirm: (values: Record<string, string>) => void;
    onDismiss: () => void;
  }

  const { title, fields, busy, onConfirm, onDismiss }: Props = $props();

  let values = $state<Record<string, string>>({});

  const valueOf = (field: PluginOption) => values[field.key] ?? field.value;

  const changed = $derived(
    Object.fromEntries(
      (fields ?? [])
        .filter((field) => valueOf(field) !== field.value && !(field.secret && !valueOf(field)))
        .map((field) => [field.key, valueOf(field).trim()]),
    ),
  );

  const missing = (field: PluginOption) => field.required && !field.configured && !valueOf(field).trim();

  const invalid = (field: PluginOption) => {
    const raw = valueOf(field).trim();
    if (!raw || field.type !== "number") return false;
    const value = Number(raw);
    return Number.isNaN(value) || (field.min !== null && value < field.min) || (field.max !== null && value > field.max);
  };

  const ready = $derived(
    !busy &&
      fields !== null &&
      Object.keys(changed).length > 0 &&
      !fields.some((field) => missing(field) || invalid(field)),
  );
</script>

<CompactDialog {title} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button enabled={ready} onclick={() => onConfirm(changed)}>{t("SAVE")}</Button>
  {/snippet}
  {#if !fields}
    <CenteredProgress class="py-6" />
  {:else}
    <div class="flex flex-col gap-3.5">
      {#if busy}
        <LinearProgress />
      {/if}
      {#each fields as field (field.key)}
        {#if field.type === "boolean"}
          <SwitchRow
            title={field.title}
            summary={field.description}
            required={field.required}
            checked={valueOf(field) === "true"}
            onChange={(checked) => (values[field.key] = String(checked))}
          />
        {:else}
          <div class="flex flex-col gap-1.5">
            {#if field.choices.length}
              <SelectField
                label={field.title}
                selected={valueOf(field)}
                options={field.choices.map((choice) => ({ value: choice, label: choice }))}
                onSelect={(value) => (values[field.key] = value)}
              />
            {:else}
              <InputField
                label={field.title}
                value={valueOf(field)}
                required={field.required}
                secret={field.secret}
                numeric={field.type === "number"}
                placeholder={field.secret && field.configured ? t("PLUGIN_OPTION_KEPT") : (field.default ?? undefined)}
                singleLine
                error={invalid(field) ? t("INVALID_VALUE") : null}
                oninput={(value) => (values[field.key] = value)}
              />
            {/if}
            {#if field.description}
              <p class="text-body-sm text-on-surface-variant">{field.description}</p>
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</CompactDialog>
