import {
  getYoutubeMediaFormat,
  resolveYoutubeMediaInputPath,
  YoutubeMediaFormatUnsupportedError,
} from '@gitroom/backend/public-api/services/youtube.media.normalizer';
import { resolve } from 'node:path';

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

describe('resolveYoutubeMediaInputPath', () => {
  it('maps a local-storage absolute URL into the mounted upload directory', () => {
    expect(
      resolveYoutubeMediaInputPath(
        'https://socialmanager.example/uploads/2026/08/31/video.mp4',
        'local',
        '/uploads'
      )
    ).toBe(resolve('/uploads', '2026/08/31/video.mp4'));
  });

  it('keeps remote object-storage URLs unchanged', () => {
    const url = 'https://media.example/tenant/video.mp4';
    expect(resolveYoutubeMediaInputPath(url, 'cloudflare', '/uploads')).toBe(
      url
    );
  });

  it('rejects traversal outside the upload mount', () => {
    expect(() =>
      resolveYoutubeMediaInputPath(
        '/uploads/../../etc/passwd.mp4',
        'local',
        '/uploads'
      )
    ).toThrow(YoutubeMediaFormatUnsupportedError);
  });
});
