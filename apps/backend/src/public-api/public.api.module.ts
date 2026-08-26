import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthService } from '@gitroom/backend/services/auth/auth.service';
import { StripeService } from '@gitroom/nestjs-libraries/services/stripe.service';
import { PoliciesGuard } from '@gitroom/backend/services/auth/permissions/permissions.guard';
import { PermissionsService } from '@gitroom/backend/services/auth/permissions/permissions.service';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { UploadModule } from '@gitroom/nestjs-libraries/upload/upload.module';
import { OpenaiService } from '@gitroom/nestjs-libraries/openai/openai.service';
import { ExtractContentService } from '@gitroom/nestjs-libraries/openai/extract.content.service';
import { CodesService } from '@gitroom/nestjs-libraries/services/codes.service';
import { PublicIntegrationsController } from '@gitroom/backend/public-api/routes/v1/public.integrations.controller';
import { PublicAuthMiddleware } from '@gitroom/backend/services/auth/public.auth.middleware';
import { PublicChatController } from '@gitroom/backend/public-api/routes/v1/public.chat.controller';
import { PublicChatService } from '@gitroom/backend/public-api/services/public.chat.service';
import { PublicPrePublishRenderController } from '@gitroom/backend/public-api/routes/v1/public.prepublish-render.controller';

const authenticatedController = [
  PublicIntegrationsController,
  PublicChatController,
  PublicPrePublishRenderController,
];
@Module({
  imports: [UploadModule],
  controllers: [...authenticatedController],
  providers: [
    AuthService,
    StripeService,
    OpenaiService,
    ExtractContentService,
    PoliciesGuard,
    PermissionsService,
    CodesService,
    IntegrationManager,
    PublicChatService,
  ],
  get exports() {
    return [...this.imports, ...this.providers];
  },
})
export class PublicApiModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PublicAuthMiddleware).forRoutes(...authenticatedController);
  }
}
