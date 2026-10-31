import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';

export const metadataHash31 = (value: unknown) => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
export function ownerKey31(appliance: object, consumer: object): string {
  return metadataHash31(['happym.workspace-owner31/v1', appliance, consumer]);
}
export function ownerMetadata31(appliance: object, consumer: object, scope: { tenantId: string; pharmacyId: string }) {
  return JSON.stringify({ applianceBinding: appliance, consumerBinding: consumer, tenantId: scope.tenantId, pharmacyId: scope.pharmacyId });
}
/** Every diagnostic/operational creator takes these SAME locks, sorted globally.
 * The registry's physical org/user uniqueness remains the final ownership guard.
 * There is no retry/execution strategy around this operation. */
export async function lockOwners31(tx: Prisma.TransactionClient, consumerKey: string, organizationIds: string[]) {
  await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtextextended(${consumerKey},0))`;
  for (const id of [...organizationIds].sort())
    await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtextextended(${id},0))`;
}
export async function claimOwner31(tx: Prisma.TransactionClient, appliance: object, consumer: object,
  scope: { tenantId: string; pharmacyId: string; organizationId: string; userId: string },
  validatedDiagnosticClaim: () => Promise<boolean>, allowCreate: boolean) {
  const key = ownerKey31(appliance, consumer), metadataJson = ownerMetadata31(appliance, consumer, scope);
  const old = await tx.nativeWorkspaceOwner31.findUnique({ where: { organizationId: scope.organizationId } });
  if (old) {
    if (old.consumerKey !== key || old.userId !== scope.userId || old.metadataJson !== metadataJson)
      throw new ConflictException({ code: 'operational31_workspace_foreign' });
    return;
  }
  if (!allowCreate) throw new ServiceUnavailableException({ code: 'operational31_owner_missing' });
  // A legacy diagnostic claim is accepted only after its actual receipt/rows
  // have been validated in this transaction. Deterministic-looking names are
  // insufficient to adopt a pre-existing organization or user.
  const diagnostic = await validatedDiagnosticClaim();
  if (!diagnostic && (await tx.organization.findUnique({ where: { id: scope.organizationId }, select: { id: true } })
    || await tx.user.findUnique({ where: { id: scope.userId }, select: { id: true } })))
    throw new ConflictException({ code: 'operational31_workspace_unclaimed' });
  await tx.nativeWorkspaceOwner31.create({ data: { organizationId: scope.organizationId,
    userId: scope.userId, consumerKey: key, metadataJson } });
}
