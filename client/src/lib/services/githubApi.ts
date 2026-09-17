import { platformName } from "$lib/platform";
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
  installerUrl: string | null;
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
  assets?: Array<{ name?: string; browser_download_url?: string }>;
}

const installerExtensions = (): string[] => {
  const name = platformName();
  if (name === "windows") return [".msi", ".exe"];
  if (name === "macos") return [".dmg"];
  if (name === "linux") return [".deb", ".rpm", ".AppImage"];
  if (name === "android") return [".apk"];
  return [];
};

interface ProfileWire {
  login?: string;
  name?: string;
  avatar_url?: string;
  html_url?: string;
}

const ATTEMPTS = 3;
const RETRY_DELAY_MS = 600;
const TIMEOUT_MS = 15_000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchOnce = async (url: string, headers: HeadersInit): Promise<Response | null> => {
  try {
    return await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    return null;
  }
};

const request = async (url: string, headers: HeadersInit = {}): Promise<Response | null> => {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (attempt > 0) await wait(RETRY_DELAY_MS << (attempt - 1));
    const response = await fetchOnce(url, headers);
    if (response?.ok) return response;
    if (response && response.status < 500) return null;
  }
  return null;
};

const fetchJson = async <T>(url: string): Promise<T | null> => {
  const response = await request(url, { Accept: "application/vnd.github+json" });
  if (!response) return null;
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

const installerFor = (assets: ReleaseWire["assets"]): string | null => {
  const listed = (assets ?? []).filter((asset) => !!asset.browser_download_url);
  for (const extension of installerExtensions()) {
    const match = listed.find((asset) => asset.browser_download_url!.endsWith(extension));
    if (match) return match.browser_download_url!;
  }
  return null;
};

export const latestRelease = async (): Promise<Release | null> => {
  const data = await fetchJson<ReleaseWire>(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`);
  if (!data?.tag_name) return null;
  return {
    tag: data.tag_name,
    url: data.html_url ?? RELEASES_URL,
    installerUrl: installerFor(data.assets),
  };
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

export interface ReleaseNotes {
  tag: string;
  body: string;
}

const CHANGELOG_SECTIONS = 30;
const CLAUDE_CHANGELOG_URL = "https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md";
const CLAUDE_CACHE_KEY = "claude.changelog";
const SDK_CHANGELOG_URL =
  "https://raw.githubusercontent.com/anthropics/claude-agent-sdk-python/main/CHANGELOG.md";
const SDK_CACHE_KEY = "sdk.changelog";

interface ChangelogCache {
  version: string;
  items: ReleaseNotes[];
}

const parseChangelog = (markdown: string): ReleaseNotes[] =>
  markdown
    .split(/^## /m)
    .slice(1, CHANGELOG_SECTIONS + 1)
    .map((block) => {
      const lines = block.trim().split("\n");
      const tag = lines[0]?.trim();
      return tag ? { tag, body: lines.slice(1).join("\n").trim() } : null;
    })
    .filter((note): note is ReleaseNotes => note !== null);

const RELEASES_CACHE_KEY = "github.changelog";
const RELEASES_PER_PAGE = 50;

export const releaseNotes = async (appVersion: string): Promise<ReleaseNotes[] | null> => {
  const cached = store.get<ChangelogCache | null>(RELEASES_CACHE_KEY, null);
  if (cached?.version === appVersion) return cached.items;
  const data = await fetchJson<Array<{ tag_name?: string; body?: string }>>(
    `https://api.github.com/repos/${OWNER}/${REPO}/releases?per_page=${RELEASES_PER_PAGE}`,
  );
  if (!Array.isArray(data)) return cached?.items ?? null;
  const items = data
    .filter((release) => release.tag_name)
    .map((release) => ({ tag: release.tag_name!, body: release.body ?? "" }));
  store.set(RELEASES_CACHE_KEY, { version: appVersion, items });
  return items;
};

const markdownChangelog = async (
  url: string,
  cacheKey: string,
  version: string | null,
): Promise<ReleaseNotes[] | null> => {
  const cached = store.get<ChangelogCache | null>(cacheKey, null);
  if (version && cached?.version === version) return cached.items;
  const response = await request(url);
  if (!response) return cached?.items ?? null;
  const items = parseChangelog(await response.text());
  store.set(cacheKey, { version: version ?? "", items });
  return items;
};

export const claudeChangelog = (cliVersion: string | null): Promise<ReleaseNotes[] | null> =>
  markdownChangelog(CLAUDE_CHANGELOG_URL, CLAUDE_CACHE_KEY, cliVersion);

export const sdkChangelog = (sdkVersion: string | null): Promise<ReleaseNotes[] | null> =>
  markdownChangelog(SDK_CHANGELOG_URL, SDK_CACHE_KEY, sdkVersion);
