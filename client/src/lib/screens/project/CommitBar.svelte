<script lang="ts">
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Undo2 from "@lucide/svelte/icons/undo-2";
  import { slide } from "svelte/transition";
  import { joined } from "$lib/data/format";
  import { settings } from "$lib/data/settings.svelte";
  import { plural, t } from "$lib/i18n/index.svelte";
  import { gitApi, type GitIdentity, type GitRepo } from "$lib/services/gitApi";
  import Button from "$lib/ui/Button.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import SelectionDot from "$lib/ui/SelectionDot.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";
  import { resizeHandle } from "$lib/ui/resizeHandle";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    projectKey: string;
    repo: GitRepo;
    paths: string[];
    note?: string;
    locked?: boolean;
    instant?: boolean;
    onDone: () => void;
  }

  const {
    projectKey,
    repo,
    paths,
    note = "",
    locked = false,
    instant = false,
    onDone,
  }: Props = $props();

  const ACTION_CLASS = "size-8";
  const DOT_SIZE = 18;
  const PANEL_MS = 350;
  const LINE_HEIGHT = 20;
  const MIN_HEIGHT = LINE_HEIGHT * 2;
  const MAX_HEIGHT = LINE_HEIGHT * 16;

  let message = $state("");
  let amend = $state(false);
  let last = $state<string | null>(null);
  let author = $state("");
  let identities = $state<GitIdentity[]>([]);
  let effective = $state<GitIdentity | null>(null);
  let running = $state("");
  let writing = $state(false);
  let failure = $state("");
  let asking = $state<"commit" | "push" | "revert" | null>(null);
  let force = $state(false);

  const label = (identity: GitIdentity) => `${identity.name} <${identity.email}>`;

  const options = $derived(identities.map((identity) => ({ value: label(identity), label: label(identity) })));
  const idle = $derived(running === "");
  const written = $derived(message.trim());
  const rewrites = $derived(paths.length > 0 || (last !== null && written !== last.trim()));
  const ready = $derived(idle && written !== "" && (amend ? rewrites : paths.length > 0));
  const shown = $derived(author || (effective ? label(effective) : t("GIT_AUTHOR_DEFAULT")));
  const commitLabel = $derived(amend ? t("GIT_AMEND") : t("GIT_COMMIT"));
  const pushLabel = $derived(amend ? t("GIT_AMEND_PUSH") : t("GIT_COMMIT_PUSH"));
  const open = $derived(settings.projectCommitOpen && !locked);
  const height = $derived(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, settings.projectCommitHeight)));

  $effect(() => {
    const key = projectKey;
    const target = repo.path;
    author = "";
    void gitApi.identities(key, target).then((found) => {
      if (projectKey !== key || repo.path !== target || !found) return;
      effective = found.effective;
      identities = found.options;
    });
  });

  $effect(() => {
    const key = projectKey;
    const target = repo.path;
    last = null;
    if (!amend) return;
    void gitApi.lastMessage(key, target).then((found) => {
      if (projectKey !== key || repo.path !== target) return;
      last = found;
      if (found && !message.trim()) message = found;
    });
  });

  const guard = async (name: string, action: () => Promise<{ ok: boolean; output: string }>) => {
    running = name;
    failure = "";
    const result = await action();
    running = "";
    if (result.ok) onDone();
    else failure = result.output || t("GIT_FAILED");
    return result.ok;
  };

  const suggest = async () => {
    if (writing) return;
    writing = true;
    failure = "";
    const suggestion = await gitApi.suggestMessage(projectKey, repo.path, paths, note, amend);
    writing = false;
    if (suggestion) message = suggestion;
    else failure = t("GIT_GENERATE_FAILED");
  };

  const commit = async () => {
    const done = await guard("commit", () =>
      gitApi.commit(projectKey, { repo: repo.path, paths, message: written, author, amend }),
    );
    if (done) {
      message = "";
      amend = false;
    }
    return done;
  };

  const publish = () => guard("push", () => gitApi.push(projectKey, repo.path, force, !repo.upstream));

  const resolve = async (choice: "commit" | "push" | "revert") => {
    asking = null;
    if (choice === "revert") {
      await guard("revert", () => gitApi.revert(projectKey, repo.path, paths));
      return;
    }
    if (choice === "commit" && !(await commit())) return;
    await publish();
    force = false;
  };
</script>

