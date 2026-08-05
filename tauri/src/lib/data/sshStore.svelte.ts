import { store } from "$lib/platform/storage";

export interface SshProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  password: string;
  os: string | null;
}

const KEY = "ssh.profiles";
const DEFAULT_PORT = 22;

export const sshAddress = (profile: SshProfile) =>
  `${profile.user}@${profile.host}${profile.port === DEFAULT_PORT ? "" : `:${profile.port}`}`;

class SshStore {
  profiles = $state<SshProfile[]>(store.get(KEY, []));

  upsert(profile: SshProfile) {
    const known = this.profiles.some((item) => item.id === profile.id);
    this.#save(
      known ? this.profiles.map((item) => (item.id === profile.id ? profile : item)) : [...this.profiles, profile],
    );
  }

  remove(id: string) {
    this.#save(this.profiles.filter((item) => item.id !== id));
  }

  #save(profiles: SshProfile[]) {
    this.profiles = profiles;
    store.set(KEY, profiles);
  }
}

export const sshStore = new SshStore();
