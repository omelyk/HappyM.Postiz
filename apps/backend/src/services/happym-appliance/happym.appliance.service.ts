import {
  ConflictException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { Provider, Role } from '@prisma/client';
import { TemporalSearchAttributesReadiness } from '@gitroom/nestjs-libraries/temporal/temporal.register';

export type EnsureOrganizationRequest = {
  organizationId?: string;
  pharmacyCode: string;
  name?: string;
};

export type EnsureUserRequest = {
  organizationId: string;
  userId: string;
  email?: string;
  displayName?: string;
  role?: 'USER' | 'ADMIN';
};

@Injectable()
export class HappyMApplianceService implements OnApplicationBootstrap {
  private readonly logger = new Logger(HappyMApplianceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly temporalReadiness: TemporalSearchAttributesReadiness
  ) {}

  async onApplicationBootstrap() {
    if (this.enabled) {
      await this.ensureBootstrap();
      this.logger.log('Social Manager appliance bootstrap is ready');
    }
  }

  get enabled() {
    return process.env.HAPPYM_APPLIANCE_MODE === 'true';
  }

  async health() {
    if (!this.enabled) {
      return { up: true, applianceMode: false, ready: false };
    }

    try {
      const status = await this.status();
      return {
        up: true,
        applianceMode: true,
        ready: status.ready,
        reason: status.reason,
      };
    } catch {
      return {
        up: true,
        applianceMode: true,
        ready: false,
        reason: 'appliance_bootstrap_unavailable',
      };
    }
  }

  async status() {
    const config = this.configuration();
    const organization = await this.prisma.organization.findUnique({
      where: { id: config.systemOrganizationId },
      select: {
        id: true,
        apiKey: true,
        users: {
          where: { user: { email: config.adminEmail } },
          select: {
            disabled: true,
            role: true,
            user: { select: { id: true } },
          },
        },
      },
    });
    const applianceReady = !!organization?.apiKey && !!organization.users[0]?.user.id;
    const temporal = this.temporalReadiness.snapshot;
    const ready = applianceReady && temporal.ready;
    return {
      up: true,
      apiOk: true,
      applianceMode: true,
      ready,
      reason: ready
        ? null
        : temporal.reason || 'appliance_bootstrap_unavailable',
      productName: config.productName,
      systemOrganizationId: ready ? organization.id : null,
      adminProvisioned: !!organization?.users[0]?.user.id,
      serviceKeyProvisioned: !!organization?.apiKey,
    };
  }

  async provisionCredentials() {
    this.assertReady();
    const bootstrap = await this.ensureBootstrap();
    return {
      apiKey: bootstrap.apiKey,
      organizationId: bootstrap.organizationId,
      issuedAt: new Date().toISOString(),
      rotated: false,
    };
  }

  async rotateCredentials() {
    this.assertReady();
    const config = this.configuration();
    await this.ensureBootstrap();
    const organization = await this.prisma.organization.update({
      where: { id: config.systemOrganizationId },
      data: { apiKey: AuthService.fixedEncryption(makeId(32)) },
      select: { id: true, apiKey: true },
    });
    this.logger.warn('Social Manager service API key rotated');
    return {
      apiKey: organization.apiKey!,
      organizationId: organization.id,
      issuedAt: new Date().toISOString(),
      rotated: true,
    };
  }

  async ensureOrganization(body: EnsureOrganizationRequest) {
    this.assertReady();
    const pharmacyCode = this.identifier(body.pharmacyCode, 'pharmacyCode');
    const organizationId = this.identifier(
      body.organizationId || `happym-pharmacy-${pharmacyCode.toLowerCase()}`,
      'organizationId'
    );
    const name = this.text(
      body.name || `Social Manager · ${pharmacyCode}`,
      'name',
      160
    );

    const organization = await this.prisma.organization.upsert({
      where: { id: organizationId },
      update: {},
      create: {
        id: organizationId,
        name,
        allowTrial: false,
        isTrailing: false,
        apiKey: AuthService.fixedEncryption(makeId(32)),
        subscription: {
          create: {
            totalChannels: 1000000,
            subscriptionTier: 'ULTIMATE',
            isLifetime: true,
            period: 'YEARLY',
          },
        },
      },
      select: { id: true, name: true, createdAt: true },
    });
    this.logger.log(`Ensured pharmacy organization ${organization.id}`);
    return { ...organization, pharmacyCode };
  }

  async ensureUser(body: EnsureUserRequest) {
    this.assertReady();
    const organizationId = this.identifier(
      body.organizationId,
      'organizationId'
    );
    const userId = this.identifier(body.userId, 'userId');
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!organization) {
      throw new ConflictException('Organization does not exist');
    }

    const email = this.email(
      body.email || `${userId}+${organizationId}@social-manager.happym.local`
    );
    const displayName = this.text(
      body.displayName || `HappyM ${userId}`,
      'displayName',
      160
    );
    const existingById = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    const existingByEmail = await this.prisma.user.findUnique({
      where: { email_providerName: { email, providerName: Provider.LOCAL } },
      select: { id: true },
    });
    if (existingByEmail && existingByEmail.id !== userId) {
      throw new ConflictException('Email is already assigned to another user');
    }

    const user = existingById
      ? await this.prisma.user.update({
          where: { id: userId },
          data: { activated: true },
          select: { id: true, email: true, name: true },
        })
      : await this.prisma.user.create({
          data: {
            id: userId,
            email,
            name: displayName,
            providerName: Provider.LOCAL,
            password: AuthService.hashPassword(makeId(64)),
            activated: true,
            timezone: 0,
          },
          select: { id: true, email: true, name: true },
        });

    const membership = await this.prisma.userOrganization.upsert({
      where: {
        userId_organizationId: { userId: user.id, organizationId },
      },
      update: { disabled: false, role: body.role || Role.USER },
      create: {
        userId: user.id,
        organizationId,
        disabled: false,
        role: body.role || Role.USER,
      },
      select: { role: true, disabled: true },
    });
    this.logger.log(`Ensured service user ${user.id} in ${organizationId}`);
    return { ...user, organizationId, ...membership };
  }

  async resetAdminPassword(password: string) {
    this.assertReady();
    const config = this.configuration();
    this.password(password);
    const user = await this.prisma.user.findUnique({
      where: {
        email_providerName: {
          email: config.adminEmail,
          providerName: Provider.LOCAL,
        },
      },
      select: { id: true },
    });
    if (!user) {
      throw new ConflictException('Appliance administrator is not provisioned');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: AuthService.hashPassword(password), activated: true },
    });
    this.logger.warn('Social Manager appliance administrator password reset');
    return { reset: true, adminUserId: user.id };
  }

  private async ensureBootstrap() {
    const config = this.configuration();
    const organization = await this.prisma.organization.upsert({
      where: { id: config.systemOrganizationId },
      update: {},
      create: {
        id: config.systemOrganizationId,
        name: config.productName,
        allowTrial: false,
        isTrailing: false,
        apiKey: AuthService.fixedEncryption(makeId(32)),
        subscription: {
          create: {
            totalChannels: 1000000,
            subscriptionTier: 'ULTIMATE',
            isLifetime: true,
            period: 'YEARLY',
          },
        },
      },
      select: { id: true, apiKey: true },
    });
    const withKey = organization.apiKey
      ? organization
      : await this.prisma.organization.update({
          where: { id: organization.id },
          data: { apiKey: AuthService.fixedEncryption(makeId(32)) },
          select: { id: true, apiKey: true },
        });

    const user = await this.prisma.user.upsert({
      where: {
        email_providerName: {
          email: config.adminEmail,
          providerName: Provider.LOCAL,
        },
      },
      update: { activated: true },
      create: {
        email: config.adminEmail,
        name: config.productName,
        providerName: Provider.LOCAL,
        password: AuthService.hashPassword(config.adminPassword),
        activated: true,
        timezone: 0,
      },
      select: { id: true },
    });
    await this.prisma.userOrganization.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: organization.id,
        },
      },
      update: { disabled: false, role: Role.SUPERADMIN },
      create: {
        userId: user.id,
        organizationId: organization.id,
        disabled: false,
        role: Role.SUPERADMIN,
      },
    });
    return { organizationId: withKey.id, apiKey: withKey.apiKey! };
  }

  private assertReady() {
    const temporal = this.temporalReadiness.snapshot;
    if (!temporal.ready) {
      throw new ServiceUnavailableException({
        ready: false,
        reason: temporal.reason || 'temporal_search_attributes_unavailable',
      });
    }
  }

  private configuration() {
    if (!this.enabled) {
      throw new ServiceUnavailableException('Appliance mode is not enabled');
    }
    const adminEmail = this.email(
      process.env.HAPPYM_APPLIANCE_ADMIN_EMAIL || ''
    );
    const adminPassword = process.env.HAPPYM_APPLIANCE_ADMIN_PASSWORD || '';
    this.password(adminPassword);
    const internalClientId =
      process.env.HAPPYM_APPLIANCE_INTERNAL_CLIENT_ID || '';
    const internalClientSecret =
      process.env.HAPPYM_APPLIANCE_INTERNAL_CLIENT_SECRET || '';
    if (!internalClientId || internalClientSecret.length < 32) {
      throw new ServiceUnavailableException(
        'Appliance internal credentials are not configured'
      );
    }
    return {
      adminEmail,
      adminPassword,
      internalClientId,
      internalClientSecret,
      systemOrganizationId: this.identifier(
        process.env.HAPPYM_APPLIANCE_SYSTEM_ORGANIZATION_ID || 'happym-system',
        'HAPPYM_APPLIANCE_SYSTEM_ORGANIZATION_ID'
      ),
      productName: this.text(
        process.env.HAPPYM_PRODUCT_NAME || 'Social Manager',
        'HAPPYM_PRODUCT_NAME',
        160
      ),
    };
  }

  private identifier(value: string, name: string) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/.test(value || '')) {
      throw new ConflictException(`${name} is invalid`);
    }
    return value;
  }

  private email(value: string) {
    const normalized = (value || '').trim().toLowerCase();
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ||
      normalized.length > 254
    ) {
      throw new ServiceUnavailableException(
        'Appliance administrator email is invalid'
      );
    }
    return normalized;
  }

  private password(value: string) {
    if (!value || value.length < 12 || value.length > 256) {
      throw new ServiceUnavailableException(
        'Appliance administrator password must contain 12 to 256 characters'
      );
    }
    return value;
  }

  private text(value: string, name: string, maxLength: number) {
    const normalized = (value || '').trim();
    if (!normalized || normalized.length > maxLength) {
      throw new ConflictException(`${name} is invalid`);
    }
    return normalized;
  }
}
