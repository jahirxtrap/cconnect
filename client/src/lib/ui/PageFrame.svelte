<script lang="ts">
  import { pageSandbox, pageSrc } from "$lib/services/pageSource";
  import { frameScrollbars, themedPage } from "./frameScrollbars.svelte";

  interface Props {
    url: string;
    name: string;
    title: string;
    onerror?: () => void;
    class?: string;
  }

  const { url, name, title, onerror, class: className = "" }: Props = $props();
</script>

<iframe
  use:pageSrc={{ url, name, transform: themedPage, onerror }}
  use:frameScrollbars
  {title}
  sandbox={pageSandbox}
  referrerpolicy="no-referrer"
  class={className}
></iframe>
