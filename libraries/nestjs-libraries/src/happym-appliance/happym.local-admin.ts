import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';

// Installation-local operator identity; unrelated to CRM/M2M credentials.
export const LOCAL_ADMIN_ID = 'social-manager.local-superadmin';
export const LOCAL_ADMIN_EMAIL = 'superadmin@social-manager.local';
export const LOCAL_ADMIN_INITIAL_PASSWORD = 'changeme';
const CHANGE_PURPOSE = 'social-manager.initial-password-change/v1';

export type LocalAdminUser = {
  id: string;
  email: string;
  providerName: string;
  password?: string | null;
  activated: boolean;
  isSuperAdmin: boolean;
};

export const localAdminEnabled = () =>
  process.env.HAPPYM_APPLIANCE_MODE === 'true' &&
  process.env.HAPPYM_APPLIANCE_LOCAL_ADMIN_ENABLED !== 'false';

export const isLocalAdmin = (user: LocalAdminUser) =>
  user.id === LOCAL_ADMIN_ID && user.email === LOCAL_ADMIN_EMAIL &&
  user.providerName === 'LOCAL' && user.activated && user.isSuperAdmin;

export const localAdminAccessDisabled = (user: LocalAdminUser) =>
  user.id === LOCAL_ADMIN_ID && (!localAdminEnabled() || !isLocalAdmin(user));

export const initialPasswordRequired = (user: LocalAdminUser) =>
  localAdminEnabled() && isLocalAdmin(user) && !!user.password &&
  AuthService.comparePassword(LOCAL_ADMIN_INITIAL_PASSWORD, user.password);

export function validateLocalAdminPassword(password: unknown): asserts password is string {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256 ||
      password.trim().toLowerCase() === LOCAL_ADMIN_INITIAL_PASSWORD) {
    throw new BadRequestException('La nuova password deve contenere da 12 a 256 caratteri.');
  }
}

const credentialTag = (user: LocalAdminUser) => createHmac('sha256', process.env.JWT_SECRET!)
  .update(CHANGE_PURPOSE).update('\0').update(user.password || '').digest('hex');

export const initialPasswordChallenge = (user: LocalAdminUser) => AuthService.signJWT({
  // Deliberately no `id`: AuthMiddleware must never accept this as a session.
  purpose: CHANGE_PURPOSE,
  sub: user.id,
  credentialTag: credentialTag(user),
  exp: Math.floor(Date.now() / 1000) + 5 * 60,
});

export function verifyInitialPasswordChallenge(token: string, user: LocalAdminUser) {
  const claims = AuthService.verifyJWT(token) as {
    purpose?: string; sub?: string; credentialTag?: string; exp?: number; id?: unknown;
  };
  if (!initialPasswordRequired(user) || claims.purpose !== CHANGE_PURPOSE ||
      claims.sub !== user.id || claims.id !== undefined || typeof claims.exp !== 'number' ||
      claims.exp <= Math.floor(Date.now() / 1000) ||
      !/^[a-f0-9]{64}$/.test(claims.credentialTag || '') ||
      !timingSafeEqual(Buffer.from(claims.credentialTag!, 'hex'), Buffer.from(credentialTag(user), 'hex'))) {
    throw new Error('Richiesta scaduta. Accedi nuovamente.');
  }
}
