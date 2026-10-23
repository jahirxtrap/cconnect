<script lang="ts">
  import { navigation } from "$lib/app/navigation.svelte";
  import BrowserScreen from "$lib/screens/browser/BrowserScreen.svelte";
  import ClaudeScreen from "$lib/screens/claude/ClaudeScreen.svelte";
  import MonitorScreen from "$lib/screens/monitor/MonitorScreen.svelte";
  import NotesScreen from "$lib/screens/notes/NotesScreen.svelte";
  import ProjectFilesScreen from "$lib/screens/project/ProjectFilesScreen.svelte";
  import SettingsPanel from "$lib/screens/settings/SettingsPanel.svelte";
  import SettingsScreen from "$lib/screens/settings/SettingsScreen.svelte";
  import SharedScreen from "$lib/screens/shared/SharedScreen.svelte";
  import TerminalScreen from "$lib/screens/terminal/TerminalScreen.svelte";
</script>

{#if navigation.route === "/settings"}
  {#if navigation.centered}
    <SettingsPanel />
  {:else}
    <SettingsScreen />
  {/if}
{:else if navigation.route === "/monitor"}
  <MonitorScreen />
{:else if navigation.route === "/notes"}
  <NotesScreen />
{:else if navigation.route === "/claude"}
  <ClaudeScreen />
{:else if navigation.route === "/shared"}
  <SharedScreen />
{:else if navigation.route === "/project"}
  <ProjectFilesScreen />
{:else if navigation.route === "/terminal"}
  <TerminalScreen />
{:else if navigation.route === "/browser"}
  <BrowserScreen />
{/if}
