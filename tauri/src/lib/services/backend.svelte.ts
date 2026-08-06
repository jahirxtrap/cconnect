import { secureStore } from "$lib/platform/secureStorage";
import { store } from "$lib/platform/storage";

export type AuthKind = "none" | "bearer" | "basic" | "header";

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
  // null = follow the app accent; otherwise it overrides it while this environment is active.
  accentIndex: number | null;
}

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

export const socketUrlOf = (profile: Profile, path: string) => {
  if (!isConfigured(profile)) return "";
  const url = `${origin(profile, true)}/api${path}`;
  const token = profile.authKind === "bearer" ? profile.authToken : "";
  return token ? `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : url;
};

export const authHeadersOf = (profile: Profile): Record<string, string> => {
  if (!profile) return {};
  if (profile.authKind === "bearer" && profile.authToken) {
    return { Authorization: `Bearer ${profile.authToken}` };
  }
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
  environments = $state<EnvironmentProfile[]>(secureStore.get("environments", []));
  activeId = $state<string | null>(store.get("environments.active", null));

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
