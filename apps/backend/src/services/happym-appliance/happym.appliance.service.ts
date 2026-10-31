import { SyntheticFixtureService, SYNTHETIC_PROFILES } from '@gitroom/nestjs-libraries/database/prisma/synthetic-fixture/synthetic-fixture.service';
import { NativeOperationalConsumer31Service } from './happym.operational-consumer31';
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
import { NativeConsumerAdmission30Service } from './happym.native-consumer-admission30';
import { SyntheticBinding } from '@gitroom/nestjs-libraries/database/prisma/synthetic-fixture/synthetic-fixture.service';
import { ensureLocalAdmin } from './happym.local-admin.service';
import { LOCAL_ADMIN_ID } from '@gitroom/nestjs-libraries/happym-appliance/happym.local-admin';

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
      tenantId: consumer.tenantId as string, pharmacyId: consumer.pharmacyId as string };
    return this.completeNativeConsumer30(binding, scope, input.requestId as string, input.requireExisting,
      credential, systemOrganizationId, async () => {});
  }

  async enrollNativeConsumer30(input: unknown, credential: unknown) {
    this.assertReady();
    return new NativeConsumerAdmission30Service(this.prisma).enroll(input, credential);
  }

  async bootstrapSharedNativeConsumer30(input: unknown, credential: unknown) {
    this.assertReady(); requireSyntheticNativeCredential(credential);
    const object = (value: unknown, keys: string[]): value is Record<string, unknown> => !!value && typeof value === 'object'
      && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
    if (!object(input, ['contract', 'admissionId', 'applianceBinding', 'consumerBinding', 'consumer', 'requestId', 'requireExisting'])
      || input.contract !== 'happym.native-consumer-bootstrap/v2' || typeof input.requestId !== 'string'
      || !/^[a-f0-9]{32}$/.test(input.requestId) || typeof input.requireExisting !== 'boolean')
      throw new BadRequestException({ code: 'consumer30_bootstrap_invalid' });
    const admissions = new NativeConsumerAdmission30Service(this.prisma);
    const admitted = await admissions.requireScope(input.admissionId, input.applianceBinding, input.consumerBinding, input.consumer);
    const scope = input.consumer as { deploymentId: string; environment: 'test'; tenantId: string; pharmacyId: string };
    const current = async (tx?: Prisma.TransactionClient) => {
      requireSyntheticNativeCredential(credential);
      const actual = await admissions.requireScope(input.admissionId, input.applianceBinding, input.consumerBinding, input.consumer, tx);
      if (JSON.stringify(actual) !== JSON.stringify(admitted))
        throw new ServiceUnavailableException({ code: 'consumer30_admission_changed' });
    };
    const workspace = admitted.scopes.find(row => row.tenantId === scope.tenantId && row.pharmacyId === scope.pharmacyId)!;
    const completed = await this.completeNativeConsumer30(admitted.applianceBinding, scope, input.requestId,
      input.requireExisting, credential, this.configuration().systemOrganizationId, current, workspace.organizationId.slice(3));
    await current();
    return { contract: 'happym.native-consumer-bootstrap/v2' as const, admissionId: admitted.admissionId,
      applianceBinding: admitted.applianceBinding, consumerBinding: admitted.consumerBinding, consumer: completed.consumer,
      requestId: completed.requestId, organizationId: completed.organizationId, userId: completed.userId, apiKey: completed.apiKey };
  }

  private operational31() {
    const config = this.configuration();
    return new NativeOperationalConsumer31Service(this.prisma, config.systemOrganizationId, config.adminEmail);
  }

  async registerOperational31(input: unknown, purpose: unknown, systemKey: unknown, systemOrganization: unknown) {
    this.assertReady();
    return this.operational31().register(input, purpose, systemKey, systemOrganization);
  }

  async inspectOperationalRegistration31(operationId: unknown, purpose: unknown, key: unknown, org: unknown, binding: unknown) {
    this.assertReady(); return this.operational31().inspectRegistration(operationId, purpose, key, org, binding);
  }

  async readOperational31(operationId: unknown) {
    this.assertReady(); return this.operational31().read(operationId);
  }

  async inspectOperationalWorkspace31(operationId: string, organizationId: string,
    purpose: unknown, systemKey: unknown, systemOrganization: unknown) {
    this.assertReady();
    const operations = this.operational31(), r = await operations.read(operationId);
    const scope = r.scopes.find(x => x.organizationId === organizationId);
    if (!scope) throw new ForbiddenException({ code: 'operational31_scope_not_authorized' });
    const consumer = { deploymentId: r.consumerBinding.logicalDeploymentId, environment: 'test', tenantId: scope.tenantId, pharmacyId: scope.pharmacyId };
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await operations.requireScope(operationId, r.applianceBinding, r.consumerBinding, consumer, purpose,
        systemKey, systemOrganization, tx, false);
      const organization = await tx.organization.findUnique({ where: { id: scope.organizationId }, select: { id: true } });
      const user = await tx.user.findUnique({ where: { id: scope.userId }, select: { id: true } });
      const membership = await tx.userOrganization.findMany({ where: { userId: scope.userId }, select: { organizationId: true } });
      if (!!organization !== !!user || !organization && membership.length !== 0
        || organization && (membership.length !== 1 || membership[0].organizationId !== organizationId))
        throw new ConflictException({ code: 'operational31_partial_workspace' });
      await operations.requireScope(operationId, r.applianceBinding, r.consumerBinding, consumer, purpose,
        systemKey, systemOrganization, tx, false);
      return { contract: 'happym.postiz-operational-workspace-state31/v1' as const, operationId,
        requestId: r.requestId, organizationId, userId: scope.userId, consumer,
        state: organization ? 'Present' as const : 'Absent' as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 1000, timeout: 5000 });
  }

  async readOperationalWorkspace31(operationId: string, organizationId: string,
    purpose: unknown, systemKey: unknown, systemOrganization: unknown) {
    this.assertReady();
    const r = await this.operational31().read(operationId);
    const scope = r.scopes.find(x => x.organizationId === organizationId);
    if (!scope) throw new ForbiddenException({ code: 'operational31_scope_not_authorized' });
    return this.bootstrapOperational31({ contract: 'happym.postiz-operational-bootstrap31/v1', operationId,
      applianceBinding: r.applianceBinding, consumerBinding: r.consumerBinding, requestId: r.requestId,
      consumer: { deploymentId: r.consumerBinding.logicalDeploymentId, environment: 'test', tenantId: scope.tenantId, pharmacyId: scope.pharmacyId } },
      purpose, systemKey, systemOrganization, true);
  }

  async provisionOperationalFixture31(input: unknown, purpose: unknown, key: unknown, org: unknown) {
    this.assertReady(); requireSyntheticNativeCredential(purpose);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException();
    const row = input as Record<string, unknown>;
    if (Object.keys(row).sort().join(',') !== ['contract','operationId','applianceBinding','consumerBinding','consumer','requestId','profile'].sort().join(',')
      || row.contract !== 'happym.postiz-operational-fixture31/v1' || !SYNTHETIC_PROFILES.some(profile => profile === row.profile))
      throw new BadRequestException({ code: 'operational31_fixture_invalid' });
    const operations = this.operational31(), r = await operations.read(row.operationId);
    const scope = row.consumer as { deploymentId: string; environment: string; tenantId: string; pharmacyId: string };
    const selected = r.scopes.find(x => x.tenantId === scope?.tenantId && x.pharmacyId === scope?.pharmacyId);
    if (!selected || r.requestId !== row.requestId) throw new ForbiddenException({ code: 'operational31_scope_not_authorized' });
    return new SyntheticFixtureService(this.prisma).provisionAuthorized31({ binding: r.applianceBinding,
      organizationId: selected.organizationId, profile: row.profile }, purpose, async tx => {
      await operations.requireScope(row.operationId, row.applianceBinding, row.consumerBinding, row.consumer,
        purpose, key, org, tx, true);
    });
  }

  async bootstrapOperational31(input: unknown, purpose: unknown, systemKey: unknown, systemOrganization: unknown, readExisting = false) {
    this.assertReady(); requireSyntheticNativeCredential(purpose);
    const object = (v: unknown, fields: string[]): v is Record<string, unknown> => !!v && typeof v === 'object'
      && !Array.isArray(v) && Object.keys(v).sort().join(',') === [...fields].sort().join(',');
    if (!object(input, ['contract', 'operationId', 'applianceBinding', 'consumerBinding', 'consumer', 'requestId'])
      || input.contract !== 'happym.postiz-operational-bootstrap31/v1' || typeof input.requestId !== 'string'
      || !/^[a-f0-9]{32}$/.test(input.requestId)) throw new BadRequestException({ code: 'operational31_bootstrap_invalid' });
    const operations = this.operational31();
    const require = async (tx: Prisma.TransactionClient) => {
      const r = await operations.requireScope(input.operationId, input.applianceBinding, input.consumerBinding,
        input.consumer, purpose, systemKey, systemOrganization, tx, !readExisting);
      if (r.requestId !== input.requestId) throw new ForbiddenException({ code: 'operational31_request_mismatch' });
      return r;
    };
    const observe = () => this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`; return require(tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 1000, timeout: 5000 });
    const registration = await observe();
    const scope = input.consumer as { deploymentId: string; environment: 'test'; tenantId: string; pharmacyId: string };
    const selected = registration.scopes.find(x => x.tenantId === scope.tenantId && x.pharmacyId === scope.pharmacyId)!;
    const guard = async (tx?: Prisma.TransactionClient) => {
      const actual = tx ? await require(tx) : await observe();
      if (JSON.stringify(actual) !== JSON.stringify(registration))
        throw new ServiceUnavailableException({ code: 'operational31_registration_changed' });
    };
    const value = await this.completeNativeConsumer30(registration.applianceBinding, scope, input.requestId,
      readExisting, purpose, this.configuration().systemOrganizationId, guard, selected.organizationId.slice(3), readExisting, !readExisting);
    await guard();
    return { contract: 'happym.postiz-operational-bootstrap31/v1' as const, operationId: registration.operationId,
      applianceBinding: registration.applianceBinding, consumerBinding: registration.consumerBinding,
      consumer: value.consumer, requestId: value.requestId, organizationId: value.organizationId, userId: value.userId, apiKey: value.apiKey };
  }

  private async completeNativeConsumer30(binding: SyntheticBinding,
    scope: { deploymentId: string; environment: 'test'; tenantId: string; pharmacyId: string },
    requestId: string, requireExisting: boolean, credential: unknown, systemOrganizationId: string,
    guard: (tx?: Prisma.TransactionClient) => Promise<void>, admittedWorkspaceDigest?: string, readOnlyExisting = false, requireAbsentWorkspace = false) {
    const digest = admittedWorkspaceDigest ?? createHash('sha256').update(JSON.stringify(['happym.postiz.consumer-workspace/v1',
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
        if (readOnlyExisting) await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        // All native creators share the physical workspace lock. A delayed
        // uncertain create cannot race a fresh require-ABSENT operational POST.
        if (!readOnlyExisting)
          await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtextextended(${organizationId},0))`;
        current(); await guard(tx);
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
        if (requireAbsentWorkspace && (organization || user || emailOwner || memberships.length !== 0)) conflict();
        // Validate every existing identity before a create. Never silently
        // reactivate, rename, change a role, replace a key, or rotate on replay.
        if (requireExisting && (!organization || !user || memberships.length !== 1)
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
        await guard(tx); current();
        return { organizationId, userId, apiKey: held.apiKey };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 1000, timeout: 5000 });
      current(); await guard();
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      // No database details or secret-bearing envelope in a public exception.
      throw new ServiceUnavailableException({ code: 'native_consumer_outcome_unknown' });
    }
    return { contract: 'happym.native-consumer-bootstrap/v1' as const,
      binding, consumer: scope, requestId: requestId, ...envelope };
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
      body.name || `Social Manager \u00b7 ${pharmacyCode}`,
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
    if (userId === LOCAL_ADMIN_ID) {
      throw new ConflictException('The installation-local administrator is not a CRM-managed user');
    }
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
    await ensureLocalAdmin(this.prisma);
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
