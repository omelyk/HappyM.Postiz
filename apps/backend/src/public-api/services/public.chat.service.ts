import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RequestContext } from '@mastra/core/di';
import { Organization } from '@prisma/client';
import { MastraService } from '@gitroom/nestjs-libraries/chat/mastra.service';
import type { ChannelsContext } from '@gitroom/backend/api/routes/copilot.controller';

@Injectable()
export class PublicChatService {
  constructor(private _mastraService: MastraService) {}

  async sendMessage(
    organization: Organization,
    message: string,
    threadId?: string
  ) {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      throw new HttpException(
        { code: 'ai_not_configured', message: 'AI chat is not configured.' },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    const normalizedMessage = message?.trim();
    if (!normalizedMessage) {
      throw new HttpException(
        {
          code: 'invalid_message',
          message: 'A non-empty message is required.',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const agent = (await this._mastraService.mastra()).getAgent('postiz');
    const memory = await agent.getMemory();
    if (!memory) {
      throw new HttpException(
        {
          code: 'ai_memory_unavailable',
          message: 'AI chat memory is unavailable.',
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    if (threadId) this.validateThreadId(threadId);
    const resolvedThreadId = threadId || randomUUID();
    if (threadId) {
      await this.ensureOwnedThread(memory, organization.id, threadId);
    }

    const requestContext = new RequestContext<ChannelsContext>();
    requestContext.set('integrations', '[]');
    requestContext.set('organization', JSON.stringify(organization));
    requestContext.set('ui', 'false');

    try {
      const output = await agent.generate(normalizedMessage, {
        memory: { thread: resolvedThreadId, resource: organization.id },
        requestContext,
        maxSteps: 10,
      });

      return {
        threadId: resolvedThreadId,
        message: output.text,
      };
    } catch {
      Logger.error('Public AI chat generation failed');
      throw new HttpException(
        {
          code: 'ai_generation_failed',
          message: 'AI chat could not complete the request.',
        },
        HttpStatus.BAD_GATEWAY
      );
    }
  }

  async getThread(organizationId: string, threadId: string) {
    this.validateThreadId(threadId);
    const agent = (await this._mastraService.mastra()).getAgent('postiz');
    const memory = await agent.getMemory();
    if (!memory) {
      throw new HttpException(
        {
          code: 'ai_memory_unavailable',
          message: 'AI chat memory is unavailable.',
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    await this.ensureOwnedThread(memory, organizationId, threadId);
    const recalled = await memory.recall({
      resourceId: organizationId,
      threadId,
    });
    return { threadId, messages: recalled.messages || [] };
  }

  private async ensureOwnedThread(
    memory: any,
    organizationId: string,
    threadId: string
  ) {
    const thread = await memory.getThreadById({ threadId });
    if (!thread || thread.resourceId !== organizationId) {
      throw new HttpException(
        {
          code: 'chat_thread_not_found',
          message: 'AI chat thread was not found.',
        },
        HttpStatus.NOT_FOUND
      );
    }
  }

  private validateThreadId(threadId: string) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(threadId)) {
      throw new HttpException(
        {
          code: 'invalid_thread_id',
          message: 'AI chat thread id is invalid.',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }
}
