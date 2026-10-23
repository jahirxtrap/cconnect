<script lang="ts">
  import { FIELD_BOX_CLASS, FIELD_INPUT_CLASS } from "./field";

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

{#if editing}
  <div class="{FIELD_BOX_CLASS} ring-accent {className}">
    <input
      bind:this={field}
      {value}
      class={FIELD_INPUT_CLASS}
      oninput={(event) => oninput(event.currentTarget.value)}
      onblur={onCommit}
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
  </div>
{:else}
  <button
    type="button"
    onclick={onEdit}
    class="flex w-full cursor-pointer items-center rounded-md px-3 py-2 text-left text-body-md transition-colors select-none hover:bg-hover {className}"
  >
    <span class="min-w-0 truncate">{value}</span>
  </button>
{/if}
