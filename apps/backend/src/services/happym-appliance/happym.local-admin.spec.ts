import { AuthService } from '@gitroom/helpers/auth/auth.service';
import {
  initialPasswordChallenge, initialPasswordRequired, LOCAL_ADMIN_EMAIL, LOCAL_ADMIN_ID,
  LOCAL_ADMIN_INITIAL_PASSWORD, validateLocalAdminPassword, verifyInitialPasswordChallenge,
} from '@gitroom/nestjs-libraries/happym-appliance/happym.local-admin';
import { ensureLocalAdmin, HappyMLocalAdminService } from './happym.local-admin.service';

describe('Social Manager installation-local administrator', () => {
  const environment = { ...process.env };
  const initialHash = AuthService.hashPassword(LOCAL_ADMIN_INITIAL_PASSWORD);
  const changedHash = AuthService.hashPassword('operator-chosen-password-123');
  const initial = () => ({ id: LOCAL_ADMIN_ID, email: LOCAL_ADMIN_EMAIL,
    providerName: 'LOCAL', activated: true, isSuperAdmin: true, password: initialHash });
  beforeEach(() => {
    process.env.HAPPYM_APPLIANCE_MODE = 'true';
    process.env.HAPPYM_APPLIANCE_LOCAL_ADMIN_ENABLED = 'true';
    process.env.JWT_SECRET = 'unit-test-only-not-a-deployment-secret';
  });
  afterEach(() => { process.env = { ...environment }; });

  it('issues a five-minute password-change challenge that is not an authentication session', () => {
    const user = initial();
    expect(initialPasswordRequired(user)).toBe(true);
    const token = initialPasswordChallenge(user);
    const claims = AuthService.verifyJWT(token) as any;
    expect(claims.id).toBeUndefined();
    expect(claims.sub).toBe(LOCAL_ADMIN_ID);
    expect(claims.exp - claims.iat).toBe(300);
    expect(() => verifyInitialPasswordChallenge(token, user)).not.toThrow();
    expect(() => verifyInitialPasswordChallenge(token, { ...user, password: changedHash })).toThrow();
  });

  it('rejects a normal auth JWT and an expired change challenge', () => {
    const user = initial();
    expect(() => verifyInitialPasswordChallenge(AuthService.signJWT({ id: user.id }), user)).toThrow();
    const claims = AuthService.verifyJWT(initialPasswordChallenge(user)) as any;
    expect(() => verifyInitialPasswordChallenge(AuthService.signJWT({ ...claims, exp: 1 }), user)).toThrow();
  });

  it('does not impose the initial-password flow on the CRM/service administrator', () => {
    expect(initialPasswordRequired({ ...initial(), id: 'service-admin', email: 'service@example.test' })).toBe(false);
    expect(initialPasswordRequired({ ...initial(), password: changedHash })).toBe(false);
  });

  it('refuses weak passwords before touching any database', async () => {
    for (const password of ['changeme', 'short', '', null, 'x'.repeat(257)]) {
      expect(() => validateLocalAdminPassword(password)).toThrow();
    }
    const prisma = { user: { findUnique: jest.fn() } };
    const service = new HappyMLocalAdminService(prisma as never);
    await expect(service.changeInitialPassword('unused', 'changeme')).rejects.toThrow();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('changes once with a database compare-and-set and never puts a password into the auth JWT', async () => {
    let current = initial();
    const prisma = { user: {
      findUnique: jest.fn(async () => ({ ...current })),
      updateMany: jest.fn(async ({ where, data }: { where: { password: string }; data: { password: string } }) => {
        if (where.password !== current.password) return { count: 0 };
        current = { ...current, password: data.password };
        return { count: 1 };
      }),
    } };
    const service = new HappyMLocalAdminService(prisma as never);
    const token = initialPasswordChallenge(current);
    const result = await service.changeInitialPassword(token, 'operator-chosen-password-123');
    expect(AuthService.comparePassword('operator-chosen-password-123', current.password)).toBe(true);
    const claims = AuthService.verifyJWT(result.jwt) as any;
    expect(claims.id).toBe(LOCAL_ADMIN_ID);
    expect(claims.password).toBeUndefined();
    await expect(service.changeInitialPassword(token, 'another-operator-password-123')).rejects.toThrow();
    expect(prisma.user.updateMany).toHaveBeenCalledTimes(1);
  });

  it('does not issue a session when a concurrent password update wins', async () => {
    const user = initial();
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(user),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    await expect(new HappyMLocalAdminService(prisma as never)
      .changeInitialPassword(initialPasswordChallenge(user), 'operator-chosen-password-123')).rejects.toThrow();
  });

  function store(existing: ReturnType<typeof initial> | null = null, emailOwner = existing) {
    const tx = {
      user: {
        findUnique: jest.fn(async ({ where }: { where: { id?: string } }) => where.id ? existing : emailOwner),
        create: jest.fn(async ({ data }: { data: ReturnType<typeof initial> }) => data), update: jest.fn(), upsert: jest.fn(),
      },
      organization: { findMany: jest.fn().mockResolvedValue([{ id: 'appliance-system' }]) },
      userOrganization: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
    };
    return { tx, prisma: { $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)) } };
  }

  it('creates the local superadmin and its real workspace membership on a fresh install', async () => {
    const { tx, prisma } = store();
    expect(await ensureLocalAdmin(prisma as never)).toBe(LOCAL_ADMIN_ID);
    const created = tx.user.create.mock.calls[0][0].data;
    expect(created.isSuperAdmin).toBe(true);
    expect(created.activated).toBe(true);
    expect(AuthService.comparePassword('changeme', created.password)).toBe(true);
    expect(tx.userOrganization.create).toHaveBeenCalledWith({ data: {
      userId: LOCAL_ADMIN_ID, organizationId: 'appliance-system', role: 'SUPERADMIN', disabled: false,
    } });
  });

  it('preserves changed credentials and existing disabled membership across bootstrap/restart', async () => {
    const user = { ...initial(), password: changedHash };
    const { tx, prisma } = store(user);
    tx.userOrganization.findUnique.mockResolvedValue({ disabled: true, role: 'USER' } as never);
    await ensureLocalAdmin(prisma as never);
    await ensureLocalAdmin(prisma as never);
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.user.upsert).not.toHaveBeenCalled();
    expect(tx.userOrganization.create).not.toHaveBeenCalled();
    expect(user.password).toBe(changedHash);
  });

  it('fails without promoting an existing unrelated email owner', async () => {
    const { tx, prisma } = store(null, { ...initial(), id: 'another-person' });
    await expect(ensureLocalAdmin(prisma as never)).rejects.toThrow();
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('has no installation or password-change side effects when explicitly disabled', async () => {
    process.env.HAPPYM_APPLIANCE_LOCAL_ADMIN_ENABLED = 'false';
    const { prisma } = store();
    expect(await ensureLocalAdmin(prisma as never)).toBeUndefined();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    await expect(new HappyMLocalAdminService(prisma as never)
      .changeInitialPassword('unused', 'operator-chosen-password-123')).rejects.toThrow();
  });
});
