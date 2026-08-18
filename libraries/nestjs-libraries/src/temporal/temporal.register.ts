import { Global, Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';
import { Connection } from '@temporalio/client';

export type TemporalSearchAttributesState = {
  ready: boolean;
  reason: string | null;
};

@Injectable()
export class TemporalSearchAttributesReadiness {
  private state: TemporalSearchAttributesState = {
    ready: false,
    reason: 'temporal_search_attributes_initializing',
  };

  get snapshot(): TemporalSearchAttributesState {
    return { ...this.state };
  }

  markReady() {
    this.state = { ready: true, reason: null };
  }

  markUnavailable() {
    this.state = {
      ready: false,
      reason: 'temporal_search_attributes_unavailable',
    };
  }
}

@Injectable()
export class TemporalRegister implements OnModuleInit {
  private readonly logger = new Logger(TemporalRegister.name);

  constructor(
    private _client: TemporalService,
    private readonly readiness: TemporalSearchAttributesReadiness
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.TEMPORAL_TLS === 'true') {
      this.readiness.markReady();
      return;
    }
    try {
      const connection = this._client?.client?.getRawClient()
        ?.connection as Connection;
      const namespace = process.env.TEMPORAL_NAMESPACE || 'default';
      const { customAttributes } =
        await connection.operatorService.listSearchAttributes({ namespace });
      const neededAttributes = ['organizationId', 'postId'];
      const textAttributes = neededAttributes.filter(
        (attribute) => customAttributes[attribute] === 1
      );
      const incompatibleAttributes = neededAttributes.filter(
        (attribute) =>
          customAttributes[attribute] &&
          customAttributes[attribute] !== 1 &&
          customAttributes[attribute] !== 2
      );
      if (incompatibleAttributes.length > 0) {
        throw new Error('Incompatible appliance search attribute type');
      }

      // Earlier appliance images registered these identifiers as TEXT. That
      // consumes Temporal's very small Text quota. Migrate only our two owned
      // attributes to KEYWORD, which is the correct exact-match type.
      if (textAttributes.length > 0) {
        await connection.operatorService.removeSearchAttributes({
          namespace,
          searchAttributes: textAttributes,
        });
      }

      const attributesToAdd = neededAttributes.filter(
        (attribute) => !customAttributes[attribute] || textAttributes.includes(attribute)
      );
      if (attributesToAdd.length > 0) {
        await connection.operatorService.addSearchAttributes({
          namespace,
          searchAttributes: Object.fromEntries(
            attributesToAdd.map((attribute) => [attribute, 2])
          ),
        });
      }
      this.readiness.markReady();
      this.logger.log('Temporal search attributes are ready');
    } catch (error) {
      this.readiness.markUnavailable();
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      this.logger.error(
        `Temporal search attributes are unavailable (${errorName}); backend remains online`
      );
    }
  }
}

@Global()
@Module({
  imports: [],
  controllers: [],
  providers: [TemporalRegister, TemporalSearchAttributesReadiness],
  get exports() {
    return this.providers;
  },
})
export class TemporalRegisterMissingSearchAttributesModule {}
