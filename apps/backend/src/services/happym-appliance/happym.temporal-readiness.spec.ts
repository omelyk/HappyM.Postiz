import {
  TemporalRegister,
  TemporalSearchAttributesReadiness,
} from '@gitroom/nestjs-libraries/temporal/temporal.register';
import { HappyMApplianceService } from '@gitroom/backend/services/happym-appliance/happym.appliance.service';
import { ServiceUnavailableException } from '@nestjs/common';

const temporalService = (operatorService: Record<string, jest.Mock>) =>
  ({
    client: {
      getRawClient: () => ({ connection: { operatorService } }),
    },
  }) as any;

describe('Temporal search attribute bootstrap', () => {
  it('migrates owned Text attributes to Keyword and becomes ready', async () => {
    const operatorService = {
      listSearchAttributes: jest.fn().mockResolvedValue({
        customAttributes: {
          CustomStringField: 1,
          CustomTextField: 1,
          organizationId: 1,
        },
      }),
      removeSearchAttributes: jest.fn().mockResolvedValue({}),
      addSearchAttributes: jest.fn().mockResolvedValue({}),
    };
    const readiness = new TemporalSearchAttributesReadiness();
    const register = new TemporalRegister(
      temporalService(operatorService),
      readiness
    );

    await register.onModuleInit();

    expect(operatorService.removeSearchAttributes).toHaveBeenCalledWith({
      namespace: 'default',
      searchAttributes: ['organizationId'],
    });
    expect(operatorService.addSearchAttributes).toHaveBeenCalledWith({
      namespace: 'default',
      searchAttributes: { organizationId: 2, postId: 2 },
    });
    expect(readiness.snapshot).toEqual({ ready: true, reason: null });
  });

  it('fails soft and exposes a stable readiness reason', async () => {
    const operatorService = {
      listSearchAttributes: jest.fn().mockResolvedValue({ customAttributes: {} }),
      removeSearchAttributes: jest.fn(),
      addSearchAttributes: jest.fn().mockRejectedValue(new Error('quota details')),
    };
    const readiness = new TemporalSearchAttributesReadiness();
    const register = new TemporalRegister(
      temporalService(operatorService),
      readiness
    );

    await expect(register.onModuleInit()).resolves.toBeUndefined();
    expect(readiness.snapshot).toEqual({
      ready: false,
      reason: 'temporal_search_attributes_unavailable',
    });
  });
});

describe('Appliance readiness gate', () => {
  it('returns an explicit 503 contract for M2M mutations while Temporal is unavailable', async () => {
    const readiness = new TemporalSearchAttributesReadiness();
    readiness.markUnavailable();
    const service = new HappyMApplianceService({} as any, readiness);

    const error = await service.rotateCredentials().catch((caught) => caught);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error.getResponse()).toEqual({
      ready: false,
      reason: 'temporal_search_attributes_unavailable',
      reasonCode: 'temporal_search_attr',
      remediationHint: 'retry_automatically',
    });
  });
});
