import { createClient } from 'redis';

const url = process.env.REDIS_URL ?? 'redis://localhost:6379';

type RedisClientInstance = ReturnType<typeof createClient>;
let _client: RedisClientInstance | null = null;
let _connecting: Promise<RedisClientInstance> | null = null;

async function getClient(): Promise<RedisClientInstance> {
  if (_client?.isReady) return _client;
  if (_connecting) return _connecting;

  _connecting = (async () => {
    const client = createClient({ url });
    client.on('error', (err) => console.error('Redis client error:', err));
    await client.connect();
    _client = client;
    return client;
  })();

  return _connecting;
}

export const redisClient = {
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    const c = await getClient();
    await c.set(key, value, { EX: ttlSeconds });
  },

  async get(key: string): Promise<string | null> {
    const c = await getClient();
    return c.get(key);
  },

  async getDel(key: string): Promise<string | null> {
    const c = await getClient();
    return c.getDel(key);
  },

  async del(key: string): Promise<void> {
    const c = await getClient();
    await c.del(key);
  },

  async quit(): Promise<void> {
    if (_client) {
      await _client.quit().catch(() => {});
      _client = null;
      _connecting = null;
    }
  },
};
