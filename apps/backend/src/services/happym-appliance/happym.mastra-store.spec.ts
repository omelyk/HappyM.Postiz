jest.mock('@mastra/pg', () => ({
  PostgresStore: class {
    pool: any;

    constructor(config: { pool: any }) {
      this.pool = config.pool;
    }

    async init() {}
  },
}));

import { PostgresStore } from '@mastra/pg';
import { SocialManagerPostgresStore } from '@gitroom/nestjs-libraries/chat/mastra.postgres-store';
import { mastraStoreReadiness } from '@gitroom/nestjs-libraries/chat/mastra.readiness';

describe('Social Manager Mastra store bootstrap', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mastraStoreReadiness.reset();
  });

  const healthyClient = () => ({
    query: jest.fn().mockImplementation((sql: string) =>
      Promise.resolve(
        sql.includes('FROM pg_attribute')
          ? {
              rows: [
                {
                  tableExists: true,
                  totalSlots: '21',
                  droppedSlots: '0',
                  hasRequestContext: true,
                },
              ],
            }
          : { rows: [] }
      )
    ),
    release: jest.fn(),
  });

  it('shares one initialization across concurrent consumers', async () => {
    let finishInitialization!: () => void;
    const baseInitialization = new Promise<void>((resolve) => {
      finishInitialization = resolve;
    });
    const baseInit = jest
      .spyOn(PostgresStore.prototype, 'init')
      .mockReturnValue(baseInitialization);
    const client = healthyClient();
    const store = new SocialManagerPostgresStore({
      id: 'test-store',
      pool: { connect: jest.fn().mockResolvedValue(client) } as any,
    });

    const first = store.init();
    const second = store.init();
    await Promise.resolve();
    finishInitialization();
    await Promise.all([first, second]);

    expect(baseInit).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_lock($1::bigint)',
      [732004211]
    );
    expect(client.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_unlock($1::bigint)',
      [732004211]
    );
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(mastraStoreReadiness.snapshot.ready).toBe(true);
  });

  it('allows a clean retry after an initialization failure', async () => {
    const baseInit = jest
      .spyOn(PostgresStore.prototype, 'init')
      .mockRejectedValueOnce(new Error('init failed'))
      .mockResolvedValueOnce();
    const client = healthyClient();
    const store = new SocialManagerPostgresStore({
      id: 'test-store',
      pool: { connect: jest.fn().mockResolvedValue(client) } as any,
    });

    await expect(store.init()).rejects.toThrow('init failed');
    await expect(store.init()).resolves.toBeUndefined();

    expect(baseInit).toHaveBeenCalledTimes(2);
    expect(client.release).toHaveBeenCalledTimes(2);
  });

  it('recreates an exhausted observability table before Mastra adds a missing column', async () => {
    const baseInit = jest
      .spyOn(PostgresStore.prototype, 'init')
      .mockResolvedValue();
    const client = healthyClient();
    client.query.mockImplementation((sql: string) =>
      Promise.resolve(
        sql.includes('FROM pg_attribute')
          ? {
              rows: [
                {
                  tableExists: true,
                  totalSlots: '1600',
                  droppedSlots: '1579',
                  hasRequestContext: false,
                },
              ],
            }
          : { rows: [] }
      )
    );
    const store = new SocialManagerPostgresStore({
      id: 'test-store',
      pool: { connect: jest.fn().mockResolvedValue(client) } as any,
    });

    await expect(store.init()).resolves.toBeUndefined();

    expect(client.query).toHaveBeenCalledWith(
      'DROP TABLE IF EXISTS public.mastra_ai_spans'
    );
    expect(baseInit).toHaveBeenCalledTimes(1);
    expect(mastraStoreReadiness.snapshot).toEqual({
      ready: true,
      reason: null,
      reasonCode: null,
    });
  });

  it('fails soft with a stable readiness code if the exhausted schema cannot be repaired', async () => {
    const baseInit = jest
      .spyOn(PostgresStore.prototype, 'init')
      .mockResolvedValue();
    const client = healthyClient();
    client.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM pg_attribute')) {
        return Promise.resolve({
          rows: [
            {
              tableExists: true,
              totalSlots: '1600',
              droppedSlots: '1579',
              hasRequestContext: false,
            },
          ],
        });
      }
      if (sql.startsWith('DROP TABLE')) {
        return Promise.reject(new Error('dependent object'));
      }
      return Promise.resolve({ rows: [] });
    });
    const store = new SocialManagerPostgresStore({
      id: 'test-store',
      pool: { connect: jest.fn().mockResolvedValue(client) } as any,
    });

    await expect(store.init()).resolves.toBeUndefined();

    expect(baseInit).not.toHaveBeenCalled();
    expect(mastraStoreReadiness.snapshot).toEqual({
      ready: false,
      reason: 'mastra_pg_schema_unavailable',
      reasonCode: 'mastra_pg_schema',
    });
  });

  it('repairs a wrapped PostgreSQL 54011 error and retries initialization once', async () => {
    const columnLimit = Object.assign(
      new Error('tables can have at most 1600 columns'),
      {
        code: '54011',
      }
    );
    const baseInit = jest
      .spyOn(PostgresStore.prototype, 'init')
      .mockRejectedValueOnce(
        Object.assign(new Error('Mastra init failed'), { cause: columnLimit })
      )
      .mockResolvedValueOnce();
    const client = healthyClient();
    const store = new SocialManagerPostgresStore({
      id: 'test-store',
      pool: { connect: jest.fn().mockResolvedValue(client) } as any,
    });

    await expect(store.init()).resolves.toBeUndefined();

    expect(client.query).toHaveBeenCalledWith(
      'DROP TABLE IF EXISTS public.mastra_ai_spans'
    );
    expect(baseInit).toHaveBeenCalledTimes(2);
    expect(mastraStoreReadiness.snapshot.ready).toBe(true);
  });

  it('keeps column slots stable across repeated warm engine starts', async () => {
    const baseInit = jest
      .spyOn(PostgresStore.prototype, 'init')
      .mockResolvedValue();
    const clients = Array.from({ length: 10 }, () => healthyClient());

    for (const client of clients) {
      const store = new SocialManagerPostgresStore({
        id: 'test-store',
        pool: { connect: jest.fn().mockResolvedValue(client) } as any,
      });
      await store.init();
    }

    expect(baseInit).toHaveBeenCalledTimes(10);
    for (const client of clients) {
      expect(client.query).not.toHaveBeenCalledWith(
        'DROP TABLE IF EXISTS public.mastra_ai_spans'
      );
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM pg_attribute'),
        ['public.mastra_ai_spans']
      );
    }
    expect(mastraStoreReadiness.snapshot.ready).toBe(true);
  });
});
