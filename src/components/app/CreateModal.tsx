import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, PenSquare, Tag, CalendarDays, MessageSquare, GraduationCap,
  ShoppingBag, Send, ChevronLeft, ImagePlus, Loader2,
  Handshake, FileText, UserPlus, Megaphone,
} from 'lucide-react';
import { feedPostCreate, uploadFeedMedia, type FeedPostType, type FeedVisibility } from '../../lib/feed';
import { createThread, proposeEvent } from '../../lib/community';
import { listListableHorses, type ListableHorse } from '../../lib/stable';
import { useAuth } from '../../contexts/AuthContext';
import { adminCreateAnnouncement } from '../../lib/admin';

/**
 * CREATE MODAL — the universal "+" from the header, wired to real backends.
 * Step 1 destination → step 2 post type → step 3 the full form per type:
 *   Social     → feed_post_create (rider_post): media + description + link
 *   For Sale   → feed_post_create (horse|gear): listing type; a HORSE listing picks
 *                from the member's listable records (spec H.9 — server-enforced
 *                eligibility; sale vs lease intent) and prefills from the record;
 *                title/price/description/link
 *   Event      → proposeEvent: title, start/end, location, description
 *   Discussion → createThread: title + details
 * Operators additionally get visibility, post-as-company (admins), and scheduling.
 */

type Step = 'destination' | 'post_type' | 'form' | 'announce';
type PostType = 'social' | 'for_sale' | 'event' | 'discussion';

