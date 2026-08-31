import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

export class YoutubeMediaFormatUnsupportedError extends Error {}
export class YoutubeMediaTranscodeError extends Error {}

export type NormalizedYoutubeMedia = {
  path: string;
  dispose: () => Promise<void>;
};

export function getYoutubeMediaFormat(
  path: string
): 'mp4' | 'webm' | 'unsupported' {
  const cleanPath = path.toLowerCase().split(/[?#]/, 1)[0];
  if (cleanPath.endsWith('.mp4')) {
    return 'mp4';
  }
  if (cleanPath.endsWith('.webm')) {
    return 'webm';
  }
  return 'unsupported';
}

export function resolveYoutubeMediaInputPath(
  storedPath: string,
  storageProvider = process.env.STORAGE_PROVIDER || 'local',
  uploadDirectory = process.env.UPLOAD_DIRECTORY || ''
): string {
  if (storageProvider !== 'local') {
    return storedPath;
  }

  let pathname = storedPath;
  try {
    pathname = new URL(storedPath).pathname;
  } catch {
    // Older rows may contain a public path instead of an absolute URL.
  }

  const uploadsMarker = '/uploads/';
  const markerIndex = pathname.indexOf(uploadsMarker);
  const relativePath =
    markerIndex >= 0
      ? pathname.slice(markerIndex + uploadsMarker.length)
      : pathname.replace(/^[/\\]+/, '');
  const root = resolve(uploadDirectory);
  const candidate = resolve(root, decodeURIComponent(relativePath));
  const fromRoot = relative(root, candidate);

  if (
    !uploadDirectory ||
    isAbsolute(fromRoot) ||
    fromRoot === '..' ||
    fromRoot.startsWith(`..${sep}`)
  ) {
    throw new YoutubeMediaFormatUnsupportedError();
  }

  return candidate;
}

export async function normalizeYoutubeMedia(
  inputPath: string
): Promise<NormalizedYoutubeMedia> {
  const format = getYoutubeMediaFormat(inputPath);
  if (format === 'unsupported') {
    throw new YoutubeMediaFormatUnsupportedError();
  }
  if (format === 'mp4') {
    return { path: inputPath, dispose: async () => undefined };
  }

  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'happym-youtube-'));
  const outputPath = join(temporaryDirectory, 'normalized.mp4');
  try {
    await transcodeWebmToMp4(inputPath, outputPath);
    return {
      path: outputPath,
      dispose: () => rm(temporaryDirectory, { recursive: true, force: true }),
    };
  } catch {
    await rm(temporaryDirectory, { recursive: true, force: true });
    throw new YoutubeMediaTranscodeError();
  }
}

function transcodeWebmToMp4(inputPath: string, outputPath: string) {
  const configuredTimeout = Number(
    process.env.HAPPYM_YOUTUBE_TRANSCODE_TIMEOUT_MS || 10 * 60 * 1000
  );
  const timeoutMs = Number.isFinite(configuredTimeout)
    ? Math.min(Math.max(configuredTimeout, 30_000), 30 * 60 * 1000)
    : 10 * 60 * 1000;

  return new Promise<void>((resolve, reject) => {
    const child = spawn(
      'ffmpeg',
      [
        '-nostdin',
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        inputPath,
        '-map',
        '0:v:0',
        '-map',
        '0:a?',
        '-c:v',
        'libx264',
        '-preset',
        'medium',
        '-crf',
        '23',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-movflags',
        '+faststart',
        outputPath,
      ],
      { shell: false, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] }
    );

    // Drain stderr so ffmpeg cannot block on a full pipe. Its contents may
    // contain paths and are deliberately not logged or returned to callers.
    child.stderr?.resume();
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new YoutubeMediaTranscodeError());
    }, timeoutMs);

    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timeout);
      code === 0 ? resolve() : reject(new YoutubeMediaTranscodeError());
    });
  });
}
