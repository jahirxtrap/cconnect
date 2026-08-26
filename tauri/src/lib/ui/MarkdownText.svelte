<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import FileIcon from "@lucide/svelte/icons/file";
  import FolderArchive from "@lucide/svelte/icons/folder-archive";
  import Info from "@lucide/svelte/icons/info";
  import Lightbulb from "@lucide/svelte/icons/lightbulb";
  import MessageSquareWarning from "@lucide/svelte/icons/message-square-warning";
  import OctagonAlert from "@lucide/svelte/icons/octagon-alert";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import { isArchive } from "$lib/data/format";
  import { t } from "$lib/i18n/index.svelte";
  import { openExternal } from "$lib/platform";
  import { segments, type Segment } from "$lib/markdown/render";
  import { backend } from "$lib/services/backend.svelte";
  import CconnectBlockView from "./CconnectBlockView.svelte";
  import CodeBlock from "./CodeBlock.svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import MarkdownImage from "./MarkdownImage.svelte";
  import { hscrollbar } from "./scrollbar";

  interface Props {
    text: string;
    onSharedLink?: ((url: string, filename: string) => void) | null;
    dense?: boolean;
    class?: string;
  }

  const { text, onSharedLink = null, dense = false, class: className = "" }: Props = $props();

  const ALERT_KINDS = ["note", "tip", "important", "warning", "caution"];

  const parts = $derived(segments(text));
  const sharedPrefix = $derived(`${backend.baseUrl}/shared/`);

  let externalLink = $state<string | null>(null);
  let icons = $state<HTMLElement | null>(null);

  const filenameOf = (url: string) => {
    const raw = url.split(/[?#]/)[0].split("/").pop() ?? "";
    try {
      return decodeURIComponent(raw) || raw;
    } catch {
      return raw;
    }
  };

  const open = (url: string, filename = filenameOf(url)) => {
    if (onSharedLink && url.startsWith(sharedPrefix)) onSharedLink(url, filename);
    else externalLink = url;
  };

  const onClick = (event: MouseEvent) => {
    const url = (event.target as HTMLElement).closest("a")?.getAttribute("href");
    if (!url) return;
    event.preventDefault();
    open(url);
  };

  const decorate = (node: HTMLElement) => {
    const bars: { destroy: () => void }[] = [];
    const apply = () => {
      for (const scroller of node.querySelectorAll<HTMLElement>("table, pre")) {
        if (scroller.dataset.scrollbar) continue;
        scroller.dataset.scrollbar = "true";
        bars.push(hscrollbar(scroller));
      }
      const sources = Array.from(icons?.querySelectorAll("svg") ?? []);
      if (!sources.length) return;
      const [file, archive, external, ...alerts] = sources;
      for (const quote of node.querySelectorAll<HTMLElement>("blockquote.md-alert")) {
        if (quote.dataset.decorated) continue;
        quote.dataset.decorated = "true";
        const kind = quote.dataset.alert ?? "note";
        const title = document.createElement("p");
        title.className = "md-alert-title";
        title.append(alerts[ALERT_KINDS.indexOf(kind)].cloneNode(true), t(`ALERT_${kind.toUpperCase()}`));
        quote.prepend(title);
      }
      for (const anchor of node.querySelectorAll("a")) {
        if (anchor.dataset.decorated) continue;
        anchor.dataset.decorated = "true";
        const url = anchor.getAttribute("href") ?? "";
        const shared = url.startsWith(sharedPrefix);
        const icon = (shared ? (isArchive(filenameOf(url)) ? archive : file) : external).cloneNode(
          true,
        ) as SVGElement;
        icon.classList.add("md-link-icon");
        if (shared) anchor.prepend(icon);
        else anchor.append(icon);
      }
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(node, { childList: true, subtree: true });
    return {
      destroy: () => {
        observer.disconnect();
        bars.forEach((bar) => bar.destroy());
      },
    };
  };
</script>

<span bind:this={icons} class="hidden" aria-hidden="true">
  <FileIcon size={16} />
  <FolderArchive size={16} />
  <ExternalLink size={16} />
  <Info size={16} />
  <Lightbulb size={16} />
  <MessageSquareWarning size={16} />
  <TriangleAlert size={16} />
  <OctagonAlert size={16} />
</span>

<div
  class="markdown chat-gap flex w-full flex-col {dense ? 'markdown-dense' : ''} {className}"
  onclickcapture={onClick}
  use:decorate
>
  {@render blocks(parts)}
</div>

{#snippet blocks(list: Segment[])}
  {#each list as part, index (index)}
    {#if part.kind === "code"}
      <CodeBlock code={part.code} lang={part.lang} />
    {:else if part.kind === "images"}
      <div class="flex w-full flex-wrap justify-center gap-1.5">
        {#each part.items as image (image.url)}
          <MarkdownImage url={image.url} alt={image.alt} onOpen={open} />
        {/each}
      </div>
    {:else if part.kind === "block"}
      <CconnectBlockView data={part.data} onOpen={open} />
    {:else if part.kind === "details"}
      <details class="w-full">
        <summary
          class="flex cursor-pointer list-none items-center gap-1.5 text-label-lg text-on-surface-variant select-none"
        >
          <ChevronRight size={12} class="shrink-0" />
          {part.summary}
        </summary>
        <div class="chat-gap flex flex-col pt-1 pl-2">
          {@render blocks(part.children)}
        </div>
      </details>
    {:else}
      {@html part.html}
    {/if}
  {/each}
{/snippet}

{#if externalLink}
  {@const link = externalLink}
  <ConfirmDialog
    title={t("OPEN_EXTERNAL_LINK")}
    text={t("OPEN_EXTERNAL_LINK_MESSAGE", link)}
    confirmLabel={t("OPEN")}
    onConfirm={() => {
      openExternal(link);
      externalLink = null;
    }}
    onDismiss={() => (externalLink = null)}
  />
{/if}
