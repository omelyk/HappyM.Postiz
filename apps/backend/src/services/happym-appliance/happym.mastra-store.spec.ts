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

describe('Social Manager Mastra store bootstrap', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shares one initialization across concurrent consumers', async () => {
    let finishInitialization!: () => void;
    const baseInitialization = new Promise<void>((resolve) => {
      finishInitialization = resolve;
    });
    const baseInit = jest
      .spyOn(PostgresStore.prototype, 'init')
      .mockReturnValue(baseInitialization);
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };
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
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_advisory_lock($1::bigint)',
      [732004211]
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      'SELECT pg_advisory_unlock($1::bigint)',
      [732004211]
    );
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('allows a clean retry after an initialization failure', async () => {
    const baseInit = jest
      .spyOn(PostgresStore.prototype, 'init')
      .mockRejectedValueOnce(new Error('init failed'))
      .mockResolvedValueOnce();
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };
    const store = new SocialManagerPostgresStore({
      id: 'test-store',
      pool: { connect: jest.fn().mockResolvedValue(client) } as any,
    });

    await expect(store.init()).rejects.toThrow('init failed');
    await expect(store.init()).resolves.toBeUndefined();

    expect(baseInit).toHaveBeenCalledTimes(2);
    expect(client.release).toHaveBeenCalledTimes(2);
  });
});
