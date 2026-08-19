<script lang="ts" module>
  export const DISMISS_MENUS = "cconnect:dismiss-menus";

  let openCount = 0;

  export const dismissMenus = () => window.dispatchEvent(new Event(DISMISS_MENUS));

  export const menusOpen = () => openCount > 0;
</script>

<script lang="ts">
  import { Portal } from "bits-ui";
  import { pushDismiss } from "$lib/app/dismissStack";

  interface Props {
    open: boolean;
    onDismiss: () => void;
  }

  const { open, onDismiss }: Props = $props();

  $effect(() => {
    if (!open) return;
    openCount += 1;
    const close = () => onDismiss();
    const release = pushDismiss(close);
    window.addEventListener(DISMISS_MENUS, close);
    return () => {
      openCount -= 1;
      release();
      window.removeEventListener(DISMISS_MENUS, close);
    };
  });
</script>

{#if open}
  <Portal>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="pointer-events-auto fixed inset-0 z-65 overscroll-contain"
      ontouchstart={(event) => {
        event.stopPropagation();
        onDismiss();
      }}
      onpointerdown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
      }}
      onwheel={(event) => event.preventDefault()}
      ontouchmove={(event) => event.preventDefault()}
    ></div>
  </Portal>
{/if}
