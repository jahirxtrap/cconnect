import { store } from "$lib/platform/storage";

const OWNER = "jahirxtrap";
const CONTRIBUTOR = "DiegoFernandoLojanTenesaca";
const REPO = "cconnect";

export const REPO_URL = `https://github.com/${OWNER}/${REPO}`;
export const RELEASES_URL = `${REPO_URL}/releases`;
export const KOFI_URL = "https://ko-fi.com/jahirtrap";

export interface Release {
  tag: string;
  url: string;
}

export interface Profile {
  login: string;
  name: string | null;
  avatarUrl: string;
  url: string;
}

interface ReleaseWire {
  tag_name?: string;
  html_url?: string;
}

interface ProfileWire {
  login?: string;
  name?: string;
  avatar_url?: string;
  html_url?: string;
}

const fetchJson = async <T>(url: string): Promise<T | null> => {
  try {
    const response = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
};

export const latestRelease = async (): Promise<Release | null> => {
  const data = await fetchJson<ReleaseWire>(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`);
  if (!data?.tag_name) return null;
  return { tag: data.tag_name, url: data.html_url ?? RELEASES_URL };
};

const profile = async (login: string, cacheKey: string): Promise<Profile | null> => {
  const cached = store.get<Profile | null>(cacheKey, null);
  if (cached) return cached;
  const data = await fetchJson<ProfileWire>(`https://api.github.com/users/${login}`);
  if (!data?.avatar_url) return null;
  const result: Profile = {
    login: data.login ?? login,
    name: data.name ?? null,
    avatarUrl: data.avatar_url,
    url: data.html_url ?? `https://github.com/${login}`,
  };
  store.set(cacheKey, result);
  return result;
};

export const ownerProfile = () => profile(OWNER, "github.profile.owner");

export const contributorProfile = () => profile(CONTRIBUTOR, "github.profile.contributor");
