<script lang="ts">
  import { SECTION_LABEL_CLASS } from "./sectionLabel";

  interface Props {
    label: string;
    divider?: boolean;
  }

  const { label, divider = false }: Props = $props();
</script>

{#if divider}
  <div class="mx-1 my-1 border-t border-outline-variant"></div>
{/if}
<p class="flex h-7 items-center px-1 {SECTION_LABEL_CLASS}">
  {label}
</p>
