<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import FileIcon from "@lucide/svelte/icons/file";
  import FolderArchive from "@lucide/svelte/icons/folder-archive";
  import { isArchive } from "$lib/data/format";
  import { t } from "$lib/i18n/index.svelte";
  import { segments, type Segment } from "$lib/markdown/render";
  import { backend } from "$lib/services/backend.svelte";
  import CodeBlock from "./CodeBlock.svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import MarkdownImage from "./MarkdownImage.svelte";
  import { hscrollbar } from "./scrollbar";

  interface Props {
    text: string;
    onSharedLink?: ((url: string, filename: string) => void) | null;
    class?: string;
  }

  const { text, onSharedLink = null, class: className = "" }: Props = $props();

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
      const [file, archive, external] = sources;
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
</span>

<div class="markdown flex w-full flex-col gap-1.5 {className}" onclickcapture={onClick} use:decorate>
  {@render blocks(parts)}
</div>

{#snippet blocks(list: Segment[])}
  {#each list as part, index (index)}
    {#if part.kind === "code"}
      <CodeBlock code={part.code} lang={part.lang} />
    {:else if part.kind === "image"}
      <MarkdownImage url={part.url} alt={part.alt} onOpen={open} />
    {:else if part.kind === "details"}
      <details class="w-full">
        <summary
          class="flex cursor-pointer list-none items-center gap-1.5 text-label-lg text-on-surface-variant select-none"
        >
          <ChevronRight size={12} class="shrink-0" />
          {part.summary}
        </summary>
        <div class="flex flex-col gap-1.5 pt-1 pl-2">
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
      window.open(link, "_blank", "noopener");
      externalLink = null;
    }}
    onDismiss={() => (externalLink = null)}
  />
{/if}
