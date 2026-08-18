import { PostgresStore } from '@mastra/pg';
import { Logger } from '@nestjs/common';
import { mastraStoreReadiness } from './mastra.readiness';

const MASTRA_INIT_LOCK_ID = 732004211;
const OBSERVABILITY_TABLE = 'public.mastra_ai_spans';
const POSTGRES_COLUMN_LIMIT = 1600;

export class SocialManagerPostgresStore extends PostgresStore {
  private readonly socialManagerLogger = new Logger(
    SocialManagerPostgresStore.name
  );
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
      const schemaReady = await this.repairExhaustedObservabilityTable(client);
      if (!schemaReady) {
        mastraStoreReadiness.markSchemaUnavailable();
        this.logSchemaUnavailable();
        return;
      }
      try {
        await super.init();
        mastraStoreReadiness.markReady();
      } catch (error) {
        if (!this.isPostgresColumnLimit(error)) {
          throw error;
        }

        try {
          await this.recreateObservabilityTable(client);
          await super.init();
          mastraStoreReadiness.markReady();
        } catch {
          mastraStoreReadiness.markSchemaUnavailable();
          this.logSchemaUnavailable();
        }
      }
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

  private async repairExhaustedObservabilityTable(client: any) {
    const result = await client.query(
      `SELECT
         to_regclass($1) IS NOT NULL AS "tableExists",
         count(*) FILTER (WHERE attnum > 0) AS "totalSlots",
         count(*) FILTER (WHERE attnum > 0 AND attisdropped) AS "droppedSlots",
         coalesce(bool_or(attname = 'requestContext' AND NOT attisdropped), false) AS "hasRequestContext"
       FROM pg_attribute
       WHERE attrelid = to_regclass($1)`,
      [OBSERVABILITY_TABLE]
    );
    const schema = result.rows?.[0];
    if (!schema?.tableExists || schema.hasRequestContext) return true;

    const totalSlots = Number(schema.totalSlots || 0);
    if (totalSlots < POSTGRES_COLUMN_LIMIT) return true;

    this.socialManagerLogger.warn(
      `Social Manager is rebuilding its exhausted AI observability table (${Number(
        schema.droppedSlots || 0
      )} retired column slots)`
    );
    try {
      await this.recreateObservabilityTable(client);
      return true;
    } catch {
      return false;
    }
  }

  private async recreateObservabilityTable(client: any) {
    // This table contains disposable AI traces, never editorial posts or media.
    // Dropping it resets pg_attribute attnum slots; super.init() recreates the
    // canonical table, constraints and indexes while the advisory lock is held.
    await client.query('DROP TABLE IF EXISTS public.mastra_ai_spans');
  }

  private isPostgresColumnLimit(error: unknown) {
    let current: any = error;
    for (let depth = 0; current && depth < 8; depth++) {
      if (
        current.code === '54011' ||
        current.id === 'MASTRA_STORAGE_PG_ALTER_TABLE_FAILED' ||
        String(current.message || '').includes('at most 1600 columns')
      ) {
        return true;
      }
      current = current.cause;
    }
    return false;
  }

  private logSchemaUnavailable() {
    this.socialManagerLogger.error(
      'Social Manager AI storage schema is unavailable; the editorial engine remains online'
    );
  }
}
