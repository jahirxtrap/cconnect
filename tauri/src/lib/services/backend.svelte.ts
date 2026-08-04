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
}

const secure = (profile: EnvironmentProfile) => profile.kind === "https";

const portSuffix = (profile: EnvironmentProfile) => {
  if (profile.port === null) return "";
  return profile.port === (secure(profile) ? 443 : 80) ? "" : `:${profile.port}`;
};

const origin = (profile: EnvironmentProfile, socket: boolean) => {
  const scheme = socket ? (secure(profile) ? "wss" : "ws") : secure(profile) ? "https" : "http";
  return `${scheme}://${profile.host}${portSuffix(profile)}`;
};

class Backend {
  environments = $state<EnvironmentProfile[]>(store.get("environments", []));
  activeId = $state<string | null>(store.get("environments.active", null));

  readonly active = $derived(
    this.environments.find((profile) => profile.id === this.activeId) ?? this.environments[0] ?? null,
  );

  readonly configured = $derived(!!this.active?.host);

  readonly baseUrl = $derived(this.active ? `${origin(this.active, false)}/api` : "");

  readonly authHeaders = $derived.by<Record<string, string>>(() => {
    const profile = this.active;
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
  });

  socketUrl(path: string): string {
    const profile = this.active;
    if (!profile) return "";
    const token = profile.authKind === "bearer" ? profile.authToken : "";
    const url = `${origin(profile, true)}/api${path}`;
    return token ? `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : url;
  }

  select(id: string) {
    this.activeId = id;
    store.set("environments.active", id);
  }

  save(environments: EnvironmentProfile[]) {
    this.environments = environments;
    store.set("environments", environments);
  }

  update(id: string | null, patch: Partial<EnvironmentProfile>) {
    this.save(
      this.environments.map((profile) => (profile.id === id ? { ...profile, ...patch } : profile)),
    );
  }
}

export const backend = new Backend();
