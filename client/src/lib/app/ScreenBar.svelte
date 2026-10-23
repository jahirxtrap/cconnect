<script lang="ts">
  import Settings from "@lucide/svelte/icons/settings";
  import { t } from "$lib/i18n/index.svelte";
  import { navigation } from "./navigation.svelte";
  import ScreenButton from "./ScreenButton.svelte";
  import { NAV_SCREENS } from "./screens";

  interface Props {
    vertical?: boolean;
  }

  const { vertical = false }: Props = $props();
</script>

<div class="flex shrink-0 items-center gap-0.5 {vertical ? 'flex-col' : ''}">
  {#each NAV_SCREENS as screen (screen.kind)}
    <ScreenButton
      label={t(screen.screenLabel ?? screen.label)}
      icon={screen.screenIcon ?? screen.icon}
      route={screen.route}
      onclick={screen.open}
    />
  {/each}
</div>
<div class={vertical ? "mt-0.5" : "flex-1"}></div>
<ScreenButton label={t("SETTINGS")} icon={Settings} route="/settings" onclick={() => navigation.openSettings()} />
