import { Injectable } from '@nestjs/common';
import { Integration } from '@prisma/client';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import { weightedLength } from '@gitroom/helpers/utils/count.length';

export type FinalPostPayload = {
  value: Array<{ content?: string; image?: Array<{ path: string; thumbnail?: string }> }>;
  settings?: any;
};

@Injectable()
export class PostPayloadValidationService {
  constructor(private readonly integrationManager: IntegrationManager) {}

  async validate(
    integration: Pick<Integration, 'id' | 'providerIdentifier' | 'name' | 'additionalSettings'>,
    post: FinalPostPayload
  ) {
    const provider = this.integrationManager.getSocialIntegration(
      integration.providerIdentifier
    );

    let additionalSettings: any[] = [];
    try {
      additionalSettings = JSON.parse(
        integration.additionalSettings || '[]'
      );
    } catch {
      additionalSettings = [];
    }

    const settings = post.settings || {};
    const media = (post.value || []).map((p) => p.image || []);

    // Settings DTO validation — mirrors the client `form.trigger()`.
    let valid = true;
    let settingsError = '';
    if (provider?.dto) {
      const instance = plainToInstance(provider.dto, settings, {
        enableImplicitConversion: false,
      });
      const validationErrors = await validate(instance as object, {
        skipMissingProperties: false,
      });
      settingsError = this.firstValidationError(validationErrors);
      valid = validationErrors.length === 0;
    }

    // Provider-specific media validation (the old client `checkValidity`).
    let errors: string | true = true;
    try {
      errors = await provider.checkValidity(
        media,
        settings,
        additionalSettings
      );
    } catch (err: any) {
      errors = err?.message || 'Invalid media';
    }

    const maximumCharacters = provider.maxLength(
      additionalSettings,
      settings
    );
    const isX = integration.providerIdentifier === 'x';

    const emptyContent = (post.value || []).some((a) => {
      const strip = stripHtmlValidation('normal', a.content || '', true);
      const length = isX ? weightedLength(strip) : strip.length;
      return length === 0 && (a.image || []).length === 0;
    });

    const tooLong = (post.value || []).some((a) => {
      const strip = stripHtmlValidation('normal', a.content || '', true);
      const weighted = isX ? weightedLength(strip) : strip.length;
      const totalCharacters =
        weighted > strip.length ? weighted : strip.length;
      return totalCharacters > (maximumCharacters || 1000000);
    });

    return {
      id: integration.id,
      identifier: integration.providerIdentifier,
      name: integration.name,
      valid,
      settingsError,
      errors,
      emptyContent,
      tooLong,
      maximumCharacters,
    };
  }

  /** Returns the first class-validator message (incl. nested children), or ''. */
  private firstValidationError(errors: any[]): string {
    for (const e of errors || []) {
      if (e?.constraints) {
        return Object.values(e.constraints as Record<string, string>)[0] || '';
      }
      const child = e?.children?.length
        ? this.firstValidationError(e.children)
        : '';
      if (child) {
        return child;
      }
    }
    return '';
  }

}
