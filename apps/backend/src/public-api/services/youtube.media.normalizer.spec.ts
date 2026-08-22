import { getYoutubeMediaFormat } from '@gitroom/backend/public-api/services/youtube.media.normalizer';

describe('YouTube media normalization', () => {
  it.each([
    ['/tenant/video.mp4', 'mp4'],
    ['/tenant/video.MP4?token=opaque', 'mp4'],
    ['/tenant/studio-render.webm', 'webm'],
    ['/tenant/studio-render.WEBM#asset', 'webm'],
    ['/tenant/video.mov', 'unsupported'],
    ['/tenant/video.exe', 'unsupported'],
  ])('classifies %s as %s', (path, expected) => {
    expect(getYoutubeMediaFormat(path)).toBe(expected);
  });
});
