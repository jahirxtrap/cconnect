<script lang="ts">
  import { untrack } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import { addressOf } from "./deviceBrowser.svelte";

  interface Props {
    url?: string;
    title?: string;
    onConfirm: (url: string, title: string) => void;
    onDismiss: () => void;
  }

  const { url: initialUrl = "", title: initialTitle = "", onConfirm, onDismiss }: Props = $props();

  let title = $state(untrack(() => initialTitle));
  let address = $state(untrack(() => initialUrl));
  const url = $derived(addressOf(address));
</script>

<CompactDialog title={t("BROWSER_FAVORITE_ADD")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={() => url && onConfirm(url, title.trim())} enabled={!!url}>{t("SAVE")}</Button>
  {/snippet}
  <div class="flex flex-col gap-3">
    <InputField value={title} oninput={(value) => (title = value)} singleLine label={t("NAME")} autofocus />
    <InputField value={address} oninput={(value) => (address = value)} singleLine url label={t("URL")} />
  </div>
</CompactDialog>
