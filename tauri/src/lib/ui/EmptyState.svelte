<script lang="ts">
  interface Props {
    text: string;
    class?: string;
  }

  const { text, class: className = "" }: Props = $props();
</script>

<div class="flex items-center justify-center px-5 py-3.5 {className}">
  <p class="text-center text-body-md text-on-surface-variant">{text}</p>
</div>