<div class="relative flex shrink-0 flex-col border-t border-outline-variant">
  {#if open}
    <div
      role="separator"
      aria-orientation="horizontal"
      class="absolute inset-x-0 -top-0.5 z-10 h-1.5 cursor-row-resize"
      use:resizeHandle={{
        axis: "y",
        value: () => height,
        min: MIN_HEIGHT,
        max: () => MAX_HEIGHT,
        invert: true,
        onResize: (value) => (settings.projectCommitHeight = value),
      }}
    ></div>
  {/if}
  <div class="flex min-h-10 items-center py-1 pr-1 pl-3">
    <GitBranch size={14} class="mr-1.5 shrink-0 text-on-surface-variant" />
    <span class="min-w-0 flex-1 truncate text-label-lg text-on-surface-variant">
      {joined(repo.branch || t("GIT_DETACHED"), repo.relative !== "." && repo.relative)}
    </span>
    {#if repo.behind}
      <span class="flex items-center px-1 text-label-md text-on-surface-variant">
        <ArrowDown size={13} />{repo.behind}
      </span>
    {/if}
    {#if repo.ahead}
      <span class="flex items-center px-1 text-label-md text-accent"><ArrowUp size={13} />{repo.ahead}</span>
    {/if}
    {#if !locked}
      <TooltipIconButton
        label={t("GIT_PULL")}
        class={ACTION_CLASS}
        enabled={idle}
        onclick={() => void guard("pull", () => gitApi.pull(projectKey, repo.path))}
      >
        {#if running === "pull"}
          <LoadingIndicator />
        {:else}
          <ArrowDown />
        {/if}
      </TooltipIconButton>
      <TooltipIconButton
        label={t("GIT_PUSH")}
        class={ACTION_CLASS}
        enabled={idle}
        onclick={() => (asking = "push")}
      >
        {#if running === "push"}
          <LoadingIndicator />
        {:else}
          <ArrowUp />
        {/if}
      </TooltipIconButton>
      <TooltipIconButton
        label={open ? t("COLLAPSE") : t("EXPAND")}
        class={ACTION_CLASS}
        shortcut="project.commit"
        onclick={() => (settings.projectCommitOpen = !open)}
      >
        <ChevronDown class={open ? "" : "rotate-180"} />
      </TooltipIconButton>
    {/if}
  </div>

  {#if open}
    <div class="chat-gap flex flex-col px-3 pb-3" transition:slide={{ duration: instant ? 0 : PANEL_MS }}>
      <InputField
        value={message}
        oninput={(value) => (message = value)}
        placeholder={t("GIT_MESSAGE_PLACEHOLDER")}
        minLines={height / LINE_HEIGHT}
        maxLines={height / LINE_HEIGHT}
        enabled={running === ""}
      />

      <SelectField
        label=""
        selected={author}
        options={[{ value: "", label: t("GIT_AUTHOR_DEFAULT") }, ...options]}
        {shown}
        enabled={running === ""}
        onSelect={(value) => (author = value)}
      />

      <div class="flex items-center">
        <button
          type="button"
          data-press="off"
          disabled={running !== ""}
          onclick={() => (amend = !amend)}
          class="flex h-8 min-w-0 flex-1 cursor-pointer items-center gap-2 text-left disabled:cursor-default disabled:opacity-40"
        >
          <SelectionDot selected={amend} size={DOT_SIZE} />
          <span class="truncate text-body-md text-on-surface-variant">{t("GIT_AMEND_LAST")}</span>
        </button>
        <TooltipIconButton
          label={t("GIT_GENERATE_MESSAGE")}
          class={ACTION_CLASS}
          enabled={amend || paths.length > 0}
          onclick={() => void suggest()}
        >
          {#if writing}
            <LoadingIndicator class="text-purple" />
          {:else}
            <Sparkles />
          {/if}
        </TooltipIconButton>
        <TooltipIconButton
          label={t("GIT_REVERT")}
          class={ACTION_CLASS}
          enabled={paths.length > 0 && idle}
          onclick={() => (asking = "revert")}
        >
          <Undo2 />
        </TooltipIconButton>
      </div>

      {#if failure}
        <p class="text-body-sm wrap-anywhere text-error">{failure}</p>
      {/if}

      <div class="flex gap-2">
        <Button class="flex-1" enabled={ready} onclick={() => void commit()}>
          {commitLabel}
        </Button>
        <Button variant="outlined" class="flex-1" enabled={ready} onclick={() => (asking = "commit")}>
          {pushLabel}
        </Button>
      </div>
    </div>
  {/if}
</div>

{#if asking === "revert"}
  <ConfirmDialog
    title={t("GIT_REVERT")}
    text={plural("GIT_REVERT_CONFIRM", paths.length)}
    confirmLabel={t("GIT_REVERT")}
    onConfirm={() => void resolve("revert")}
    onDismiss={() => (asking = null)}
  />
{/if}

{#if asking === "commit" || asking === "push"}
  {@const choice = asking}
  <ConfirmDialog
    title={choice === "commit" ? pushLabel : t("GIT_PUSH")}
    text={t("GIT_PUSH_CONFIRM", repo.branch, repo.upstream || repo.remote)}
    confirmLabel={t("CONFIRM")}
    onConfirm={() => void resolve(choice)}
    onDismiss={() => {
      asking = null;
      force = false;
    }}
  >
    <SwitchRow
      title={t("GIT_FORCE")}
      summary={t("GIT_FORCE_HINT")}
      checked={force}
      onChange={(checked) => (force = checked)}
    />
  </ConfirmDialog>
{/if}
