<script lang="ts">
  import { navigation } from "$lib/app/navigation.svelte";
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
  chatList.start();
  serverStatus.start();

  const TITLES = {
    settings: "SETTINGS",
    explorer: "FILES",
    claude: "CLAUDE",
    monitor: "MONITOR",
    terminal: "TERMINAL",
    markdown: "MARKDOWN",
  } as const;
</script>

<svelte:window
  onkeydown={(event) => {
    if (event.key === "Escape" && navigation.route !== "chat") navigation.back();
  }}
/>

<div class="h-full bg-background text-on-background">
  {#if navigation.route === "chat"}
    <ChatScreen />
  {:else if navigation.route === "settings"}
    <SettingsScreen />
  {:else}
    <Screen title={t(TITLES[navigation.route])} />
  {/if}
</div>
