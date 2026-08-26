<script lang="ts">
  interface Props {
    value: string;
    editing: boolean;
    onEdit: () => void;
    oninput: (value: string) => void;
    onCommit: () => void;
    onCancel: () => void;
    class?: string;
  }

  const { value, editing, onEdit, oninput, onCommit, onCancel, class: className = "" }: Props = $props();

  let field = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (editing && field && document.activeElement !== field) {
      field.focus();
      field.select();
    }
  });
</script>

<input
  bind:this={field}
  {value}
  readonly={!editing}
  class="w-full truncate rounded-md border-2 px-3 py-2 text-body-md transition-colors outline-none {editing
    ? 'cursor-text border-accent'
    : 'cursor-pointer border-transparent hover:bg-on-surface/8'} {className}"
  oninput={(event) => oninput(event.currentTarget.value)}
  onclick={() => {
    if (!editing) onEdit();
  }}
  onblur={() => {
    if (editing) onCommit();
  }}
  onkeydown={(event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onCommit();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
  }}
/>
