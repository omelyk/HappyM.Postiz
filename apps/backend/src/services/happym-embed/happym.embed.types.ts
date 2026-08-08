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
}

export interface HappyMEmbedSessionClaims extends HappyMEmbedSessionContext {
  kind: 'happym-embed';
}
