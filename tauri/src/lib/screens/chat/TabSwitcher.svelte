<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";
  import { Dialog } from "bits-ui";
  import { sessionColorOf } from "$lib/design/sessionColors";
  import { t } from "$lib/i18n/index.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { tabs } from "./tabs.svelte";

  const LONG_PRESS_MS = 400;
  const DRAG_THRESHOLD = 8;
  const HALF = 2;

  let open = $state(false);
  let draggingId = $state<string | null>(null);
  let dragX = $state(0);
  let dragY = $state(0);
  let dragTarget = $state(-1);

  const cards = new Map<string, HTMLElement>();

  const register = (element: HTMLElement, id: string) => {
    cards.set(id, element);
    return { destroy: () => cards.delete(id) };
  };

  const centerOf = (id: string) => {
    const element = cards.get(id);
    if (!element) return null;
    const bounds = element.getBoundingClientRect();
    return { x: bounds.left + bounds.width / HALF, y: bounds.top + bounds.height / HALF };
  };

  const draggingFrom = $derived(
    draggingId === null ? -1 : tabs.list.findIndex((tab) => tab.id === draggingId),
  );

  const shiftOf = (id: string, index: number) => {
    if (draggingFrom < 0 || id === draggingId) return { x: 0, y: 0 };
    const to =
      dragTarget >= draggingFrom && index > draggingFrom && index <= dragTarget
        ? index - 1
        : dragTarget >= 0 && dragTarget < draggingFrom && index < draggingFrom && index >= dragTarget
          ? index + 1
          : index;
    if (to === index) return { x: 0, y: 0 };
    const from = centerOf(id);
    const into = centerOf(tabs.list[to]?.id ?? "");
    if (!from || !into) return { x: 0, y: 0 };
    return { x: into.x - from.x, y: into.y - from.y };
  };

  const nearest = (x: number, y: number) => {
    let best = -1;
    let bestDistance = Number.MAX_VALUE;
    tabs.list.forEach((tab, index) => {
      const center = centerOf(tab.id);
      if (!center) return;
      const distance = (center.x - x) ** 2 + (center.y - y) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    return best;
  };

  const endDrag = () => {
    draggingId = null;
    dragX = 0;
    dragY = 0;
    dragTarget = -1;
  };

  const onPointerDown = (event: PointerEvent, id: string) => {
    if (event.button !== 0) return;
    const target = event.currentTarget as HTMLElement;
    const startX = event.clientX;
    const startY = event.clientY;
    const touch = event.pointerType === "touch";
    let started = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const begin = () => {
      started = true;
      draggingId = id;
      dragX = 0;
      dragY = 0;
      dragTarget = tabs.list.findIndex((tab) => tab.id === id);
    };

    target.setPointerCapture(event.pointerId);
    if (touch) timer = setTimeout(begin, LONG_PRESS_MS);

    const onMove = (move: PointerEvent) => {
      if (!started) {
        const dx = move.clientX - startX;
        const dy = move.clientY - startY;
        if (touch) {
          if ((Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) && timer !== null) {
            clearTimeout(timer);
            timer = null;
          }
          return;
        }
        if (Math.abs(dx) <= DRAG_THRESHOLD && Math.abs(dy) <= DRAG_THRESHOLD) return;
        begin();
      }
      dragX += move.movementX;
      dragY += move.movementY;
      const origin = centerOf(id);
      if (!origin) return;
      const best = nearest(origin.x + dragX, origin.y + dragY);
      if (best >= 0) dragTarget = best;
    };

    const onUp = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      if (timer !== null) clearTimeout(timer);
      if (!started) {
        tabs.select(id);
        open = false;
        return;
      }
      const from = tabs.list.findIndex((tab) => tab.id === id);
      if (from >= 0 && dragTarget >= 0 && dragTarget !== from) tabs.move(id, dragTarget);
      endDrag();
    };

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  };
</script>

<TooltipIconButton label={t("TABS")} onclick={() => (open = true)}>
  <span
    class="inline-flex size-6 items-center justify-center rounded-[6px] border-[1.5px] border-current text-label-md"
  >
    {tabs.list.length}
  </span>
</TooltipIconButton>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Content
      class="fixed inset-0 z-50 flex flex-col bg-surface text-on-surface"
      aria-label={t("TABS")}
    >
      <div class="flex shrink-0 items-center px-1.5 py-1.5">
        <TooltipIconButton label={t("BACK")} onclick={() => (open = false)}>
          <X size={24} />
        </TooltipIconButton>
        <Dialog.Title class="flex-1 pl-1.5 text-title-lg">{t("TABS")}</Dialog.Title>
        <TooltipIconButton
          label={t("NEW_TAB")}
          onclick={() => {
            tabs.newTab();
            open = false;
          }}
        >
          <Plus size={24} />
        </TooltipIconButton>
      </div>
      <div class="grid min-h-0 flex-1 grid-cols-2 content-start gap-1.5 overflow-y-auto px-2 py-1">
        {#each tabs.list as tab, index (tab.id)}
          {@const active = tab.id === tabs.activeId}
          {@const dragging = tab.id === draggingId}
          {@const shift = dragging ? { x: dragX, y: dragY } : shiftOf(tab.id, index)}
          <div
            use:register={tab.id}
            role="button"
            tabindex="0"
            onpointerdown={(event) => onPointerDown(event, tab.id)}
            onkeydown={(event) => {
              if (event.key !== "Enter") return;
              tabs.select(tab.id);
              open = false;
            }}
            style="transform: translate({shift.x}px, {shift.y}px); z-index: {dragging ? 1 : 0}"
            class="flex min-h-10 cursor-pointer touch-none items-center gap-1.5 rounded-item border pr-1 pl-2.5 transition-[background-color,border-color] {active
              ? 'border-[1.5px] border-accent bg-surface-variant text-on-surface'
              : 'border-outline-variant text-on-surface-variant'}"
          >
            <span
              class="size-2 shrink-0 rounded-full"
              style={sessionColorOf(tab.color)
                ? `background: ${sessionColorOf(tab.color)}`
                : "background: color-mix(in srgb, var(--color-on-surface-variant) 40%, transparent)"}
            ></span>
            <span class="min-w-0 flex-1 truncate text-label-lg">{tab.title ?? t("NEW_CHAT")}</span>
            <button
              type="button"
              onpointerdown={(event) => event.stopPropagation()}
              onclick={() => tabs.close(tab.id)}
              aria-label={t("CLOSE_TAB")}
              class="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/10"
            >
              <X size={18} />
            </button>
          </div>
        {/each}
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
