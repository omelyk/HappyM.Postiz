import { HttpException } from '@nestjs/common';

jest.mock('@gitroom/nestjs-libraries/chat/mastra.service', () => ({
  MastraService: class MastraService {},
}));

import { PublicChatService } from './public.chat.service';

describe('PublicChatService', () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAiKey;
  });

  it('creates an organization-scoped thread and returns the assistant message', async () => {
    process.env.OPENAI_API_KEY = 'configured';
    const generate = jest
      .fn()
      .mockResolvedValue({ text: 'Risposta operativa' });
    const memory = { getThreadById: jest.fn(), recall: jest.fn() };
    const service = createService(generate, memory);

    const result = await service.sendMessage(
      { id: 'org-a' } as any,
      'Prepara un post Facebook'
    );

    expect(result.message).toBe('Risposta operativa');
    expect(result.threadId).toMatch(/^[0-9a-f-]{36}$/);
    expect(generate).toHaveBeenCalledWith(
      'Prepara un post Facebook',
      expect.objectContaining({
        memory: { thread: result.threadId, resource: 'org-a' },
        maxSteps: 10,
      })
    );
  });

  it('does not expose a thread owned by another organization', async () => {
    const memory = {
      getThreadById: jest
        .fn()
        .mockResolvedValue({ id: 'thread-a', resourceId: 'org-b' }),
      recall: jest.fn(),
    };
    const service = createService(jest.fn(), memory);

    const error = await service
      .getThread('org-a', 'thread-a')
      .catch((value) => value);

    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(404);
    expect(error.getResponse()).toEqual(
      expect.objectContaining({ code: 'chat_thread_not_found' })
    );
    expect(memory.recall).not.toHaveBeenCalled();
  });

  it('returns a structured service-unavailable error when AI is not configured', async () => {
    delete process.env.OPENAI_API_KEY;
    const service = createService(jest.fn(), {});

    const error = await service
      .sendMessage({ id: 'org-a' } as any, 'hello')
      .catch((value) => value);

    expect(error.getStatus()).toBe(503);
    expect(error.getResponse()).toEqual(
      expect.objectContaining({ code: 'ai_not_configured' })
    );
  });

  function createService(generate: jest.Mock, memory: any) {
    return new PublicChatService({
      mastra: async () => ({
        getAgent: () => ({ generate, getMemory: async () => memory }),
      }),
    } as any);
  }
});
