import { ApplicationFailure } from '@temporalio/common';
import { applianceBindingSnapshot, publishingSafetySnapshot, requireExternalPublishing } from './happym.publishing-safety';

const binding = {
  HAPPYM_APPLIANCE_CLIENT_ID: 'client-a',
  HAPPYM_APPLIANCE_APPLICATION_ENVIRONMENT_ID: '943caea8-4cca-423b-b104-56fa42207244',
  HAPPYM_APPLIANCE_LOGICAL_DEPLOYMENT_ID: 'deployment-a',
  HAPPYM_APPLIANCE_INSTALLATION_ID: 'postiz-a',
  HAPPYM_APPLIANCE_INTERNAL_CLIENT_ID: 'client-a-control',
};
describe('publishing safety pure policy, not a native isolation proof', () => {
  it.each([{}, { HAPPYM_PUBLISHING_SAFETY_MODE: 'unknown' },
    { HAPPYM_PUBLISHING_SAFETY_MODE: 'live' },
    { ...binding, HAPPYM_PUBLISHING_SAFETY_MODE: 'live', HAPPYM_APPLIANCE_ENVIRONMENT_KIND: 'unknown' },
    { ...binding, HAPPYM_PUBLISHING_SAFETY_MODE: 'live', HAPPYM_APPLIANCE_ENVIRONMENT_KIND: 'TEST' },
    { ...binding, HAPPYM_PUBLISHING_SAFETY_MODE: 'test-deny-external', HAPPYM_APPLIANCE_ENVIRONMENT_KIND: 'TEST' },
    { ...binding, HAPPYM_PUBLISHING_SAFETY_MODE: 'blocked', HAPPYM_APPLIANCE_ENVIRONMENT_KIND: 'PROD' },
  ])('fails closed before any transport for %p', environment => {
    const provider = jest.fn();
    let error: unknown;
    try { requireExternalPublishing(environment); provider(); } catch (failure) { error = failure; }
    expect(provider).not.toHaveBeenCalled();
    expect(error).toBeInstanceOf(ApplicationFailure);
    expect((error as ApplicationFailure).nonRetryable).toBe(true);
    expect((error as ApplicationFailure).type).toBe('HappyMPublishingSafetyBlocked');
    expect(publishingSafetySnapshot(environment).isolatedTestSender).toBe('NotQualified');
  });
  it('separates arbitrary environment identity from TEST/PROD kind', () => {
    const environment = { ...binding, HAPPYM_APPLIANCE_ENVIRONMENT_KIND: 'TEST', HAPPYM_PUBLISHING_SAFETY_MODE: 'live' };
    const status = publishingSafetySnapshot(environment);
    expect(status.declaredEnvironmentId).toBe(binding.HAPPYM_APPLIANCE_APPLICATION_ENVIRONMENT_ID);
    expect(status.environmentKind).toBe('TEST'); expect(status.externalProviderCallsAllowed).toBe(false);
    expect(applianceBindingSnapshot(environment).clientId).not.toBe(binding.HAPPYM_APPLIANCE_INTERNAL_CLIENT_ID);
  });
  it('allows an explicit bound PROD declaration but does not call a provider or qualify activation', () => {
    const environment = { ...binding, HAPPYM_APPLIANCE_ENVIRONMENT_KIND: 'PROD', HAPPYM_PUBLISHING_SAFETY_MODE: 'live' };
    expect(() => requireExternalPublishing(environment)).not.toThrow();
    expect(publishingSafetySnapshot(environment).externalProviderCallsAllowed).toBe(true);
    expect(publishingSafetySnapshot(environment).isolatedTestSender).toBe('NotQualified');
  });
  it.each(Object.keys(binding))('missing declared binding %s cannot enable live publishing', key => {
    const environment: Record<string,string> = { ...binding, HAPPYM_APPLIANCE_ENVIRONMENT_KIND: 'PROD', HAPPYM_PUBLISHING_SAFETY_MODE: 'live' };
    delete environment[key];
    expect(() => requireExternalPublishing(environment)).toThrow(ApplicationFailure);
  });
  it('does not expose secret values or treat an ENV image label as proof', () => {
    const snapshot = publishingSafetySnapshot({ ...binding, HAPPYM_APPLIANCE_ENVIRONMENT_KIND: 'TEST',
      HAPPYM_PUBLISHING_SAFETY_MODE: 'test-deny-external', HAPPYM_IMAGE_SHA256: 'fake-image',
      HAPPYM_APPLIANCE_INTERNAL_CLIENT_SECRET: 'synthetic-secret-value' });
    expect(JSON.stringify(snapshot)).not.toContain('synthetic-secret-value');
    expect(JSON.stringify(snapshot)).not.toContain('fake-image');
  });
});
