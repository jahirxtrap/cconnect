import { untrack } from "svelte";
import type { AuthKind } from "$lib/data/auth";
import { withQuery } from "$lib/data/url";
import { isTauri } from "$lib/platform";
import { secureStore } from "$lib/platform/secureStorage";
import { store } from "$lib/platform/storage";

export interface EnvironmentProfile {
  id: string;
  name: string;
  kind: "http" | "https";
  host: string;
  port: number | null;
  authKind: AuthKind;
  authToken: string;
  authUser: string;
  authPassword: string;
  authHeaderName: string;
  authHeaderValue: string;
  directory: string;
  account: string;
  model: string;
  effort: string;
  permissionMode: string;
  streaming: boolean | null;
  accent: string | null;
}

const adopted = (profile: EnvironmentProfile): EnvironmentProfile => ({ ...profile, accent: profile.accent ?? null });

const DEFAULT_PORT = 8723;

export const blankEnvironment = (): EnvironmentProfile => ({
  id: crypto.randomUUID(),
  name: "",
  kind: isTauri ? "http" : "https",
  host: "",
  port: isTauri ? DEFAULT_PORT : null,
  authKind: "none",
  authToken: "",
  authUser: "",
  authPassword: "",
  authHeaderName: "",
  authHeaderValue: "",
  directory: "",
  account: "",
  model: "",
  effort: "",
  permissionMode: "",
  streaming: null,
  accent: null,
});

export type Profile = EnvironmentProfile | null;

export const address = (profile: EnvironmentProfile) =>
  profile.port !== null ? `${profile.host}:${profile.port}` : profile.host;

const secure = (profile: EnvironmentProfile) => profile.kind === "https";

const portSuffix = (profile: EnvironmentProfile) => {
  if (profile.port === null) return "";
  return profile.port === (secure(profile) ? 443 : 80) ? "" : `:${profile.port}`;
};

const origin = (profile: EnvironmentProfile, socket: boolean) => {
  const scheme = socket ? (secure(profile) ? "wss" : "ws") : secure(profile) ? "https" : "http";
  return `${scheme}://${profile.host}${portSuffix(profile)}`;
};

export const isConfigured = (profile: Profile): profile is EnvironmentProfile => !!profile?.host;

export const baseUrlOf = (profile: Profile) => (isConfigured(profile) ? `${origin(profile, false)}/api` : "");

export const sharedRootOf = (profile: Profile) => `${baseUrlOf(profile) || "/api"}/shared`;

export const tokenOf = (profile: Profile) => (profile?.authKind === "bearer" ? profile.authToken : "");

export const withToken = (url: string, profile: Profile) => {
  const token = tokenOf(profile);
  return token ? withQuery(url, "token", token) : url;
};

export const socketUrlOf = (profile: Profile, path: string) =>
  isConfigured(profile) ? withToken(`${origin(profile, true)}/api${path}`, profile) : "";

export const authHeadersOf = (profile: Profile): Record<string, string> => {
  if (!profile) return {};
  const token = tokenOf(profile);
  if (token) return { Authorization: `Bearer ${token}` };
  if (profile.authKind === "basic" && (profile.authUser || profile.authPassword)) {
    return { Authorization: `Basic ${btoa(`${profile.authUser}:${profile.authPassword}`)}` };
  }
  if (profile.authKind === "header" && profile.authHeaderName && profile.authHeaderValue) {
    return { [profile.authHeaderName]: profile.authHeaderValue };
  }
  return {};
};

export const profileKey = (profile: Profile) =>
  isConfigured(profile)
    ? `${baseUrlOf(profile)}|${Object.entries(authHeadersOf(profile))
        .map(([header, value]) => `${header}=${value}`)
        .join(",")}`
    : "";

class Backend {
  environments = $state<EnvironmentProfile[]>(secureStore.get<EnvironmentProfile[]>("environments", []).map(adopted));
  activeId = $state<string | null>(store.get("environments.active", null));
  schemes = $state<Record<string, string>>({});
  #directoryRevisions = $state<Record<string, number>>({});

  directoryRevisionOf(profile: Profile): number {
    return profile ? (this.#directoryRevisions[profile.id] ?? 0) : 0;
  }

  rememberScheme(profile: Profile, scheme: string) {
    if (profile && scheme) this.schemes[profile.id] = scheme;
  }

  schemeOf(profile: Profile): string {
    return (profile && this.schemes[profile.id]) || "";
  }

  resolveShared(text: string, profile: Profile = this.active): string {
    const scheme = this.schemeOf(profile);
    return scheme ? text.split(scheme).join(sharedRootOf(profile)) : text;
  }

  sharedProfileOf(url: string): Profile {
    return this.environments.find((profile) => url.startsWith(`${sharedRootOf(profile)}/`)) ?? this.active;
  }

  readonly active = $derived(
    this.environments.find((profile) => profile.id === this.activeId) ?? this.environments[0] ?? null,
  );

  readonly configured = $derived(isConfigured(this.active));

  readonly baseUrl = $derived(baseUrlOf(this.active));

  readonly authHeaders = $derived(authHeadersOf(this.active));

  find(id: string | null): Profile {
    return this.environments.find((profile) => profile.id === id) ?? this.active;
  }

  socketUrl(path: string): string {
    return socketUrlOf(this.active, path);
  }

  select(id: string) {
    this.activeId = id;
    store.set("environments.active", id);
  }

  save(environments: EnvironmentProfile[]) {
    untrack(() => {
      for (const profile of environments) {
        const before = this.environments.find((item) => item.id === profile.id);
        if (before && before.directory !== profile.directory) {
          this.#directoryRevisions[profile.id] = this.directoryRevisionOf(profile) + 1;
        }
      }
    });
    this.environments = environments;
    secureStore.set("environments", environments);
  }

  update(id: string | null, patch: Partial<EnvironmentProfile>) {
    this.save(
      this.environments.map((profile) => (profile.id === id ? { ...profile, ...patch } : profile)),
    );
  }
}

export const backend = new Backend();

export const environmentOptions = () =>
  backend.environments.map((profile) => ({ value: profile.id, label: profile.name, subtitle: address(profile) }));
