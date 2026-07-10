import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, PenSquare, Tag, CalendarDays, MessageSquare, GraduationCap,
  ShoppingBag, Send, ChevronLeft, ImagePlus, Loader2,
} from 'lucide-react';
import { feedPostCreate, uploadFeedMedia, type FeedPostType } from '../../lib/feed';
import { createThread, proposeEvent } from '../../lib/community';

/**
 * CREATE MODAL — the universal "+" from the header, wired to real backends.
 * Step 1 destination → step 2 post type → step 3 minimal form. Submits:
 *   Social     → feed_post_create (rider_post) + uploadFeedMedia (photo required)
 *   For Sale   → feed_post_create (horse|gear) + uploadFeedMedia
 *   Discussion → createThread (no media)
 *   Event      → proposeEvent (member-proposed, operator publishes)
 * Booking/shop/message route to their pages (real flows live there).
 */

type Step = 'destination' | 'post_type' | 'form';
type PostType = 'social' | 'for_sale' | 'event' | 'discussion';

const POST_TYPES: { key: PostType; label: string; icon: typeof PenSquare; hint: string }[] = [
  { key: 'social', label: 'Social', icon: ImagePlus, hint: 'Share a photo or moment' },
  { key: 'for_sale', label: 'For Sale', icon: Tag, hint: 'List a horse, gear, or free item' },
  { key: 'event', label: 'Event', icon: CalendarDays, hint: 'Invite the community' },
  { key: 'discussion', label: 'Discussion', icon: MessageSquare, hint: 'Ask or start a conversation' },
];

function DestButton({ icon: Icon, label, hint, onClick }: { icon: typeof PenSquare; label: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center gap-3.5 px-4 py-3.5 bg-white border border-green-800/10 rounded-xl hover:border-green-800/25 focus-ring text-left">
      <span className="w-10 h-10 rounded-lg bg-cream-100 grid place-items-center text-green-700 shrink-0"><Icon size={19} /></span>
      <span>
        <span className="block text-sm font-medium text-green-900">{label}</span>
        <span className="block text-[11.5px] text-muted">{hint}</span>
      </span>
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] tracking-wide uppercase text-muted font-semibold mb-1.5">{children}</label>;
}
const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-green-800/15 text-sm text-green-900 placeholder:text-muted focus-ring';

