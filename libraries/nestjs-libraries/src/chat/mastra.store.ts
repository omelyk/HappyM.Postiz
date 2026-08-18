import { SocialManagerPostgresStore } from './mastra.postgres-store';

export const pStore = new SocialManagerPostgresStore({
  id: 'postiz-store',
  connectionString: process.env.DATABASE_URL!,
});
