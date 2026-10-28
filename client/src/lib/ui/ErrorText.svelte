<script lang="ts">
  interface Props {
    text: string;
    class?: string;
  }

  const { text, class: className = "" }: Props = $props();
</script>

<p class="text-body-sm wrap-anywhere whitespace-pre-wrap text-error {className}">{text}</p>
