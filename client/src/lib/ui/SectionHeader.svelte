<script lang="ts">
  import { SECTION_LABEL_CLASS } from "./sectionLabel";

  interface Props {
    label: string;
  }

  const { label }: Props = $props();
</script>

<p class="flex h-7 items-center px-2.5 {SECTION_LABEL_CLASS}">
  {label}
</p>
