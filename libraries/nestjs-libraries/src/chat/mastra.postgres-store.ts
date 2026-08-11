import { PostgresStore } from '@mastra/pg';

const MASTRA_INIT_LOCK_ID = 732004211;

export class SocialManagerPostgresStore extends PostgresStore {
  private initialization?: Promise<void>;

  override init(): Promise<void> {
    if (!this.initialization) {
      this.initialization = this.initializeOnce().catch((error) => {
        this.initialization = undefined;
        throw error;
      });
    }
    return this.initialization;
  }

  private async initializeOnce() {
    const client = await this.pool.connect();
    let lockAcquired = false;
    try {
      // Serializes Mastra DDL across concurrent Nest processes sharing the DB.
      await client.query('SELECT pg_advisory_lock($1::bigint)', [
        MASTRA_INIT_LOCK_ID,
      ]);
      lockAcquired = true;
      await super.init();
    } finally {
      try {
        if (lockAcquired) {
          await client.query('SELECT pg_advisory_unlock($1::bigint)', [
            MASTRA_INIT_LOCK_ID,
          ]);
        }
      } finally {
        client.release();
      }
    }
  }
}