const POST_TYPES: { key: PostType; label: string; icon: typeof PenSquare; hint: string }[] = [
  { key: 'social', label: 'Social', icon: ImagePlus, hint: 'Share a photo or moment' },
  { key: 'for_sale', label: 'For Sale', icon: Tag, hint: 'List a horse or gear — free is a price' },
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
const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-green-800/15 text-sm text-green-900 placeholder:text-muted focus-ring bg-white';
// resize is allowed vertically but CAPPED so a large drag can never blow up the
// modal layout (the old free resize could push the sheet off-screen).
const textareaCls = `${inputCls} resize-y min-h-[5.5rem] max-h-56`;

function horseLabel(h: ListableHorse): string {
  const name = h.barn_name || h.registered_name || 'Horse';
  return [name, h.breed, h.height].filter(Boolean).join(' · ');
}

function PostForm({ type, onClose }: { type: PostType; onClose: () => void }) {
  const navigate = useNavigate();
  const { isStaff, isAdmin } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [saleKind, setSaleKind] = useState<'horse' | 'gear'>('gear');
  const [isFree, setIsFree] = useState(false); // price state, not a listing type
  const [intent, setIntent] = useState<'sale' | 'lease'>('sale');
  const [horses, setHorses] = useState<ListableHorse[]>([]);
  const [horseId, setHorseId] = useState('');
  const [price, setPrice] = useState('');
  const [when, setWhen] = useState('');
  const [ends, setEnds] = useState('');
  const [location, setLocation] = useState('');
  // operator extras
  const [visibility, setVisibility] = useState<FeedVisibility>('members');
  const [asCompany, setAsCompany] = useState(false);
  const [publishAt, setPublishAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const needsMedia = type === 'social' || type === 'for_sale';

  // Horse listings pick from the member's LISTABLE records (server-enforced).
  useEffect(() => {
    if (type !== 'for_sale' || saleKind !== 'horse') return;
    listListableHorses(intent)
      .then(setHorses)
      .catch(() => setHorses([]));
  }, [type, saleKind, intent]);

  // Selecting a record prefills the listing from its DESCRIPTIVE fields only.
  useEffect(() => {
    if (!horseId) return;
    const h = horses.find((x) => x.id === horseId);
    if (!h) return;
    const name = h.barn_name || h.registered_name || '';
    if (!title) setTitle(`${name} — for ${intent}`);
    const desc = [
      h.registered_name && `Registered name: ${h.registered_name}`,
      h.breed && `Breed: ${h.breed}`,
      h.sex && `Sex: ${h.sex}`,
      h.height && `Height: ${h.height}`,
      h.color && `Color: ${h.color}`,
      h.date_of_birth && `Foaled: ${h.date_of_birth}`,
    ].filter(Boolean).join('\n');
    if (!body) setBody(desc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horseId]);

  async function submit() {
    setErr(null);
    if (needsMedia && !file) { setErr('Add one photo or video to post.'); return; }
    if (type === 'discussion' && !title.trim()) { setErr('Give your discussion a title.'); return; }
    if (type === 'event' && (!title.trim() || !when)) { setErr('An event needs a title and a start time.'); return; }
    setBusy(true);
    try {
      if (type === 'social' || type === 'for_sale') {
        const media = await uploadFeedMedia(file!);
        const postType: FeedPostType = type === 'social' ? 'rider_post'
          : saleKind === 'horse' ? 'horse' : 'gear';
        const bodyText = type === 'for_sale'
          ? [
              title.trim(),
              saleKind === 'horse' ? `For ${intent}` : null,
              isFree ? 'Free to a good home' : price && `Price: ${price}`,
              body,
            ].filter(Boolean).join('\n')
          : body;
        await feedPostCreate({
          post_type: postType,
          media_url: media.url,
          media_kind: media.kind,
          body: bodyText || null,
          source_link: link.trim() || null,
          subject_horse_id: saleKind === 'horse' && horseId ? horseId : null,
          as_company: isAdmin ? asCompany : false,
          visibility: isStaff ? visibility : 'members',
          publish_at: isStaff && publishAt ? new Date(publishAt).toISOString() : null,
        });
      } else if (type === 'discussion') {
        await createThread(title.trim(), body.trim());
      } else if (type === 'event') {
        await proposeEvent({
          title: title.trim(),
          starts_at: new Date(when).toISOString(),
          ends_at: ends ? new Date(ends).toISOString() : null,
          location: location || null,
          description: body || null,
        });
      }
      onClose();
      navigate(type === 'for_sale' ? '/app?filter=for_sale' : '/app');
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
              {(['horse', 'gear'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setSaleKind(t)}
                  className={`flex-1 py-2 rounded-lg border text-sm capitalize ${saleKind === t ? 'bg-green-50 border-green-300 text-green-800 font-medium' : 'border-green-800/15 text-secondary hover:bg-green-50'}`}>{t}</button>
              ))}
            </div>
          </div>

          {saleKind === 'horse' && (
            <>
              <div>
                <FieldLabel>Offering</FieldLabel>
                <div className="flex gap-2">
                  {(['sale', 'lease'] as const).map((t) => (
                    <button key={t} type="button" onClick={() => { setIntent(t); setHorseId(''); }}
                      className={`flex-1 py-2 rounded-lg border text-sm capitalize ${intent === t ? 'bg-green-50 border-green-300 text-green-800 font-medium' : 'border-green-800/15 text-secondary hover:bg-green-50'}`}>
                      For {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel>Which horse</FieldLabel>
                <select className={inputCls} value={horseId} onChange={(e) => setHorseId(e.target.value)}>
                  <option value="">
                    {horses.length === 0 ? 'No listable horses on your account' : 'Select from your records…'}
                  </option>
                  {horses.map((h) => <option key={h.id} value={h.id}>{horseLabel(h)}</option>)}
                </select>
                <p className="text-[11px] text-muted mt-1">
                  You can list horses on your account record — owners freely; a leased
                  horse only for lease, and only when the lease allows subleasing.
                </p>
              </div>
            </>
          )}

          <div className="grid sm:grid-cols-2 gap-3.5">
            <div><FieldLabel>Title</FieldLabel><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={saleKind === 'horse' ? 'e.g. Copper — for lease' : 'e.g. Antares saddle, 17.5"'} /></div>
            <div>
              <FieldLabel>Price</FieldLabel>
              {isFree
                ? <input className={inputCls} value="Free" readOnly />
                : <input className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} placeholder='$ or "Inquire"' />}
              {saleKind === 'gear' && (
                <label className="inline-flex items-center gap-1.5 text-[12px] text-secondary mt-1.5">
                  <input type="checkbox" className="accent-green-700" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
                  Free to a good home
                </label>
              )}
            </div>
          </div>
        </>
      )}

      {type === 'event' && (
        <>
          <div><FieldLabel>Event title</FieldLabel><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Summer schooling show" /></div>
          <div className="grid sm:grid-cols-2 gap-3.5">
            <div><FieldLabel>Starts</FieldLabel><input type="datetime-local" className={inputCls} value={when} onChange={(e) => setWhen(e.target.value)} /></div>
            <div><FieldLabel>Ends (optional)</FieldLabel><input type="datetime-local" className={inputCls} value={ends} onChange={(e) => setEnds(e.target.value)} /></div>
          </div>
          <div><FieldLabel>Location</FieldLabel><input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Carmel Creek Ranch" /></div>
        </>
      )}

      {type === 'discussion' && (
        <div><FieldLabel>Title</FieldLabel><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What do you want to ask?" /></div>
      )}

      <div>
        <FieldLabel>{type === 'discussion' ? 'Details' : 'Description'}</FieldLabel>
        <textarea className={textareaCls} value={body} onChange={(e) => setBody(e.target.value)}
          placeholder={type === 'discussion' ? 'Add context so people can weigh in' : 'Optional'} />
      </div>

      {(type === 'social' || type === 'for_sale') && (
        <div><FieldLabel>Link (optional)</FieldLabel><input type="url" className={inputCls} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" /></div>
      )}

      {/* operator controls (visibility for staff; company voice for admins) */}
      {isStaff && (type === 'social' || type === 'for_sale') && (
        <div className="grid sm:grid-cols-3 gap-3.5 border-t border-green-800/10 pt-3.5">
          {isAdmin && (
            <label className="inline-flex items-center gap-2 text-[12.5px] text-secondary self-end pb-2.5">
              <input type="checkbox" className="accent-green-700" checked={asCompany} onChange={(e) => setAsCompany(e.target.checked)} />
              Post as French Heritage
            </label>
          )}
          <div>
            <FieldLabel>Visibility</FieldLabel>
            <select className={inputCls} value={visibility} onChange={(e) => setVisibility(e.target.value as FeedVisibility)}>
              <option value="members">Members</option>
              <option value="public">Public</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div>
            <FieldLabel>Schedule (optional)</FieldLabel>
            <input type="datetime-local" className={inputCls} value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
          </div>
        </div>
      )}

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

function AnnounceForm({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!title.trim() || !body.trim()) { setErr('An announcement needs a title and a message.'); return; }
    setBusy(true);
    try {
      await adminCreateAnnouncement({ title: title.trim(), body: body.trim(), pinned });
      onClose();
      navigate('/app');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not publish the announcement.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      {/* gold outline — announcements read as official notices, not social posts */}
      <div className="border-2 border-gold-700/60 rounded-xl p-4 bg-white flex flex-col gap-3.5">
        <div><FieldLabel>Title</FieldLabel><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Barn closed Friday for the show" /></div>
        <div><FieldLabel>Message</FieldLabel><textarea className={textareaCls} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What everyone needs to know" /></div>
        <label className="inline-flex items-center gap-2 text-[12.5px] text-secondary">
          <input type="checkbox" className="accent-green-700" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          Pin to the top of the feed
        </label>
      </div>
      {err && <p className="form-error text-sm text-red-700">{err}</p>}
      <button type="button" onClick={submit} disabled={busy}
        className="w-full py-2.5 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring inline-flex items-center justify-center gap-2 disabled:opacity-60">
        {busy && <Loader2 size={16} className="animate-spin" />}
        Publish announcement
      </button>
    </div>
  );
}

export function CreateModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { isStaff, isAdmin } = useAuth();
  const [step, setStep] = useState<Step>('destination');
  const [postType, setPostType] = useState<PostType>('social');

  const title = step === 'destination' ? 'Create'
    : step === 'post_type' ? 'New community post'
    : step === 'announce' ? 'Announcement'
    : POST_TYPES.find((p) => p.key === postType)?.label ?? 'Post';

  function go(path: string) { onClose(); navigate(path); }

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className={`bg-cream w-full sm:rounded-2xl flex flex-col max-h-[92dvh] overflow-hidden ${
          step === 'form' ? 'sm:max-w-2xl' : 'sm:max-w-md'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-green-800/10 bg-cream shrink-0">
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

        <div className="p-4 sm:p-5 overflow-y-auto pb-8">
          {step === 'destination' && (
            <div className="flex flex-col gap-2.5">
              <p className="text-[10px] tracking-widest uppercase text-muted font-semibold">Post to community</p>
              <DestButton icon={PenSquare} label="Community post" hint="Social, for sale, event, or discussion" onClick={() => setStep('post_type')} />
              {isAdmin && (
                <DestButton icon={Megaphone} label="Announcement" hint="An official notice — gold-flagged in the feed" onClick={() => setStep('announce')} />
              )}
              {isStaff && (
                <>
                  <p className="text-[10px] tracking-widest uppercase text-muted font-semibold mt-2">For a client</p>
                  <DestButton icon={Handshake} label="New engagement" hint="Start a service engagement — contracts and paperwork attach to it" onClick={() => go('/app/ops/engagements/new')} />
                  <DestButton icon={FileText} label="New contract" hint="Lease or purchase — pick the client and the horse" onClick={() => go('/app/ops/contracts/new')} />
                  <DestButton icon={UserPlus} label="New client" hint="Create the account first — attach items, then invite" onClick={() => go('/app/ops/accounts/new')} />
                </>
              )}
              {/* client actions — an admin's "+" is a company control, not a shopper's */}
              {!isAdmin && (
                <>
                  <p className="text-[10px] tracking-widest uppercase text-muted font-semibold mt-2">Do something</p>
                  <DestButton icon={GraduationCap} label="Book a lesson" hint="Request a time with your instructor" onClick={() => go('/app/book')} />
                  <DestButton icon={ShoppingBag} label="Shop for sale" hint="Browse horses and gear" onClick={() => go('/app?filter=for_sale')} />
                  <DestButton icon={Send} label="New message" hint="Message a community member" onClick={() => go('/app/messages')} />
                </>
              )}
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
          {step === 'announce' && <AnnounceForm onClose={onClose} />}
        </div>
      </div>
    </div>
  );
}
