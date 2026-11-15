<script lang="ts">
  import { deviceFailureText, type DevicesState, type PairingState } from "$lib/data/deviceModels";
  import { keyRefused, type KeyGate } from "$lib/data/keyGate.svelte";
  import { securityKeys } from "$lib/data/securityKeys.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { devices } from "$lib/services/devices.svelte";
  import type { DeviceOutcome, DevicesApi } from "$lib/services/devicesApi";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ErrorText from "$lib/ui/ErrorText.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import LinearProgress from "$lib/ui/LinearProgress.svelte";
  import QrCode from "$lib/ui/QrCode.svelte";
  import SegmentedButtons from "$lib/ui/SegmentedButtons.svelte";

  interface Props {
    gate: KeyGate;
    api: DevicesApi;
    pairing: PairingState | null;
    onDismiss: () => void;
  }

  const { gate, api, pairing, onDismiss }: Props = $props();

  const QR = 0;
  const CODE = 1;
  const ADDRESS = 2;
  const ADDRESS_HINT = "192.168.1.20:37251";
  const CODE_HINT = "123456";
  const PORT_SUFFIX = /:\d+$/;

  let selected = $state(QR);
  let qrText = $state<string | null>(null);
  let offered = $state<string | null>(null);
  let address = $state("");
  let code = $state("");
  let busy = $state(false);
  let failed = $state<string | null>(null);
  let paired = $state<string | null>(null);

  const profile = $derived(backend.active);
  const options = $derived([t("QR_CODE"), t("DEVICE_PAIR_CODE"), t("DEVICE_CONNECT_ADDRESS")]);
  const waiting = $derived(busy || (selected === QR && pairing?.status === "pairing"));
  const complete = $derived(selected === ADDRESS ? address.trim() !== "" : address.trim() !== "" && code.trim() !== "");
  const landed = $derived(
    paired !== null && (devices.stateOf(profile)?.devices.some((device) => device.address?.startsWith(`${paired}:`)) ?? false),
  );

  $effect(() => {
    if (selected !== QR || qrText || offered !== null) return;
    offered = "";
    void gate.run((key) => api.startPairing(key)).then((result) => {
      if (result.ok) {
        qrText = result.value.text;
        offered = result.value.name;
      } else if (!keyRefused(result)) failed = deviceFailureText(result.failure);
    });
  });

  $effect(() => {
    if (!offered || pairing?.name !== offered) return;
    if (pairing.status === "paired") land(pairing.address);
    else if (pairing.status === "failed") failed = deviceFailureText({ reason: "pair", detail: pairing.detail });
  });

  $effect(() => {
    if (landed) onDismiss();
  });

  $effect(() => () => {
    if (offered) void api.stopPairing(securityKeys.keyFor(profile));
  });

  const land = (at: string) => {
    paired = at.replace(PORT_SUFFIX, "");
    address = paired;
    code = "";
    selected = ADDRESS;
  };

  const finish = async (action: (key: string) => Promise<DeviceOutcome<DevicesState>>, done: () => void) => {
    busy = true;
    failed = null;
    const result = await gate.run(action);
    busy = false;
    if (result.ok) {
      devices.adopt(profile, result.value);
      done();
    } else if (!keyRefused(result)) failed = deviceFailureText(result.failure);
  };

  const submit = () => {
    if (!complete || waiting) return;
    const at = address.trim();
    if (selected === ADDRESS) void finish((key) => api.connect(at, key), onDismiss);
    else void finish((key) => api.pair(at, code.trim(), key), () => land(at));
  };

  const onEnter = (event: KeyboardEvent) => {
    if (event.key === "Enter") submit();
  };
</script>

{#snippet progress()}
  <LinearProgress />
{/snippet}

<CompactDialog title={t("DEVICE_PAIR")} description={t("DEVICE_PAIR_DESCRIPTION")} header={waiting ? progress : undefined} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    {#if selected !== QR}
      <Button onclick={submit} enabled={complete && !waiting}>{t(selected === ADDRESS ? "CONNECT" : "DEVICE_PAIR")}</Button>
    {/if}
  {/snippet}
  <div class="flex flex-col items-center gap-4">
    <SegmentedButtons {options} {selected} onSelect={(index) => (selected = index)} shortcuts={false} fill />
    {#if failed}
      <ErrorText text={failed} class="w-full" />
    {/if}
    {#if selected === QR}
      {#if qrText}
        <QrCode text={qrText} />
      {:else}
        <div class="size-52 shrink-0 rounded-lg bg-surface-variant"></div>
      {/if}
      <p class="text-center text-body-sm text-on-surface-variant">{t("DEVICE_PAIR_QR_HINT")}</p>
    {:else}
      <div class="flex w-full flex-col gap-3">
        <InputField
          value={address}
          oninput={(value) => (address = value)}
          label={t("DEVICE_PAIR_ADDRESS")}
          placeholder={ADDRESS_HINT}
          mono
          singleLine
          autofocus
          enterKeyHint={selected === ADDRESS ? "go" : "next"}
          onkeydown={selected === ADDRESS ? onEnter : undefined}
        />
        {#if selected === CODE}
          <InputField
            value={code}
            oninput={(value) => (code = value)}
            label={t("DEVICE_PAIR_CODE")}
            placeholder={CODE_HINT}
            mono
            singleLine
            numeric
            enterKeyHint="go"
            onkeydown={onEnter}
          />
        {/if}
      </div>
      <p class="text-center text-body-sm text-on-surface-variant">
        {selected === CODE ? t("DEVICE_PAIR_CODE_HINT") : paired ? t("DEVICE_PAIRED_HINT", paired) : t("DEVICE_CONNECT_HINT")}
      </p>
    {/if}
  </div>
</CompactDialog>
