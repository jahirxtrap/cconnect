<script lang="ts">
  interface Props {
    text: string;
    failure?: boolean;
    class?: string;
  }

  const { text, failure = false, class: className = "" }: Props = $props();
</script>

<p
  class="selectable rounded-md px-3 py-2.5 font-mono text-body-sm wrap-anywhere whitespace-pre-wrap {failure
    ? 'bg-red-bg text-red'
    : 'bg-surface-variant text-on-surface'} {className}"
>{text}</p>
