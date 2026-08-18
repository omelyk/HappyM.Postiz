import { MediaRepository } from '@gitroom/nestjs-libraries/database/prisma/media/media.repository';

describe('Public media repository contract', () => {
  it('soft-deletes only a live media item in the requested organization', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const repository = new MediaRepository({
      model: { media: { updateMany } },
    } as any);

    await repository.deleteMediaIfExists('org-a', 'media-a');

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'media-a', organizationId: 'org-a', deletedAt: null },
      })
    );
  });

  it('lists media with the public createdAt field and organization filter', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const repository = new MediaRepository({
      model: {
        media: {
          count: jest.fn().mockResolvedValue(0),
          findMany,
        },
      },
    } as any);

    await repository.getMedia('org-a', 1);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-a',
          deletedAt: null,
        }),
        select: expect.objectContaining({ createdAt: true }),
      })
    );
  });
});
