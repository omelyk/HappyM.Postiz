import { Role } from '@prisma/client';
import { HappyMApplianceService } from './happym.appliance.service';

describe('Social Manager SuperAdmin workspace memberships', () => {
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
});
