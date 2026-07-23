/*
 * Browser-side video transcoding to web-safe MP4 (H.264/AAC), via ffmpeg.wasm.
 *
 * Why client-side: the app runs on Vercel serverless (no ffmpeg binary) + Supabase
 * storage, so there is no server to transcode on. Converting in the poster's
 * browser BEFORE upload means a .mov/QuickTime clip (which Chrome & Firefox can't
 * play) becomes an .mp4 everyone can watch — no servers, no monthly cost.
 *
 * The 32MB wasm core is SELF-HOSTED under /public/ffmpeg (no CDN, no CSP issue)
 * and lazy-loaded only when a non-mp4 video is actually picked, so it never
 * touches the main bundle or a photo/mp4 upload. Single-threaded core, so it needs
 * no cross-origin isolation (COOP/COEP) headers.
 */
// The @ffmpeg/ffmpeg wrapper + @ffmpeg/util are DYNAMICALLY imported the first time
// a conversion runs, so neither the wrapper nor the 32MB wasm core touches any page
// that isn't converting a video. `FFmpeg` is used only as a type here.
import type { FFmpeg } from '@ffmpeg/ffmpeg';

const CORE_BASE = '/ffmpeg';

let ffmpegPromise: Promise<FFmpeg> | null = null;

/** Lazy singleton — load the wrapper + the self-hosted ESM core once.
 *
 *  Key detail (this is what broke conversions before): the @ffmpeg/ffmpeg wrapper
 *  spawns its worker as a MODULE worker (`type: "module"`), where `importScripts`
 *  is unavailable. Its worker tries importScripts first, then falls back to a
 *  dynamic `import(coreURL)` — which requires the ESM core (a module with a
 *  `default` export), NOT the UMD core. We self-host the ESM core + wasm under
 *  /public/ffmpeg (same dir, so the core's `new URL('ffmpeg-core.wasm',
 *  import.meta.url)` finds the wasm) and let Vite bundle the wrapper's worker
 *  (which resolves its own sibling imports). Direct same-origin URLs, no blobs. */
async function getFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const ff = new FFmpeg();
      await ff.load({
        coreURL: `${CORE_BASE}/ffmpeg-core.js`,
        wasmURL: `${CORE_BASE}/ffmpeg-core.wasm`,
      });
      return ff;
    })().catch((e) => { ffmpegPromise = null; throw e; });
  }
  return ffmpegPromise;
}

/** True when a file is a video that ISN'T already a web-safe mp4. */
export function needsTranscode(file: File): boolean {
  if (!file.type.startsWith('video/')) return false;
  // Already an mp4 → leave it alone (H.264 mp4 plays everywhere).
  if (file.type === 'video/mp4' || /\.mp4$/i.test(file.name)) return false;
  return true;
}

/**
 * Transcode a video File to a web-safe MP4 (H.264 video, AAC audio, faststart for
 * progressive playback). `onProgress` receives 0..1. Returns a new File; on any
 * failure it throws (the caller can fall back to uploading the original + warning).
 */
export async function transcodeToMp4(
  file: File,
  onProgress?: (ratio: number) => void,
): Promise<File> {
  const ff = await getFFmpeg();
  const { fetchFile } = await import('@ffmpeg/util');

  const onProg = ({ progress }: { progress: number }) => {
    // ffmpeg progress is 0..1 but can briefly exceed 1; clamp for the UI.
    if (onProgress) onProgress(Math.max(0, Math.min(1, progress)));
  };
  ff.on('progress', onProg);

  const inName = 'input';
  const outName = 'output.mp4';
  try {
    await ff.writeFile(inName, await fetchFile(file));
    // -c:v libx264 (universal), yuv420p (Safari/QuickTime-recorded clips are often
    // 4:2:2 or contain rotation), AAC audio, +faststart so it streams while loading.
    await ff.exec([
      '-i', inName,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '26',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outName,
    ]);
    const data = await ff.readFile(outName);
    // data is a Uint8Array; wrap into an mp4 File.
    const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
    const base = file.name.replace(/\.[^.]+$/, '');
    return new File([bytes], `${base}.mp4`, { type: 'video/mp4' });
  } finally {
    ff.off('progress', onProg);
    // best-effort cleanup of the in-memory FS
    try { await ff.deleteFile(inName); } catch { /* ignore */ }
    try { await ff.deleteFile(outName); } catch { /* ignore */ }
  }
}
