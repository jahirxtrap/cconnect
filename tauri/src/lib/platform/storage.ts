const PREFIX = "cconnect.";

class Store {
  get<T>(key: string, fallback: T): T {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  set<T>(key: string, value: T) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  }

  remove(key: string) {
    localStorage.removeItem(PREFIX + key);
  }
}

export const store = new Store();
