<script lang="ts">
  import { settings, type DiscordPrefs } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { presenceLines } from "$lib/platform/discordPresence.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import OutlinedPanel from "$lib/ui/OutlinedPanel.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";

  interface Props {
    onDismiss: () => void;
  }

  const { onDismiss }: Props = $props();

  const FIELDS: Array<{ field: keyof DiscordPrefs; label: string }> = [
    { field: "status", label: "DISCORD_FIELD_STATUS" },
    { field: "time", label: "DISCORD_FIELD_TIME" },
    { field: "model", label: "DISCORD_FIELD_MODEL" },
    { field: "environment", label: "DISCORD_FIELD_ENVIRONMENT" },
    { field: "project", label: "DISCORD_FIELD_PROJECT" },
    { field: "chatTitle", label: "DISCORD_FIELD_CHAT_TITLE" },
    { field: "hideIdle", label: "DISCORD_FIELD_HIDE_IDLE" },
  ];

  const prefs = $derived(settings.discord);
  const preview = $derived(presenceLines());
</script>

<CompactDialog title={t("DISCORD_PRESENCE")} {onDismiss} padded={false}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CLOSE")}</Button>
  {/snippet}

  <div class="px-5">
    <SwitchRow
      title={t("DISCORD_PRESENCE")}
      summary={t("DISCORD_PRESENCE_SUMMARY")}
      checked={prefs.enabled}
      onChange={(value) => settings.setDiscord("enabled", value)}
    />
    {#if prefs.enabled}
      <OutlinedPanel class="mb-1 w-full gap-0.5">
        {#if preview}
          <p class="truncate text-body-md">{preview.details}</p>
          {#if preview.state}
            <p class="truncate text-body-sm text-on-surface-variant">{preview.state}</p>
          {/if}
        {:else}
          <p class="text-body-sm text-on-surface-variant">{t("DISCORD_PREVIEW_HIDDEN")}</p>
        {/if}
      </OutlinedPanel>
      {#each FIELDS as item (item.field)}
        <SwitchRow
          title={t(item.label)}
          checked={prefs[item.field]}
          onChange={(value) => settings.setDiscord(item.field, value)}
        />
      {/each}
    {/if}
  </div>
</CompactDialog>
