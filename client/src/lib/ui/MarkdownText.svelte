<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Download from "@lucide/svelte/icons/download";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import FileIcon from "@lucide/svelte/icons/file";
  import FolderArchive from "@lucide/svelte/icons/folder-archive";
  import Info from "@lucide/svelte/icons/info";
  import Lightbulb from "@lucide/svelte/icons/lightbulb";
  import MessageSquareWarning from "@lucide/svelte/icons/message-square-warning";
  import OctagonAlert from "@lucide/svelte/icons/octagon-alert";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import type { GalleryFile } from "$lib/data/chatModels";
  import { isArchive, visibleName } from "$lib/data/format";
  import { isInstallLink } from "$lib/data/installRequest";
  import { t } from "$lib/i18n/index.svelte";
  import type { SuggestionPicker } from "$lib/markdown/cconnectBlock";
  import { RELATIVE_SRC } from "$lib/markdown/githubHtml";
  import { createSegmenter, type MarkdownFlavor, type Segment } from "$lib/markdown/render";
  import { installOffers } from "$lib/screens/install/installOffers.svelte";
  import { backend, sharedRootOf } from "$lib/services/backend.svelte";
  import { besideFile } from "$lib/services/fileLinks";
  import { imageSrc } from "$lib/services/mediaSource";
  import { contextServer } from "$lib/services/serverContext";
  import CconnectBlockView from "./CconnectBlockView.svelte";
  import CodeBlock from "./CodeBlock.svelte";
  import ExternalLinkDialog from "./ExternalLinkDialog.svelte";
  import MarkdownImage from "./MarkdownImage.svelte";
  import { hscrollbar } from "./scrollbar";

  interface Props {
    text: string;
    onSharedLink?: ((url: string, filename: string, gallery?: GalleryFile[]) => void) | null;
    onSharedMenu?: ((url: string, filename: string) => void) | null;
    onSuggest?: SuggestionPicker | null;
    linkTarget?: ((href: string) => (() => void) | null) | null;
    flavor?: MarkdownFlavor;
    fileUrl?: string | null;
    dense?: boolean;
    class?: string;
  }

  const {
    text,
    onSharedLink = null,
    onSharedMenu = null,
    onSuggest = null,
    linkTarget = null,
    flavor = "chat",
    fileUrl = null,
    dense = false,
    class: className = "",
  }: Props = $props();

  const ALERT_KINDS = ["note", "tip", "important", "warning", "caution"];

  const segments = $derived(createSegmenter(flavor));
  const server = contextServer();
  const sharedRoot = $derived(sharedRootOf(server()));
  const resolved = $derived(backend.resolveShared(text, server()));
  const parts = $derived(segments(resolved));
  const shared = (url: string) => url.startsWith(sharedRoot);

  let externalLink = $state<string | null>(null);
  let icons = $state<HTMLElement | null>(null);

  const filenameOf = (url: string) => {
    const raw = url.split(/[?#]/)[0].split("/").pop() ?? "";
    try {
      return visibleName(decodeURIComponent(raw) || raw);
    } catch {
      return visibleName(raw);
    }
  };

  const open = (url: string, filename = filenameOf(url), gallery?: GalleryFile[]) => {
    const target = linkTarget?.(url);
    if (target) target();
    else if (isInstallLink(url)) installOffers.offerLink(url);
    else if (onSharedLink && shared(url)) onSharedLink(url, filename, gallery?.filter((file) => shared(file.url)));
    else externalLink = url;
  };

  const onClick = (event: MouseEvent) => {
    const url = (event.target as HTMLElement).closest("a")?.getAttribute("href");
    if (!url) return;
    event.preventDefault();
    open(url);
  };

  const onContextMenu = (event: MouseEvent) => {
    if (!onSharedMenu) return;
    const target = event.target as HTMLElement;
    const url =
      target.closest("a")?.getAttribute("href") ??
      target.closest<HTMLElement>("[data-shared]")?.dataset.shared;
    if (!url || !shared(url)) return;
    event.preventDefault();
    onSharedMenu(url, filenameOf(url));
  };

  const decorate = (node: HTMLElement) => {
    const bars = new Map<HTMLElement, { destroy: () => void }>();
    const images = new Map<HTMLImageElement, { destroy: () => void }>();
    const prune = <T extends Element>(held: Map<T, { destroy: () => void }>) => {
      for (const [element, handle] of held) {
        if (element.isConnected) continue;
        handle.destroy();
        held.delete(element);
      }
    };
    const apply = (root: Element) => {
      const within = <T extends Element>(selector: string): T[] => [
        ...(root.matches(selector) ? [root as T] : []),
        ...root.querySelectorAll<T>(selector),
      ];
      for (const scroller of within<HTMLElement>("table, pre")) {
        if (bars.has(scroller)) continue;
        bars.set(scroller, hscrollbar(scroller, { touchIndicator: true }));
      }
      for (const image of fileUrl ? within<HTMLImageElement>(`img[${RELATIVE_SRC}]`) : []) {
        const url = images.has(image) ? null : besideFile(fileUrl ?? "", image.getAttribute(RELATIVE_SRC) ?? "");
        if (url) images.set(image, imageSrc(image, { url }));
      }
      const sources = Array.from(icons?.querySelectorAll("svg") ?? []);
      if (!sources.length) return;
      const [file, archive, external, install, ...alerts] = sources;
      for (const quote of within<HTMLElement>("blockquote.md-alert")) {
        if (quote.dataset.decorated) continue;
        quote.dataset.decorated = "true";
        const kind = quote.dataset.alert ?? "note";
        const title = document.createElement("p");
        title.className = "md-alert-title";
        title.append(alerts[ALERT_KINDS.indexOf(kind)].cloneNode(true), t(`ALERT_${kind.toUpperCase()}`));
        quote.prepend(title);
      }
      for (const anchor of within<HTMLAnchorElement>("a")) {
        if (anchor.dataset.decorated) continue;
        anchor.dataset.decorated = "true";
        anchor.dataset.press = "off";
        const url = anchor.getAttribute("href") ?? "";
        const installing = isInstallLink(url);
        const own = installing || shared(url) || !!linkTarget?.(url);
        const source = installing ? install : own ? (isArchive(filenameOf(url)) ? archive : file) : external;
        const icon = source.cloneNode(true) as SVGElement;
        icon.classList.add("md-link-icon");
        if (own) anchor.prepend(icon);
        else anchor.append(icon);
      }
    };
    apply(node);
    const observer = new MutationObserver((records) => {
      if (records.some((record) => record.removedNodes.length)) {
        prune(bars);
        prune(images);
      }
      for (const record of records) {
        for (const added of record.addedNodes) if (added instanceof Element) apply(added);
      }
    });
    observer.observe(node, { childList: true, subtree: true });
    return {
      destroy: () => {
        observer.disconnect();
        bars.forEach((bar) => bar.destroy());
        bars.clear();
        images.forEach((image) => image.destroy());
        images.clear();
      },
    };
  };
</script>

<span bind:this={icons} class="hidden" aria-hidden="true">
  <FileIcon size={16} />
  <FolderArchive size={16} />
  <ExternalLink size={16} />
  <Download size={16} />
  <Info size={16} />
  <Lightbulb size={16} />
  <MessageSquareWarning size={16} />
  <TriangleAlert size={16} />
  <OctagonAlert size={16} />
</span>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="markdown chat-gap flex w-full flex-col {dense ? 'markdown-dense' : ''} {flavor === 'chat' ? '' : 'markdown-document'} {className}"
  onclickcapture={onClick}
  oncontextmenu={onContextMenu}
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
      <CconnectBlockView data={part.data} onOpen={open} {onSuggest} />
    {:else if part.kind === "details"}
      <details class="w-full">
        <summary
          class="flex cursor-pointer list-none items-center gap-1.5 text-label-lg text-on-surface-variant select-none"
        >
          <ChevronRight size={12} class="shrink-0" />
          {@html part.summary}
        </summary>
        <div class="chat-gap flex flex-col pt-1 pl-2">
          {@render blocks(part.children)}
        </div>
      </details>
    {:else if part.kind === "list"}
      <svelte:element this={part.ordered ? "ol" : "ul"} class="chat-gap flex flex-col">
        {#each part.items as item, at (at)}
          <li class={item.className}>
            <span class="li-marker">{item.marker}&nbsp;</span>
            <div class="chat-gap flex min-w-0 flex-col">
              {@render blocks(item.children)}
            </div>
          </li>
        {/each}
      </svelte:element>
    {:else}
      {@html part.html}
    {/if}
  {/each}
{/snippet}

{#if externalLink}
  <ExternalLinkDialog url={externalLink} onDismiss={() => (externalLink = null)} />
{/if}
