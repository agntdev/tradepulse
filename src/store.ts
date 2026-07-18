// Persistent store for durable domain data (users, signals, admins).
// Uses Redis when REDIS_URL is set, in-memory Map otherwise (dev/test).
// NEVER use in-memory for durable data in production — this is the dev fallback.

import { createRequire } from "node:module";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UserRecord {
  telegram_id: number;
  username: string;
  is_premium: boolean;
  is_opted_out: boolean;
  registered_at: string; // ISO 8601
  last_signal_received: string | null; // ISO 8601
}

export interface SignalRecord {
  symbol: string;
  direction: "LONG" | "SHORT";
  signal_type: "public" | "premium";
  timestamp: string; // ISO 8601
  admin_id: number;
  entry_price: string;
  stop_loss: string;
  take_profit: string;
  recommended_size: string;
  confidence_level: string;
  rationale: string;
}

export interface AdminRecord {
  telegram_id: number;
  permissions: string[];
}

// ─── Store interface ────────────────────────────────────────────────────────

export interface Store {
  // Users
  getUser(telegramId: number): Promise<UserRecord | null>;
  saveUser(user: UserRecord): Promise<void>;
  listUserIds(): Promise<number[]>;

  // Signals
  saveSignal(signal: SignalRecord): Promise<void>;
  listSignals(limit?: number): Promise<SignalRecord[]>;

  // Admins
  getAdmin(telegramId: number): Promise<AdminRecord | null>;
  saveAdmin(admin: AdminRecord): Promise<void>;
  listAdminIds(): Promise<number[]>;
}

// ─── Redis-backed store ─────────────────────────────────────────────────────

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
}

class RedisStore implements Store {
  constructor(private readonly client: RedisLike) {}

  private k(entity: string, id: string): string {
    return `store:${entity}:${id}`;
  }

  async getUser(telegramId: number): Promise<UserRecord | null> {
    const raw = await this.client.get(this.k("user", String(telegramId)));
    return raw ? (JSON.parse(raw) as UserRecord) : null;
  }

  async saveUser(user: UserRecord): Promise<void> {
    await this.client.set(this.k("user", String(user.telegram_id)), JSON.stringify(user));
  }

  async listUserIds(): Promise<number[]> {
    const keys = await this.client.keys(this.k("user", "*"));
    return keys.map((k) => Number(k.split(":").pop()));
  }

  async saveSignal(signal: SignalRecord): Promise<void> {
    const id = `${signal.timestamp}_${signal.symbol}`;
    await this.client.set(this.k("signal", id), JSON.stringify(signal));
  }

  async listSignals(limit = 50): Promise<SignalRecord[]> {
    const keys = await this.client.keys(this.k("signal", "*"));
    const signals: SignalRecord[] = [];
    for (const key of keys) {
      const raw = await this.client.get(key);
      if (raw) signals.push(JSON.parse(raw) as SignalRecord);
    }
    return signals.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
  }

  async getAdmin(telegramId: number): Promise<AdminRecord | null> {
    const raw = await this.client.get(this.k("admin", String(telegramId)));
    return raw ? (JSON.parse(raw) as AdminRecord) : null;
  }

  async saveAdmin(admin: AdminRecord): Promise<void> {
    await this.client.set(this.k("admin", String(admin.telegram_id)), JSON.stringify(admin));
  }

  async listAdminIds(): Promise<number[]> {
    const keys = await this.client.keys(this.k("admin", "*"));
    return keys.map((k) => Number(k.split(":").pop()));
  }
}

// ─── In-memory fallback (dev / test harness) ────────────────────────────────

class MemoryStore implements Store {
  private users = new Map<string, UserRecord>();
  private signals = new Map<string, SignalRecord>();
  private admins = new Map<string, AdminRecord>();

  async getUser(telegramId: number): Promise<UserRecord | null> {
    return this.users.get(String(telegramId)) ?? null;
  }

  async saveUser(user: UserRecord): Promise<void> {
    this.users.set(String(user.telegram_id), user);
  }

  async listUserIds(): Promise<number[]> {
    return [...this.users.keys()].map(Number);
  }

  async saveSignal(signal: SignalRecord): Promise<void> {
    const id = `${signal.timestamp}_${signal.symbol}`;
    this.signals.set(id, signal);
  }

  async listSignals(limit = 50): Promise<SignalRecord[]> {
    return [...this.signals.values()]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }

  async getAdmin(telegramId: number): Promise<AdminRecord | null> {
    return this.admins.get(String(telegramId)) ?? null;
  }

  async saveAdmin(admin: AdminRecord): Promise<void> {
    this.admins.set(String(admin.telegram_id), admin);
  }

  async listAdminIds(): Promise<number[]> {
    return [...this.admins.keys()].map(Number);
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

let cachedStore: Store | null = null;

/**
 * Get the singleton persistent store. Uses Redis when REDIS_URL is set,
 * in-memory otherwise. Cached after first call for the process lifetime.
 */
export function getStore(): Store {
  if (cachedStore) return cachedStore;

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const require = createRequire(import.meta.url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ioredis: any = require("ioredis");
    const Redis = ioredis.default ?? ioredis.Redis ?? ioredis;
    const client = new Redis(redisUrl, { maxRetriesPerRequest: null, lazyConnect: false });
    cachedStore = new RedisStore(client as RedisLike);
  } else {
    cachedStore = new MemoryStore();
  }

  return cachedStore;
}

/** Reset the cached store (test-only). */
export function _resetStore(): void {
  cachedStore = null;
}
