<script lang="ts">
  import { navigation, type Route } from "$lib/app/navigation.svelte";
  import Screen from "$lib/app/Screen.svelte";
  import { chatList } from "$lib/data/chatList.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { theme } from "$lib/design/theme.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import ChatScreen from "$lib/screens/chat/ChatScreen.svelte";
  import SettingsScreen from "$lib/screens/settings/SettingsScreen.svelte";

  theme.start();
  layout.start();
  navigation.start();
  chatList.start();
  serverStatus.start();

  const TITLES: Record<Exclude<Route, "/" | "/settings">, string> = {
    "/files": "FILES",
    "/claude": "CLAUDE",
    "/monitor": "MONITOR",
    "/terminal": "TERMINAL",
    "/markdown": "MARKDOWN",
  };
</script>

<svelte:window
  onkeydown={(event) => {
    if (event.key === "Escape" && navigation.route !== "/") navigation.back();
  }}
/>

<div class="h-full bg-background text-on-background">
  {#if navigation.route === "/"}
    <ChatScreen />
  {:else if navigation.route === "/settings"}
    <SettingsScreen />
  {:else}
    <Screen title={t(TITLES[navigation.route])} />
  {/if}
</div>
