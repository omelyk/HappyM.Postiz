import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { Provider, Role } from '@prisma/client';
import {
  localAdminEnabled, LOCAL_ADMIN_EMAIL, LOCAL_ADMIN_ID,
  LOCAL_ADMIN_INITIAL_PASSWORD, validateLocalAdminPassword, verifyInitialPasswordChallenge,
} from '@gitroom/nestjs-libraries/happym-appliance/happym.local-admin';

export async function ensureLocalAdmin(prisma: PrismaService) {
  if (!localAdminEnabled()) return;
  return prisma.$transaction(async tx => {
    const existing = await tx.user.findUnique({ where: { id: LOCAL_ADMIN_ID } });
    const emailOwner = await tx.user.findUnique({
      where: { email_providerName: { email: LOCAL_ADMIN_EMAIL, providerName: Provider.LOCAL } },
    });
    if ((existing && (existing.email !== LOCAL_ADMIN_EMAIL || existing.providerName !== Provider.LOCAL)) ||
        (emailOwner && emailOwner.id !== LOCAL_ADMIN_ID)) {
      throw new ConflictException('Local appliance administrator identity conflicts with an existing account');
    }
    const user = existing || await tx.user.create({ data: {
      id: LOCAL_ADMIN_ID, email: LOCAL_ADMIN_EMAIL, name: 'SuperAdmin Social Manager',
      providerName: Provider.LOCAL, password: AuthService.hashPassword(LOCAL_ADMIN_INITIAL_PASSWORD),
      activated: true, isSuperAdmin: true, timezone: 0,
    } });
    // Create missing memberships only. Never reset a password, reactivate an
    // account, or silently undo a disabled/reduced membership on restart.
    const organizations = await tx.organization.findMany({ select: { id: true } });
    for (const { id: organizationId } of organizations) {
      const membership = await tx.userOrganization.findUnique({
        where: { userId_organizationId: { userId: user.id, organizationId } },
      });
      if (!membership) await tx.userOrganization.create({ data: {
        userId: user.id, organizationId, role: Role.SUPERADMIN, disabled: false,
      } });
    }
    return user.id;
  });
}

@Injectable()
export class HappyMLocalAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async changeInitialPassword(token: string, password: unknown) {
    if (!localAdminEnabled()) throw new UnauthorizedException();
    validateLocalAdminPassword(password);
    const user = await this.prisma.user.findUnique({ where: { id: LOCAL_ADMIN_ID } });
    try {
      if (!user) throw new Error();
      verifyInitialPasswordChallenge(token, user);
    } catch {
      throw new UnauthorizedException('Richiesta scaduta. Accedi nuovamente.');
    }
    // Compare-and-set also makes concurrent/replayed challenge completion fail.
    const changed = await this.prisma.user.updateMany({
      where: { id: user.id, email: LOCAL_ADMIN_EMAIL, providerName: Provider.LOCAL,
        activated: true, isSuperAdmin: true, password: user.password },
      data: { password: AuthService.hashPassword(password) },
    });
    if (changed.count !== 1) throw new UnauthorizedException('Accedi nuovamente.');
    const { password: _password, ...sessionUser } = user;
    return { addedOrg: false, jwt: AuthService.signJWT(sessionUser) };
  }
}
