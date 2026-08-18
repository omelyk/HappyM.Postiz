export type MastraStoreReadinessSnapshot = {
  ready: boolean;
  reason: string | null;
  reasonCode: 'mastra_pg_schema' | null;
};

class MastraStoreReadiness {
  private current: MastraStoreReadinessSnapshot = {
    ready: false,
    reason: null,
    reasonCode: null,
  };

  get snapshot() {
    return this.current;
  }

  markReady() {
    this.current = { ready: true, reason: null, reasonCode: null };
  }

  markSchemaUnavailable() {
    this.current = {
      ready: false,
      reason: 'mastra_pg_schema_unavailable',
      reasonCode: 'mastra_pg_schema',
    };
  }

  reset() {
    this.current = { ready: false, reason: null, reasonCode: null };
  }
}

export const mastraStoreReadiness = new MastraStoreReadiness();
