import { useRef, useState } from 'react';
import { Upload, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  uploadFeedMedia, feedPostCreate,
  type FeedPostType, type FeedVisibility, type FeedMediaKind,
} from '../../lib/feed';
import { needsTranscode, transcodeToMp4 } from '../../lib/transcode';

/**
 * FEED COMPOSER (Slice 3) — upload ONE media + a description + an optional plain
 * link, pick a type, and post. Single-media enforced (one file input, no gallery).
 * Operators get a byline toggle (post as self or as the company) + visibility.
 * Riders post as self only. No paste-to-import, no social auto-import (dead).
 */

const TYPE_OPTIONS: { value: FeedPostType; label: string }[] = [
  { value: 'rider_post', label: 'A moment' },
  { value: 'horse', label: 'A horse' },
  { value: 'gear', label: 'Gear' },
  { value: 'article', label: 'Article' },
  { value: 'event', label: 'Event' },
];

export function FeedComposer({ onPosted }: { onPosted: () => void }) {
  // Two-operator model: any operator (staff) posts with visibility control; only an
  // admin may post in the company's voice (as_company), matching the server gate.
  const { isAdmin, isStaff } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [kind, setKind] = useState<FeedMediaKind>('image');
  const [postType, setPostType] = useState<FeedPostType>('rider_post');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [asCompany, setAsCompany] = useState(false);
  const [visibility, setVisibility] = useState<FeedVisibility>('members');
  const [publishAt, setPublishAt] = useState('');   // staged/delayed (optional)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formatNote, setFormatNote] = useState<string | null>(null);
  // Transcode progress (0..1) while converting a non-mp4 video to mp4; null = idle.
  const [convertPct, setConvertPct] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function pick(f: File | null) {
    setFile(f);
    setError(null);
    setFormatNote(null);
    if (preview) URL.revokeObjectURL(preview);
    if (f) {
      setKind(f.type.startsWith('video/') ? 'video' : 'image');
      setPreview(URL.createObjectURL(f));
      // A non-mp4 video will be auto-converted to mp4 on post so it plays for
      // everyone — let the poster know it'll take a moment.
      if (needsTranscode(f)) {
        setFormatNote('This video will be converted to a universal format (.mp4) when you post, so everyone can watch. That takes a few moments.');
      }
    } else {
      setPreview(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      // A non-mp4 video is converted to a universal mp4 IN THE BROWSER before
      // upload, so it plays for everyone (a .mov can't play in Chrome/Firefox).
      // Do it before the size check — transcoding usually shrinks the file.
      let toUpload = file;
      if (needsTranscode(file)) {
        setConvertPct(0);
        try {
          toUpload = await transcodeToMp4(file, (r) => setConvertPct(r));
        } catch {
          setConvertPct(null);
          setError('That video couldn’t be converted. Please try an .mp4 file.');
          setBusy(false);
          return;
        }
        setConvertPct(null);
      }

      const { url, kind: mk } = await uploadFeedMedia(toUpload);
      await feedPostCreate({
        post_type: postType,
        media_url: url,
        media_kind: mk,
        body: body.trim() || null,
        source_link: link.trim() || null,
        as_company: isAdmin ? asCompany : false,
        visibility: isStaff ? visibility : 'members',
        publish_at: publishAt ? new Date(publishAt).toISOString() : null,
      });
      onPosted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {/* single media */}
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
        {preview ? (
          <div className="relative">
            {kind === 'video'
              ? <video src={preview} controls className="w-full max-h-72 object-contain rounded" />
              : <img src={preview} alt="" className="w-full max-h-72 object-contain rounded" />}
            <button type="button" onClick={() => pick(null)} className="mt-2 text-xs text-red-700 font-sans">Remove</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full border-2 border-dashed border-green-800/20 rounded-lg py-10 flex flex-col items-center gap-2 text-secondary"
          >
            <Upload size={22} />
            <span className="text-sm font-sans">Add one photo or video</span>
          </button>
        )}
      </div>

      <div>
        <label className="form-label" htmlFor="fc-type">Type</label>
        <select id="fc-type" className="form-input" value={postType} onChange={(e) => setPostType(e.target.value as FeedPostType)}>
          {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div>
        <label className="form-label" htmlFor="fc-body">Description</label>
        <textarea id="fc-body" rows={3} className="form-input resize-none" value={body}
          onChange={(e) => setBody(e.target.value)} placeholder="Say something…" />
      </div>

      <div>
        <label className="form-label" htmlFor="fc-link">Link (optional)</label>
        <input id="fc-link" type="url" className="form-input" value={link}
          onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
      </div>

      {isStaff && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-green-800/10 pt-4">
          {/* Company voice is admin-only (matches the server as_company gate). */}
          {isAdmin && (
            <label className="inline-flex items-center gap-2 text-sm text-secondary">
              <input type="checkbox" checked={asCompany} onChange={(e) => setAsCompany(e.target.checked)} />
              Post as the company
            </label>
          )}
          <div>
            <label className="form-label" htmlFor="fc-vis">Visibility</label>
            <select id="fc-vis" className="form-input" value={visibility} onChange={(e) => setVisibility(e.target.value as FeedVisibility)}>
              <option value="members">Members</option>
              <option value="public">Public</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="fc-when">Schedule (optional)</label>
            <input id="fc-when" type="datetime-local" className="form-input" value={publishAt}
              onChange={(e) => setPublishAt(e.target.value)} />
          </div>
        </div>
      )}

      {formatNote && convertPct === null && (
        <p className="text-[12px] text-gold-800 bg-gold-50 border border-gold-200 rounded-lg px-3 py-2">{formatNote}</p>
      )}
      {/* Transcode progress — the wasm core lazy-loads first (progress sits at 0),
          then the bar advances as the video converts. */}
      {convertPct !== null && (
        <div className="rounded-lg bg-green-800/5 border border-green-800/10 px-3 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] text-green-900 font-medium">
              {convertPct === 0 ? 'Preparing the video converter…' : 'Converting your video to a universal format…'}
            </span>
            <span className="text-[11px] text-muted tabular-nums">{Math.round(convertPct * 100)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-green-800/10 overflow-hidden">
            <div className="h-full bg-green-700 transition-[width] duration-200"
              style={{ width: `${Math.max(3, convertPct * 100)}%` }} />
          </div>
        </div>
      )}
      {error && <p role="alert" className="form-error">{error}</p>}
      <button type="submit" disabled={!file || busy} className="btn-primary justify-center">
        {convertPct !== null ? 'Converting…' : busy ? 'Posting…' : 'Post'}
        {!busy && <ArrowRight size={16} />}
      </button>
    </form>
  );
}
