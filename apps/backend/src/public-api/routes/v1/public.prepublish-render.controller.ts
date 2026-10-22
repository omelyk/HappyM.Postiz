import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import {
  PrePublishRenderError,
  PrePublishRenderService,
} from '@gitroom/nestjs-libraries/database/prisma/prepublish-render/prepublish-render.service';
import {
  PublicAttachRenderedDto,
  PublicClaimRenderDto,
  PublicRenderOccurrenceDto,
} from '@gitroom/backend/public-api/dtos/public.prepublish-render.dto';

const apiCode: Record<string, string> = {
  RenderRequired: 'render_required',
  RenderLeaseHeld: 'render_lease_held',
  RenderTimedOut: 'render_timed_out',
  RenderPayloadInvalid: 'render_payload_invalid',
  PublishBlockedNoRender: 'publish_blocked_no_render',
  OccurrenceCancelled: 'occurrence_cancelled',
  OccurrenceNotFound: 'occurrence_not_found',
  StorySequenceInvalid: 'story_sequence_invalid',
  StorySequenceUnsupported: 'story_sequence_unsupported',
  TransientEngine: 'transient_engine',
};

@ApiTags('Public API - Pre-publish render')
@Controller('/public/v1/prepublish-render/occurrences')
export class PublicPrePublishRenderController {
  constructor(private readonly render: PrePublishRenderService) {}

  private async mapError<T>(action: () => Promise<T>) {
    try {
      return await action();
    } catch (error) {
      if (error instanceof PrePublishRenderError) {
        throw new HttpException(
          {
            code: apiCode[error.reasonCode],
            reasonCode: error.reasonCode,
            message: error.message,
          },
          error.statusCode
        );
      }
      if (
        ['P1001', 'P1002', 'P2024', 'P2034'].includes(
          (error as { code?: string })?.code || ''
        )
      ) {
        throw new HttpException(
          {
            code: 'transient_engine',
            reasonCode: 'TransientEngine',
            message: 'Social Manager could not persist the render operation.',
          },
          503
        );
      }
      throw error;
    }
  }

  @Get()
  @ApiOkResponse({ type: PublicRenderOccurrenceDto, isArray: true })
  list(
    @GetOrgFromRequest() org: Organization,
    @Query('postId') postId?: string,
    @Query('status') status?: string,
    @Query('take') take?: string
  ) {
    return this.mapError(() =>
      this.render.list(org.id, {
        postId,
        status,
        take: take ? +take : undefined,
      })
    );
  }

  @Get('/:occurrenceId')
  @ApiOkResponse({ type: PublicRenderOccurrenceDto })
  get(
    @GetOrgFromRequest() org: Organization,
    @Param('occurrenceId') occurrenceId: string
  ) {
    return this.mapError(() => this.render.get(org.id, occurrenceId));
  }

  @Post('/:occurrenceId/claim-render')
  claim(
    @GetOrgFromRequest() org: Organization,
    @Param('occurrenceId') occurrenceId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: PublicClaimRenderDto
  ) {
    return this.mapError(() =>
      this.render.claim(
        org.id,
        occurrenceId,
        body.workerId,
        idempotencyKey,
        body.leaseSeconds
      )
    );
  }

  @Post('/:occurrenceId/attach-rendered')
  @ApiOkResponse({ type: PublicRenderOccurrenceDto })
  attach(
    @GetOrgFromRequest() org: Organization,
    @Param('occurrenceId') occurrenceId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: PublicAttachRenderedDto
  ) {
    return this.mapError(() =>
      this.render.attach(org.id, occurrenceId, idempotencyKey, body)
    );
  }

  @Post('/:occurrenceId/cancel')
  @ApiOkResponse({ type: PublicRenderOccurrenceDto })
  cancel(
    @GetOrgFromRequest() org: Organization,
    @Param('occurrenceId') occurrenceId: string
  ) {
    return this.mapError(() => this.render.cancel(org.id, occurrenceId));
  }
}