function PostForm({ type, onClose }: { type: PostType; onClose: () => void }) {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saleKind, setSaleKind] = useState<'horse' | 'gear' | 'free'>('gear');
  const [price, setPrice] = useState('');
  const [when, setWhen] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const needsMedia = type === 'social' || type === 'for_sale';

  async function submit() {
    setErr(null);
    if (needsMedia && !file) { setErr('Add one photo or video to post.'); return; }
    if (type === 'discussion' && !title.trim()) { setErr('Give your discussion a title.'); return; }
    if (type === 'event' && (!title.trim() || !when.trim())) { setErr('An event needs a title and a date.'); return; }
    setBusy(true);
    try {
      if (type === 'social' || type === 'for_sale') {
        const media = await uploadFeedMedia(file!);
        const postType: FeedPostType = type === 'social' ? 'rider_post'
          : saleKind === 'horse' ? 'horse' : 'gear'; // "free" lists as gear at $0
        const bodyText = type === 'for_sale'
          ? [title && `${title}`, price && `Price: ${price}`, body].filter(Boolean).join('\n')
          : body;
        await feedPostCreate({ post_type: postType, media_url: media.url, media_kind: media.kind, body: bodyText || null });
      } else if (type === 'discussion') {
        await createThread(title.trim(), body.trim());
      } else if (type === 'event') {
        // Parse a loose "date" input into ISO; fall back to now if unparseable.
        const dt = new Date(when);
        const iso = isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString();
        await proposeEvent({ title: title.trim(), starts_at: iso, location: location || null, description: body || null });
      }
      onClose();
      navigate('/app'); // land back on the main feed
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not post. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      {needsMedia && (
        <label className="border border-dashed border-green-800/25 rounded-xl grid place-items-center py-8 text-muted bg-white cursor-pointer hover:border-green-800/40">
          <ImagePlus size={22} />
          <p className="text-[12px] mt-1.5">{file ? file.name : 'Add one photo or video'}</p>
          <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      )}
      {type === 'for_sale' && (
        <>
          <div>
            <FieldLabel>Listing type</FieldLabel>
            <div className="flex gap-2">
              {(['horse', 'gear', 'free'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setSaleKind(t)}
                  className={`flex-1 py-2 rounded-lg border text-sm capitalize ${saleKind === t ? 'bg-green-50 border-green-300 text-green-800 font-medium' : 'border-green-800/15 text-secondary hover:bg-green-50'}`}>{t}</button>
              ))}
            </div>
          </div>
          <div><FieldLabel>Title</FieldLabel><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Antares saddle, 17.5&quot;" /></div>
          {saleKind !== 'free' && <div><FieldLabel>Price</FieldLabel><input className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="$ or “Inquire”" /></div>}
        </>
      )}
      {type === 'event' && (
        <>
          <div><FieldLabel>Event title</FieldLabel><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Summer schooling show" /></div>
          <div><FieldLabel>Date &amp; time</FieldLabel><input className={inputCls} value={when} onChange={(e) => setWhen(e.target.value)} placeholder="2026-07-14 09:00" /></div>
          <div><FieldLabel>Location</FieldLabel><input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Carmel Creek Ranch" /></div>
        </>
      )}
      {type === 'discussion' && (
        <div><FieldLabel>Title</FieldLabel><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What do you want to ask?" /></div>
      )}
      <div>
        <FieldLabel>{type === 'discussion' ? 'Details' : 'Description'}</FieldLabel>
        <textarea rows={3} className={inputCls} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Optional" />
      </div>
      {err && <p className="form-error text-sm text-red-700">{err}</p>}
      <button type="button" onClick={submit} disabled={busy}
        className="w-full py-2.5 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring inline-flex items-center justify-center gap-2 disabled:opacity-60">
        {busy && <Loader2 size={16} className="animate-spin" />}
        {type === 'event' ? 'Propose event' : 'Post to community'}
      </button>
      {type === 'event' && <p className="text-[11px] text-muted -mt-1">Proposed events are reviewed before they appear.</p>}
    </div>
  );
}

export function CreateModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('destination');
  const [postType, setPostType] = useState<PostType>('social');

  const title = step === 'destination' ? 'Create'
    : step === 'post_type' ? 'New community post'
    : POST_TYPES.find((p) => p.key === postType)?.label ?? 'Post';

  function go(path: string) { onClose(); navigate(path); }

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-cream w-full sm:max-w-md sm:rounded-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-green-800/10 sticky top-0 bg-cream">
          <div className="flex items-center gap-2">
            {step !== 'destination' && (
              <button type="button" onClick={() => setStep(step === 'form' ? 'post_type' : 'destination')} aria-label="Back" className="text-secondary hover:text-green-800">
                <ChevronLeft size={20} />
              </button>
            )}
            <h2 className="font-serif text-green-800 text-lg">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-secondary hover:text-green-800"><X size={20} /></button>
        </div>

        <div className="p-4">
          {step === 'destination' && (
            <div className="flex flex-col gap-2.5">
              <p className="text-[10px] tracking-widest uppercase text-muted font-semibold">Post to community</p>
              <DestButton icon={PenSquare} label="Community post" hint="Social, for sale, event, or discussion" onClick={() => setStep('post_type')} />
              <p className="text-[10px] tracking-widest uppercase text-muted font-semibold mt-2">Do something</p>
              <DestButton icon={GraduationCap} label="Book a lesson" hint="Request a time with your instructor" onClick={() => go('/app/book')} />
              <DestButton icon={ShoppingBag} label="Shop for sale" hint="Browse horses and gear" onClick={() => go('/app')} />
              <DestButton icon={Send} label="New message" hint="Message a community member" onClick={() => go('/app/messages')} />
            </div>
          )}
          {step === 'post_type' && (
            <div className="flex flex-col gap-2.5">
              {POST_TYPES.map((p) => (
                <DestButton key={p.key} icon={p.icon} label={p.label} hint={p.hint}
                  onClick={() => { setPostType(p.key); setStep('form'); }} />
              ))}
            </div>
          )}
          {step === 'form' && <PostForm type={postType} onClose={onClose} />}
        </div>
      </div>
    </div>
  );
}
