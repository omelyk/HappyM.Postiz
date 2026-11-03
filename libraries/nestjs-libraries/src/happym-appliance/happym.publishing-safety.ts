import { ApplicationFailure } from '@temporalio/common';

export type HappyMPublishingSafetyMode = 'blocked' | 'test-deny-external' | 'live';
export type HappyMPublishingSafetySnapshot = {
  declaredMode: HappyMPublishingSafetyMode;
  declaredEnvironmentId: string;
  environmentKind: 'TEST' | 'PROD' | 'Unspecified';
  externalProviderCallsAllowed: boolean;
  isolatedTestSender: 'NotQualified';
};
export type HappyMApplianceBinding = {
  clientId: string | null;
  applicationEnvironmentId: string | null;
  logicalDeploymentId: string | null;
  installationId: string | null;
};
export const declaredIdentifier = (value: unknown): string | null =>
  typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value) ? value : null;
export function applianceBindingSnapshot(environment: Readonly<Record<string, string | undefined>> = process.env): HappyMApplianceBinding {
  return {
    clientId: declaredIdentifier(environment.HAPPYM_APPLIANCE_CLIENT_ID),
    applicationEnvironmentId: declaredIdentifier(environment.HAPPYM_APPLIANCE_APPLICATION_ENVIRONMENT_ID),
    logicalDeploymentId: declaredIdentifier(environment.HAPPYM_APPLIANCE_LOGICAL_DEPLOYMENT_ID),
    installationId: declaredIdentifier(environment.HAPPYM_APPLIANCE_INSTALLATION_ID),
  };
}

/** Protected process-startup declarations, never image, isolation or native proof.
 * TEST has no synthetic Published result and cannot opt into real provider calls. */
export function publishingSafetySnapshot(
  environment: Readonly<Record<string, string | undefined>> = process.env
): HappyMPublishingSafetySnapshot {
  const mode = environment.HAPPYM_PUBLISHING_SAFETY_MODE;
  const declaredMode: HappyMPublishingSafetyMode =
    mode === 'live' || mode === 'test-deny-external' ? mode : 'blocked';
  const binding = applianceBindingSnapshot(environment);
  const kind = environment.HAPPYM_APPLIANCE_ENVIRONMENT_KIND;
  const environmentKind = kind === 'TEST' || kind === 'PROD' ? kind : 'Unspecified';
  const declaredEnvironmentId = binding.applicationEnvironmentId ?? 'Unspecified';
  return {
    declaredMode,
    declaredEnvironmentId,
    environmentKind,
    externalProviderCallsAllowed: declaredMode === 'live' && environmentKind === 'PROD'
      && Object.values(binding).every(value => value !== null)
      && declaredIdentifier(environment.HAPPYM_APPLIANCE_INTERNAL_CLIENT_ID) !== null,
    isolatedTestSender: 'NotQualified',
  };
}

/** Must run before provider lookup, upload, token refresh, plug or webhook IO.
 * A terminal activity failure cannot be mistaken for a successful send. */
export function requireExternalPublishing(
  environment: Readonly<Record<string, string | undefined>> = process.env
): void {
  if (!publishingSafetySnapshot(environment).externalProviderCallsAllowed) {
    throw ApplicationFailure.nonRetryable(
      'happym_external_publishing_blocked',
      'HappyMPublishingSafetyBlocked'
    );
  }
}
