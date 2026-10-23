<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import AppLogo from "./AppLogo.svelte";

  interface Props {
    scale?: number;
    class?: string;
  }

  const { scale = 1, class: className = "" }: Props = $props();
</script>

<div class="flex items-center {className}" style:zoom={scale === 1 ? undefined : scale}>
  <AppLogo />
  <p class="ml-2 truncate text-title-lg">{t("APP_NAME")}</p>
</div>
