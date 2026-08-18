export const HAPPYM_EMBED_COOKIE = 'happym_embed';

export interface HappyMEmbedSessionContext {
  postizUserId: string;
  postizOrganizationId: string;
  tenantId: string;
  pharmacyId: string;
  userId: string;
  allowedIntegrationIds: string[];
  origin: string;
  correlationId: string;
  expiresAt: string;
  purpose: 'composer' | 'connect' | 'workspace';
  provider?: string | null;
  landingPath?: '/launches' | '/media' | null;
}

export interface HappyMEmbedSessionClaims extends HappyMEmbedSessionContext {
  kind: 'happym-embed';
}
