<script lang="ts">
  import AboutGroup from "./AboutGroup.svelte";
  import BackgroundSection from "./BackgroundSection.svelte";
  import ClientSection from "./ClientSection.svelte";
  import ConnectivitySection from "./ConnectivitySection.svelte";
  import RecoverySection from "./RecoverySection.svelte";
  import type { SettingsSection } from "./sections";
  import ServerSection from "./ServerSection.svelte";
  import SettingsResults from "./SettingsResults.svelte";
  import type { SettingsPage } from "./settingsPage.svelte";

  interface Props {
    page: SettingsPage;
    blocks?: Partial<Record<SettingsSection, HTMLElement | null>>;
  }

  let { page, blocks = $bindable({}) }: Props = $props();
</script>

{#if page.searching}
  <SettingsResults query={page.query} onSelect={page.reveal} />
{/if}
<div class={page.searching ? "hidden" : "contents"}>
  {#if !page.searching || page.hosting}
    <div bind:this={blocks.client} data-section="client">
      <ClientSection />
    </div>
    <div bind:this={blocks.background} data-section="background">
      <BackgroundSection />
    </div>
    <div bind:this={blocks.connectivity} data-section="connectivity">
      <ConnectivitySection />
    </div>
    <div bind:this={blocks.server} data-section="server">
      <ServerSection tick={page.tick} flash={page.highlight.is("server")} />
    </div>
    <div bind:this={blocks.recovery} data-section="recovery">
      <RecoverySection onChanged={page.changed} />
    </div>
    <div bind:this={blocks.about} data-section="about">
      <AboutGroup flash={page.highlight.is("about")} />
    </div>
  {/if}
</div>
