import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { Prisma, Provider, Role } from '@prisma/client';
import { createHash } from 'node:crypto';
import { requireSyntheticNativeCredential, syntheticBinding, syntheticIdentifier } from '@gitroom/nestjs-libraries/database/prisma/synthetic-fixture/synthetic-fixture.service';
import { TemporalSearchAttributesReadiness } from '@gitroom/nestjs-libraries/temporal/temporal.register';
import { happyMDevLoginHint } from '@gitroom/nestjs-libraries/happym-appliance/happym.dev-login';
import { mastraStoreReadiness } from '@gitroom/nestjs-libraries/chat/mastra.readiness';

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
        reasonCode: status.reasonCode,
        remediationHint: status.remediationHint,
      };
    } catch {
      return {
        up: true,
        applianceMode: true,
        ready: false,
        reason: 'appliance_bootstrap_unavailable',
        reasonCode: 'starting',
        remediationHint: 'retry_automatically',
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
    const applianceReady =
      !!organization?.apiKey && !!organization.users[0]?.user.id;
    const temporal = this.temporalReadiness.snapshot;
    const mastra = mastraStoreReadiness.snapshot;
    const ready = applianceReady && temporal.ready && mastra.ready;
    const reason = ready
      ? null
      : mastra.reason || temporal.reason || 'appliance_bootstrap_unavailable';
    return {
      up: true,
      apiOk: true,
      applianceMode: true,
      ready,
      reason,
      reasonCode: ready
        ? null
        : mastra.reasonCode
        ? mastra.reasonCode
        : temporal.reason
        ? 'temporal_search_attr'
        : 'starting',
      remediationHint: ready ? null : 'retry_automatically',
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

  /** A new QA-only contract, distinct from the legacy mutating ensure methods.
   * The credential-bearing envelope belongs exclusively to the retained native
   * RAM receiver. Never log, serialize into a public receipt, or persist it here. */
  async bootstrapNativeConsumer(input: unknown, credential: unknown) {
    let systemOrganizationId: string;
    try { this.assertReady(); systemOrganizationId = this.configuration().systemOrganizationId; }
    catch { throw new ServiceUnavailableException({ code: 'native_consumer_not_ready' }); }
    const binding = syntheticBinding();
    requireSyntheticNativeCredential(credential);
    const object = (value: unknown, fields: string[]): value is Record<string, unknown> =>
      !!value && typeof value === 'object' && !Array.isArray(value)
      && Object.keys(value).sort().join(',') === [...fields].sort().join(',');
    if (!object(input, ['binding', 'consumer', 'requestId', 'requireExisting'])
      || !object(input.binding, ['clientId', 'applicationEnvironmentId', 'logicalDeploymentId', 'installationId'])
      || !object(input.consumer, ['deploymentId', 'environment', 'tenantId', 'pharmacyId'])
      || !syntheticIdentifier(input.requestId) || typeof input.requireExisting !== 'boolean') throw new BadRequestException({ code: 'native_consumer_input_invalid' });
    const selectedBinding = input.binding, consumer = input.consumer;
    if (Object.entries(binding).some(([key, value]) => selectedBinding[key] !== value))
      throw new ForbiddenException({ code: 'native_consumer_binding_mismatch' });
    if (consumer.environment !== 'test' || consumer.deploymentId !== binding.logicalDeploymentId
      || typeof consumer.deploymentId !== 'string' || !/^[a-z0-9-]{1,64}$/.test(consumer.deploymentId)
      || typeof consumer.tenantId !== 'string' || !/^[A-Za-z0-9_.:-]{1,100}$/.test(consumer.tenantId)
      || typeof consumer.pharmacyId !== 'string' || !/^[A-Za-z0-9_.:-]{1,100}$/.test(consumer.pharmacyId))
      throw new ForbiddenException({ code: 'native_consumer_scope_invalid' });
    const scope = { deploymentId: consumer.deploymentId, environment: 'test' as const,
      tenantId: consumer.tenantId, pharmacyId: consumer.pharmacyId };
    const digest = createHash('sha256').update(JSON.stringify(['happym.postiz.consumer-workspace/v1',
      scope.deploymentId, scope.environment, scope.tenantId, scope.pharmacyId]), 'utf8').digest('hex');
    const organizationId = 'hm-' + digest, userId = 'sm.' + digest;
    const email = digest + '@social-manager.local';
    const current = () => {
      if (JSON.stringify(syntheticBinding()) !== JSON.stringify(binding)
        || this.configuration().systemOrganizationId !== systemOrganizationId)
        throw new ServiceUnavailableException({ code: 'native_consumer_outcome_unknown' });
      requireSyntheticNativeCredential(credential);
    };
    const conflict = (): never => { throw new ConflictException({ code: 'native_consumer_conflict' }); };
    if (organizationId === systemOrganizationId) conflict();
    const keyValid = (value: unknown): value is string => typeof value === 'string' && /^[!-~]{32,4096}$/.test(value)
      && value !== process.env.HAPPYM_APPLIANCE_INTERNAL_CLIENT_SECRET && value !== process.env.HAPPYM_EMBED_CLIENT_SECRET
      && value !== process.env.HAPPYM_TEST_FIXTURE_NATIVE_SECRET;
    let envelope: { organizationId: string; userId: string; apiKey: string };
    try {
      envelope = await this.prisma.$transaction(async tx => {
        current();
        const system = await tx.organization.findUnique({ where: { id: systemOrganizationId },
          select: { apiKey: true } });
        current();
        if (!system || !keyValid(system.apiKey)) conflict();
        const organization = await tx.organization.findUnique({ where: { id: organizationId },
          select: { id: true, name: true, apiKey: true, allowTrial: true, isTrailing: true } });
        current();
        const user = await tx.user.findUnique({ where: { id: userId },
          select: { id: true, email: true, name: true, providerName: true, activated: true } });
        current();
        const emailOwner = await tx.user.findUnique({ where: { email_providerName: { email, providerName: Provider.LOCAL } },
          select: { id: true } });
        current();
        const memberships = await tx.userOrganization.findMany({ where: { userId },
          select: { userId: true, organizationId: true, role: true, disabled: true } });
        current();
        // Validate every existing identity before a create. Never silently
        // reactivate, rename, change a role, replace a key, or rotate on replay.
        if (input.requireExisting && (!organization || !user || memberships.length !== 1)
          || organization && (organization.name !== organizationId || !keyValid(organization.apiKey) || organization.apiKey === system?.apiKey
            || organization.allowTrial !== false || organization.isTrailing !== false)
          || user && (user.email !== email || user.name !== organizationId || user.providerName !== Provider.LOCAL || !user.activated)
          || emailOwner && emailOwner.id !== userId
          || memberships.some(row => row.organizationId !== organizationId || row.role !== Role.USER || row.disabled)) conflict();
        // apiKey has an index, not a unique constraint in the current schema.
        // Check the candidate's existing owner inside this serializable boundary
        // before any mutation; never adopt a key belonging to another organization.
        const candidateKey = organization?.apiKey ?? AuthService.fixedEncryption(makeId(32));
        if (!keyValid(candidateKey) || candidateKey === system.apiKey) conflict();
        const otherOwner = await tx.organization.findFirst({
          where: { apiKey: candidateKey, id: { not: organizationId } }, select: { id: true } });
        current();
        if (otherOwner) conflict();
        const held = organization ?? await tx.organization.create({ data: {
          id: organizationId, name: organizationId, allowTrial: false, isTrailing: false,
          apiKey: candidateKey,
          subscription: { create: { totalChannels: 1000000, subscriptionTier: 'ULTIMATE', isLifetime: true, period: 'YEARLY' } },
        }, select: { id: true, apiKey: true } });
        current();
        if (!user) {
          await tx.user.create({ data: { id: userId, email, name: organizationId,
            providerName: Provider.LOCAL, password: AuthService.hashPassword(makeId(64)), activated: true, timezone: 0 }, select: { id: true } });
          current();
        }
        if (memberships.length === 0) {
          await tx.userOrganization.create({
            data: { userId, organizationId, role: Role.USER, disabled: false }, select: { userId: true } });
          current();
        }
        if (!keyValid(held.apiKey) || held.apiKey === system.apiKey) conflict();
        return { organizationId, userId, apiKey: held.apiKey };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 1000, timeout: 5000 });
      current();
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      // No database details or secret-bearing envelope in a public exception.
      throw new ServiceUnavailableException({ code: 'native_consumer_outcome_unknown' });
    }
    return { contract: 'happym.native-consumer-bootstrap/v1' as const,
      binding, consumer: scope, requestId: input.requestId, ...envelope };
  }

  async ensureOrganization(body: EnsureOrganizationRequest) {
    this.assertReady();
    const config = this.configuration();
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
    await this.ensureAdminWorkspaceMembership(
      organization.id,
      config.adminEmail
    );
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
      update: {
        activated: true,
        ...(config.devLoginHint
          ? { password: AuthService.hashPassword(config.adminPassword) }
          : {}),
      },
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
    await this.ensureAdminWorkspaceMemberships(user.id);
    if (config.devLoginHint) {
      const demoUser = await this.prisma.user.upsert({
        where: {
          email_providerName: {
            email: config.devLoginHint.email,
            providerName: Provider.LOCAL,
          },
        },
        update: {
          activated: true,
          password: AuthService.hashPassword(config.devLoginHint.password),
        },
        create: {
          email: config.devLoginHint.email,
          name: `${config.productName} Demo`,
          providerName: Provider.LOCAL,
          password: AuthService.hashPassword(config.devLoginHint.password),
          activated: true,
          timezone: 0,
        },
        select: { id: true },
      });
      await this.ensureAdminWorkspaceMemberships(demoUser.id);
    }
    return { organizationId: withKey.id, apiKey: withKey.apiKey! };
  }

  private async ensureAdminWorkspaceMembership(
    organizationId: string,
    adminEmail: string
  ) {
    const admin = await this.prisma.user.findFirst({
      where: { email: adminEmail, providerName: Provider.LOCAL },
      select: { id: true },
    });
    if (!admin) return;
    await this.upsertAdminWorkspaceMembership(admin.id, organizationId);
  }

  private async ensureAdminWorkspaceMemberships(adminUserId: string) {
    const organizations = await this.prisma.organization.findMany({
      select: { id: true },
    });
    await Promise.all(
      organizations.map(({ id }) =>
        this.upsertAdminWorkspaceMembership(adminUserId, id)
      )
    );
  }

  private upsertAdminWorkspaceMembership(
    adminUserId: string,
    organizationId: string
  ) {
    return this.prisma.userOrganization.upsert({
      where: {
        userId_organizationId: {
          userId: adminUserId,
          organizationId,
        },
      },
      update: { disabled: false, role: Role.SUPERADMIN },
      create: {
        userId: adminUserId,
        organizationId,
        disabled: false,
        role: Role.SUPERADMIN,
      },
    });
  }

  private assertReady() {
    const temporal = this.temporalReadiness.snapshot;
    if (!temporal.ready) {
      throw new ServiceUnavailableException({
        ready: false,
        reason: temporal.reason || 'temporal_search_attributes_unavailable',
        reasonCode: 'temporal_search_attr',
        remediationHint: 'retry_automatically',
      });
    }
  }

  private configuration() {
    if (!this.enabled) {
      throw new ServiceUnavailableException('Appliance mode is not enabled');
    }
    const devLoginHint = happyMDevLoginHint();
    const adminEmail = this.email(
      process.env.HAPPYM_APPLIANCE_ADMIN_EMAIL || ''
    );
    const adminPassword = process.env.HAPPYM_APPLIANCE_ADMIN_PASSWORD || '';
    this.password(adminPassword);
    if (devLoginHint) {
      this.devPassword(devLoginHint.password);
    }
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
      devLoginHint,
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

  private devPassword(value: string) {
    if (!value || value.length < 10 || value.length > 256) {
      throw new ServiceUnavailableException(
        'Local demo administrator password must contain 10 to 256 characters'
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
