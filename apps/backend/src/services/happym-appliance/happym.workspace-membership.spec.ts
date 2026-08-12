import { Role } from '@prisma/client';
import { HappyMApplianceService } from './happym.appliance.service';

describe('Social Manager SuperAdmin workspace memberships', () => {
  const originalEnvironment = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it('backfills access to every CRM-provisioned pharmacy workspace', async () => {
    const prisma = {
      organization: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'happym-system' },
            { id: 'FARMA1' },
            { id: 'FARMA2' },
          ]),
      },
      userOrganization: {
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new HappyMApplianceService(
      prisma as never,
      { snapshot: { ready: true } } as never
    );

    await (service as any).ensureAdminWorkspaceMemberships('admin-user');

    expect(prisma.userOrganization.upsert).toHaveBeenCalledTimes(3);
    expect(prisma.userOrganization.upsert).toHaveBeenCalledWith({
      where: {
        userId_organizationId: {
          userId: 'admin-user',
          organizationId: 'FARMA1',
        },
      },
      update: { disabled: false, role: Role.SUPERADMIN },
      create: {
        userId: 'admin-user',
        organizationId: 'FARMA1',
        disabled: false,
        role: Role.SUPERADMIN,
      },
    });
  });

  it('keeps the service SSO administrator separate from the local demo account', () => {
    process.env.HAPPYM_APPLIANCE_MODE = 'true';
    process.env.HAPPYM_APPLIANCE_ADMIN_EMAIL = 'service.admin@pharma.local';
    process.env.HAPPYM_APPLIANCE_ADMIN_PASSWORD = 'service-password-123';
    process.env.HAPPYM_APPLIANCE_INTERNAL_CLIENT_ID = 'pharma';
    process.env.HAPPYM_APPLIANCE_INTERNAL_CLIENT_SECRET = 'x'.repeat(32);
    process.env.HAPPYM_DEV_LOGIN_HINT = 'true';
    process.env.HAPPYM_DEV_LOGIN_EMAIL = 'superadmin';
    process.env.HAPPYM_DEV_LOGIN_PASSWORD = 'Demo123456';
    const service = new HappyMApplianceService({} as never, {} as never);

    const configuration = (service as any).configuration();

    expect(configuration.adminEmail).toBe('service.admin@pharma.local');
    expect(configuration.adminPassword).toBe('service-password-123');
    expect(configuration.devLoginHint).toEqual({
      email: 'superadmin@happym.local',
      password: 'Demo123456',
    });
  });
});
