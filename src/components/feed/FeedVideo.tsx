import { useRef, useState, useCallback } from 'react';
import { Play, Pause, VideoOff, Volume2, VolumeX } from 'lucide-react';

/**
 * FEED VIDEO — community post video with deliberate, no-surprise playback.
 *
 * Never autoplays, never loops, always starts on the first frame. Two modes:
 *
 *  mode="card" (posts grid): a large centered PLAY button plays the video in
 *    place WITHOUT opening the post. Clicking anywhere ELSE on the card is left to
 *    the card (it opens the full view) — so this component only stops propagation
 *    on the play/pause control, never on the frame.
 *
 *  mode="modal" (opened post): clicking anywhere on the video toggles play/pause.
 *
 * While playing, the PAUSE button is revealed only on hover (cursor over the
 * video) in both modes. A paused/ended video shows the large play button again.
 * The parent resets to the first frame by re-mounting (key) on close.
 */
export function FeedVideo({
  src, mode, className = '',
}: {
  src: string;
  mode: 'card' | 'modal';
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  // Videos start MUTED (so a card can play without blaring audio); the viewer
  // unmutes with the speaker toggle if they want sound.
  const [muted, setMuted] = useState(true);
  // A format the browser can't decode (e.g. a .mov / QuickTime clip in Chrome or
  // Firefox) fires <video>'s error event — surface a clear message rather than a
  // silent black box (which is what the broken <img> render looked like before).
  const [failed, setFailed] = useState(false);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation(); // never open the card / toggle playback
    const v = ref.current;
    const next = !muted;
    setMuted(next);
    if (v) v.muted = next;
  };

  const play = useCallback(() => {
    const v = ref.current;
    if (!v) return;
    void v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, []);
  const pause = useCallback(() => {
    ref.current?.pause();
    setPlaying(false);
  }, []);
  const toggle = useCallback(() => { playing ? pause() : play(); }, [playing, play, pause]);

  // In card mode the play control must NOT bubble to the card's open handler.
  const onPlayButton = (e: React.MouseEvent) => { e.stopPropagation(); play(); };
  const onPauseButton = (e: React.MouseEvent) => { e.stopPropagation(); pause(); };

  // In modal mode, a click anywhere on the frame toggles play/pause.
  const onFrame = mode === 'modal' ? () => toggle() : undefined;

  if (failed) {
    return (
      <div className={`grid place-items-center bg-gradient-to-br from-green-50 to-gold-50 text-center px-4 ${
        mode === 'card' ? 'aspect-[16/10]' : 'aspect-video'} ${className}`}>
        <div className="text-green-800/70">
          <VideoOff size={26} className="mx-auto mb-1.5" aria-hidden="true" />
          <p className="text-xs font-medium">This video can’t play in your browser.</p>
          <p className="text-[11px] text-muted mt-0.5">It may be in a format (like .mov) this browser doesn’t support.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`group relative overflow-hidden bg-black ${className}`}>
      <video
        ref={ref}
        src={src}
        // no autoplay, no loop; starts muted, first frame visible before play
        preload="metadata"
        playsInline
        muted={muted}
        onClick={onFrame}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onError={() => setFailed(true)}
        className={`w-full h-full ${mode === 'card' ? 'object-cover' : 'object-contain max-h-[70vh]'} ${
          mode === 'modal' ? 'cursor-pointer' : ''
        }`}
      />

      {/* Speaker toggle — top-right, revealed on hover. Videos start muted; this
          unmutes (or re-mutes) without opening the card or toggling playback. */}
      <button
        type="button"
        aria-label={muted ? 'Unmute' : 'Mute'}
        onClick={toggleMute}
        className="absolute top-2 right-2 z-10 grid place-items-center w-9 h-9 rounded-full bg-black/50 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-black/70"
      >
        {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
      </button>

      {/* Large play button — shown whenever the video isn't playing. In card mode
          it plays in place (stops propagation); in modal mode it just plays. */}
      {!playing && (
        <button
          type="button"
          aria-label="Play video"
          onClick={onPlayButton}
          className="absolute inset-0 grid place-items-center focus-ring"
        >
          <span className="grid place-items-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm transition-transform hover:scale-105 hover:bg-black/70">
            <Play size={34} className="translate-x-[2px]" fill="currentColor" />
          </span>
        </button>
      )}

      {/* Pause button — visible only while playing AND the cursor is over the video
          (group-hover). Clicking it pauses without toggling the frame handler. */}
      {playing && (
        <button
          type="button"
          aria-label="Pause video"
          onClick={onPauseButton}
          className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100"
        >
          <span className="grid place-items-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-black/50 text-white shadow-lg backdrop-blur-sm hover:bg-black/70">
            <Pause size={28} fill="currentColor" />
          </span>
        </button>
      )}
    </div>
  );
}

export default FeedVideo;
