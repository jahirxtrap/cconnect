<script lang="ts">
  import BatteryCharging from "@lucide/svelte/icons/battery-charging";
  import Bell from "@lucide/svelte/icons/bell";
  import Minimize2 from "@lucide/svelte/icons/minimize-2";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { isDesktop } from "$lib/platform";
  import { androidBackground } from "$lib/platform/androidBackground";
  import { notifier } from "$lib/services/notifier.svelte";
  import CompactSwitch from "$lib/ui/CompactSwitch.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import NotificationsDialog from "./NotificationsDialog.svelte";

  let dialogOpen = $state(false);
  let batteryIgnored = $state(androidBackground()?.batteryOptimizationIgnored() ?? false);

  const activeNotifications = $derived(
    [settings.notifyInteraction, settings.notifyTaskDone].filter(Boolean).length,
  );

  $effect(() => {
    const bridge = androidBackground();
    if (!bridge) return;
    const refresh = () => (batteryIgnored = bridge.batteryOptimizationIgnored());
    const target = window as unknown as { __cconnectResume?: () => void };
    target.__cconnectResume = refresh;
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      delete target.__cconnectResume;
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  });
</script>

<SettingsGroup label={t("BACKGROUND_GROUP")}>
  <PreferenceRow
    icon={Bell}
    title={t("NOTIFICATIONS")}
    summary={notifier.granted ? t("NOTIFICATIONS_STATE", activeNotifications) : t("NOTIFICATIONS_DISABLED")}
    onclick={() => (dialogOpen = true)}
  />
  {#if androidBackground()}
    <PreferenceRow
      icon={BatteryCharging}
      title={t("BATTERY_OPTIMIZATION")}
      summary={t("BATTERY_OPTIMIZATION_SUMMARY")}
      onclick={() => androidBackground()?.requestIgnoreBatteryOptimization()}
    >
      {#snippet trailing()}
        <CompactSwitch
          checked={batteryIgnored}
          onCheckedChange={() => androidBackground()?.requestIgnoreBatteryOptimization()}
        />
      {/snippet}
    </PreferenceRow>
  {/if}
  {#if isDesktop}
    <PreferenceRow
      icon={Minimize2}
      title={t("MINIMIZE_TO_TRAY")}
      summary={t("MINIMIZE_TO_TRAY_SUMMARY")}
      onclick={() => (settings.minimizeToTray = !settings.minimizeToTray)}
    >
      {#snippet trailing()}
        <CompactSwitch
          checked={settings.minimizeToTray}
          onCheckedChange={(value) => (settings.minimizeToTray = value)}
        />
      {/snippet}
    </PreferenceRow>
  {/if}
</SettingsGroup>

{#if dialogOpen}
  <NotificationsDialog onDismiss={() => (dialogOpen = false)} />
{/if}
