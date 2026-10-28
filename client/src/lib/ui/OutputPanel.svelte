<script lang="ts">
  interface Props {
    text: string;
    class?: string;
  }

  const { text, class: className = "" }: Props = $props();
</script>

<p
  class="selectable rounded-md bg-surface-variant px-3 py-2.5 font-mono text-body-sm wrap-anywhere whitespace-pre-wrap text-on-surface {className}"
>{text}</p>
