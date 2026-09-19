import { secureStore } from "$lib/platform/secureStorage";
import { fetchUser, type DriveUser } from "./driveApi";
import {
  canRenewSilently,
  cancelConnect,
  connectTokens,
  refreshTokens,
  revokeTokens,
  silentTokens,
  type Tokens,
} from "./oauth";

const KEY = "drive.session";
const EXPIRY_MARGIN_MS = 60_000;

interface Stored {
  refresh: string;
  user: DriveUser | null;
  access?: string;
  expiresAt?: number;
}

const stored = secureStore.get<Stored | null>(KEY, null);

const usable = (session: Stored | null): boolean =>
  !!session?.access && Date.now() < (session.expiresAt ?? 0) - EXPIRY_MARGIN_MS;

class GoogleSession {
  user = $state<DriveUser | null>(stored?.user ?? null);
  connecting = $state(false);
  ready = $state(!!stored?.refresh || canRenewSilently() || usable(stored));

  #refresh = stored?.refresh ?? "";
  #access = usable(stored) ? (stored?.access ?? "") : "";
  #expiresAt = stored?.expiresAt ?? 0;

  readonly connected = $derived(this.user !== null);

  async connect(): Promise<boolean> {
    this.connecting = true;
    const tokens = await connectTokens();
    const adopted = tokens !== null && (await this.#adopt(tokens));
    this.connecting = false;
    return adopted;
  }

  cancel() {
    void cancelConnect();
  }

  async access(interactive: boolean): Promise<string> {
    const token = await this.token();
    if (token || !interactive) return token;
    return (await this.connect()) ? this.token() : "";
  }

  async renew(interactive: boolean): Promise<string> {
    this.#access = "";
    this.#expiresAt = 0;
    return this.access(interactive);
  }

  async token(): Promise<string> {
    if (this.#access && Date.now() < this.#expiresAt - EXPIRY_MARGIN_MS) return this.#access;
    const tokens = this.#refresh ? await refreshTokens(this.#refresh) : await silentTokens();
    if (!tokens) {
      this.ready = false;
      return "";
    }
    this.#access = tokens.accessToken;
    this.#expiresAt = tokens.expiresAt;
    this.ready = true;
    if (tokens.refreshToken) this.#refresh = tokens.refreshToken;
    this.#persist();
    return this.#access;
  }

  async disconnect() {
    const token = this.#access || this.#refresh;
    this.user = null;
    this.ready = false;
    this.#refresh = "";
    this.#access = "";
    this.#expiresAt = 0;
    secureStore.set(KEY, null);
    if (token) await revokeTokens(token);
  }

  async #adopt(tokens: Tokens): Promise<boolean> {
    this.#access = tokens.accessToken;
    this.#expiresAt = tokens.expiresAt;
    this.#refresh = tokens.refreshToken || this.#refresh;
    const user = await fetchUser(tokens.accessToken);
    if (!user) return false;
    this.user = user;
    this.ready = true;
    this.#persist();
    return true;
  }

  #persist() {
    secureStore.set<Stored>(KEY, {
      refresh: this.#refresh,
      user: this.user,
      access: this.#access,
      expiresAt: this.#expiresAt,
    });
  }
}

export const googleSession = new GoogleSession();
