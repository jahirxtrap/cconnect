import { secureStore } from "$lib/platform/secureStorage";
import { fetchUser, type DriveUser } from "./driveApi";
import { cancelConnect, connectTokens, refreshTokens, revokeTokens, silentTokens, type Tokens } from "./oauth";

const KEY = "drive.session";
const EXPIRY_MARGIN_MS = 60_000;

interface Stored {
  refresh: string;
  user: DriveUser | null;
}

const stored = secureStore.get<Stored | null>(KEY, null);

class GoogleSession {
  user = $state<DriveUser | null>(stored?.user ?? null);
  connecting = $state(false);

  #refresh = stored?.refresh ?? "";
  #access = "";
  #expiresAt = 0;

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

  async token(): Promise<string> {
    if (this.#access && Date.now() < this.#expiresAt - EXPIRY_MARGIN_MS) return this.#access;
    const tokens = this.#refresh ? await refreshTokens(this.#refresh) : await silentTokens();
    if (!tokens) return "";
    this.#access = tokens.accessToken;
    this.#expiresAt = tokens.expiresAt;
    if (tokens.refreshToken) {
      this.#refresh = tokens.refreshToken;
      this.#persist();
    }
    return this.#access;
  }

  async disconnect() {
    const token = this.#access || this.#refresh;
    this.user = null;
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
    this.#persist();
    return true;
  }

  #persist() {
    secureStore.set<Stored>(KEY, { refresh: this.#refresh, user: this.user });
  }
}

export const googleSession = new GoogleSession();
