import { useCallback, useEffect, useState } from 'react';
import {
  UserRound, Mail, Smartphone, MessageSquare, Instagram, Facebook, Linkedin, Music2,
  Star, Pencil, Check, X, Loader2,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { upsertMyProfile, uploadMyAvatar, myContactPhone, updateMyContactPhone } from '../../../lib/api';
import { fetchMemberProfile } from '../../../lib/community';
import { supabase } from '../../../lib/supabase';
import { toErrorMessage } from '../../../lib/ops/errors';
import {
  getMyContactPrefs, saveMyContactPrefs, type MyContactPrefs,
  PREFERRED_CONTACT_OPTIONS, preferredContactLabel,
  mailHref, telHref, smsHref, whatsappHref, whatsappCallHref,
} from '../../../lib/contact';
import type { MemberDirectoryEntry } from '../../../lib/community-types';
import { SectionCard } from './SectionCard';
import AvatarCropModal from '../../AvatarCropModal';

const MAX_AVATAR_INPUT_BYTES = 10 * 1024 * 1024;

const RIDING_LEVELS = [
  { value: 'newcomer', label: 'New to riding' },
  { value: 'returning', label: 'Returning rider' },
  { value: 'committed', label: 'Riding regularly' },
  { value: 'experienced', label: 'Experienced' },
];

function fmtMemberSince(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

// ── surface-editable field primitives (same look as the rest of the account
//    surface, so the edit view reads as one continuous page, not a sub-form) ──
function ContactField({
  icon: Icon, label, placeholder, value, onValue, hidden, onHidden,
}: {
  icon: typeof Mail; label: string; placeholder: string;
  value: string; onValue: (v: string) => void;
  hidden: boolean; onHidden: (v: boolean) => void;
}) {
  return (
    <div className="bg-white border border-green-800/10 rounded-xl p-3.5">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={15} className="text-green-700" />
        <span className="text-[12px] font-medium text-green-900">{label}</span>
        <label className="ml-auto inline-flex items-center gap-1.5 text-[10.5px] text-muted">
          <input type="checkbox" className="accent-green-700" checked={hidden}
            onChange={(e) => onHidden(e.target.checked)} /> Hide from community
        </label>
      </div>
      <input
        className="w-full px-3 py-2 rounded-lg border border-green-800/15 text-sm text-green-900 placeholder:text-muted focus-ring"
        placeholder={placeholder} value={value} onChange={(e) => onValue(e.target.value)}
      />
    </div>
  );
}

function SocialField({
  icon: Icon, label, placeholder, value, onValue,
}: {
  icon: typeof Instagram; label: string; placeholder: string;
  value: string; onValue: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2.5 bg-white border border-green-800/10 rounded-xl px-3.5 py-2.5">
      <Icon size={16} className="text-green-700 shrink-0" />
      <span className="text-[12px] font-medium text-green-900 w-20 shrink-0">{label}</span>
      <input className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-green-800/15 text-sm text-green-900 placeholder:text-muted focus-ring"
        placeholder={placeholder} value={value} onChange={(e) => onValue(e.target.value)} />
    </div>
  );
}

/**
 * SECTION 1 — PROFILE (community-visible). Owner spec 2026-08-05
 * (TASK-PROFILE): rendered AS OTHER MEMBERS SEE IT by default (a real preview,
 * fetched through the exact same `member_directory` read path MemberProfile.tsx
 * uses, not a hand-rebuilt approximation), with one Edit button revealing every
 * editable field in place. Save returns to the preview.
 *
 * No badge system exists yet (checked: no badge table, no badge code beyond
 * unrelated UI notification-count/status pills) — the slot is simply omitted
 * rather than faked; see TASK-PROFILE-REPORT.md.
 */
export function ProfileCard() {
  const { user, profile, refreshProfile } = useAuth();
  const [preview, setPreview] = useState<MemberDirectoryEntry | null>(null);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // Edit-form state
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [ridingLevel, setRidingLevel] = useState('');
  const [phone, setPhone] = useState('');
  const [prefs, setPrefs] = useState<MyContactPrefs | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const loadPreview = useCallback(() => {
    if (!user) return;
    fetchMemberProfile(user.id).then(setPreview).catch(() => setPreview(null));
  }, [user]);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  useEffect(() => {
    if (!user) return;
    supabase.from('members').select('started_at').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setMemberSince((data as { started_at: string } | null)?.started_at ?? null));
  }, [user]);

  function beginEdit() {
    setDisplayName(profile?.display_name ?? '');
    setBio(profile?.bio ?? '');
    setAvatarUrl(profile?.avatar_url ?? '');
    setRidingLevel(profile?.riding_level ?? '');
    myContactPhone().then((p) => setPhone(p ?? '')).catch(() => setPhone(''));
    getMyContactPrefs().then(setPrefs).catch(() => setPrefs(null));
    setEditing(true);
  }

  function set<K extends keyof MyContactPrefs>(key: K, value: MyContactPrefs[K]) {
    setPrefs((p) => (p ? { ...p, [key]: value } : p));
    saveMyContactPrefs({ [key]: value }).catch(() => { /* keep UI state; retried on next field save */ });
  }

  function onAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);
    if (file.size > MAX_AVATAR_INPUT_BYTES) {
      setUploadError('That image is larger than 10MB. Please choose a smaller photo.');
      return;
    }
    setCropFile(file);
  }

  async function onCropConfirm(blob: Blob) {
    setCropFile(null);
    setUploading(true);
    try {
      setAvatarUrl(await uploadMyAvatar(blob, 'avatar.jpg'));
    } catch (err) {
      setUploadError(toErrorMessage(err, 'Upload failed.'));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await Promise.all([
        upsertMyProfile({
          display_name: displayName.trim() || null,
          bio: bio.trim() || null,
          avatar_url: avatarUrl.trim() || null,
          riding_level: ridingLevel || null,
        }),
        updateMyContactPhone(phone.trim() || null),
      ]);
      await refreshProfile();
      loadPreview();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const name = preview?.display_name || preview?.first_name || profile?.first_name || 'Member';
  const initial = (name || 'M').charAt(0).toUpperCase();
  const socials = prefs ? [
    prefs.social_instagram && { icon: Instagram, href: prefs.social_instagram, label: 'Instagram' },
    prefs.social_facebook && { icon: Facebook, href: prefs.social_facebook, label: 'Facebook' },
    prefs.social_linkedin && { icon: Linkedin, href: prefs.social_linkedin, label: 'LinkedIn' },
    prefs.social_tiktok && { icon: Music2, href: prefs.social_tiktok, label: 'TikTok' },
  ].filter(Boolean) as { icon: typeof Instagram; href: string; label: string }[] : [];

  return (
    <SectionCard icon={UserRound} title="Profile" badge="Visible to the community">
      {!editing ? (
        <div className="flex flex-col items-center text-center">
          {preview?.avatar_url
            ? <img src={preview.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover" />
            : <span className="w-20 h-20 rounded-full bg-green-100 text-green-800 grid place-items-center text-2xl font-serif font-semibold">{initial}</span>}
          <h3 className="font-serif text-green-900 text-xl font-semibold mt-3">{name}</h3>
          {(preview?.riding_level || preview?.is_horse_owner) && (
            <p className="text-[11px] uppercase tracking-wide text-gold-800 font-semibold mt-1">
              {[preview?.riding_level, preview?.is_horse_owner ? 'Horse Owner' : null].filter(Boolean).join(' · ')}
            </p>
          )}
          {preferredContactLabel(preview?.preferred_contact) && (
            <span className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-green-800 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
              <Star size={13} className="text-gold-600" /> Prefers {preferredContactLabel(preview?.preferred_contact)}
            </span>
          )}
          {preview?.bio && <p className="text-sm text-secondary mt-4 max-w-md leading-relaxed">{preview.bio}</p>}

          {(preview?.community_email || preview?.mobile_call || preview?.mobile_text
            || preview?.whatsapp_call || preview?.whatsapp_text || socials.length > 0) && (
            <div className="mt-5 pt-5 border-t border-green-800/10 w-full flex flex-wrap items-center justify-center gap-2">
              {preview?.community_email && <a href={mailHref(preview.community_email)} className="inline-flex items-center gap-1.5 text-xs text-green-700 border border-green-800/15 rounded-lg px-3 py-2 hover:bg-green-50"><Mail size={14} /> Email</a>}
              {preview?.mobile_call && <a href={telHref(preview.mobile_call)} className="inline-flex items-center gap-1.5 text-xs text-green-700 border border-green-800/15 rounded-lg px-3 py-2 hover:bg-green-50"><Smartphone size={14} /> Call</a>}
              {preview?.mobile_text && <a href={smsHref(preview.mobile_text)} className="inline-flex items-center gap-1.5 text-xs text-green-700 border border-green-800/15 rounded-lg px-3 py-2 hover:bg-green-50"><MessageSquare size={14} /> Text</a>}
              {preview?.whatsapp_text && <a href={whatsappHref(preview.whatsapp_text)} className="inline-flex items-center gap-1.5 text-xs text-green-700 border border-green-800/15 rounded-lg px-3 py-2 hover:bg-green-50"><MessageSquare size={14} /> WhatsApp</a>}
              {preview?.whatsapp_call && <a href={whatsappCallHref(preview.whatsapp_call)} className="inline-flex items-center gap-1.5 text-xs text-green-700 border border-green-800/15 rounded-lg px-3 py-2 hover:bg-green-50"><Smartphone size={14} /> WhatsApp Call</a>}
              {socials.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                  aria-label={s.label} className="grid place-items-center w-9 h-9 text-green-700 border border-green-800/15 rounded-lg hover:bg-green-50"><s.icon size={16} /></a>
              ))}
            </div>
          )}

          {fmtMemberSince(memberSince) && (
            <p className="text-[11px] text-muted mt-4">Member since {fmtMemberSince(memberSince)}</p>
          )}

          <button type="button" onClick={beginEdit}
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-green-800 border border-green-800/25 rounded-lg px-4 py-2 hover:border-green-800/40 focus-ring">
            <Pencil size={14} /> Edit profile
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-[11.5px] text-muted">This is what other members see — choose what you share.</p>
            <button type="button" onClick={() => setEditing(false)} aria-label="Close without saving"
              className="text-muted hover:text-green-800 p-1 -m-1 focus-ring rounded"><X size={18} /></button>
          </div>

          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-green-800 text-white flex items-center justify-center font-serif text-2xl">{initial}</div>
            )}
            <div className="flex-1 min-w-0">
              <label className="form-label" htmlFor="p_avatar_file">Profile photo</label>
              <input id="p_avatar_file" type="file" accept="image/*" className="form-input" onChange={onAvatarFile} disabled={uploading} />
              {uploading && <p className="form-hint mt-1">Uploading…</p>}
              {uploadError && <p role="alert" className="form-error mt-1">{uploadError}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="form-label" htmlFor="p_display_name">Display name</label>
              <input id="p_display_name" className="form-input" value={displayName}
                onChange={(e) => setDisplayName(e.target.value)} placeholder="How others see you" />
            </div>
            <div>
              <label className="form-label" htmlFor="p_riding_level">Riding level</label>
              <select id="p_riding_level" className="form-input" value={ridingLevel} onChange={(e) => setRidingLevel(e.target.value)}>
                <option value="">Prefer not to say</option>
                {RIDING_LEVELS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="p_phone">Phone</label>
              <input id="p_phone" type="tel" className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label" htmlFor="p_bio">About you</label>
              <textarea id="p_bio" rows={3} className="form-input resize-none" value={bio} onChange={(e) => setBio(e.target.value)}
                placeholder="A line or two — what brought you to riding, what you're working toward." />
            </div>
          </div>

          <p className="text-[10px] tracking-widest uppercase text-muted font-semibold mt-1">Contact information</p>
          <p className="text-[11.5px] text-muted -mt-2">Always visible to French Heritage. Choose what the community sees.</p>
          <div className="flex flex-col gap-2.5">
            <ContactField icon={Mail} label="Community email" placeholder="claire@example.com"
              value={prefs?.community_email ?? ''} onValue={(v) => set('community_email', v || null)}
              hidden={prefs?.hide_community_email ?? false} onHidden={(v) => set('hide_community_email', v)} />
            <ContactField icon={Smartphone} label="Calls" placeholder="(760) 555-0148"
              value={prefs?.mobile_call ?? ''} onValue={(v) => set('mobile_call', v || null)}
              hidden={prefs?.hide_mobile_call ?? false} onHidden={(v) => set('hide_mobile_call', v)} />
            <ContactField icon={Smartphone} label="Texts" placeholder="(760) 555-0148"
              value={prefs?.mobile_text ?? ''} onValue={(v) => set('mobile_text', v || null)}
              hidden={prefs?.hide_mobile_text ?? false} onHidden={(v) => set('hide_mobile_text', v)} />
            <ContactField icon={MessageSquare} label="WhatsApp calls" placeholder="(760) 555-0148"
              value={prefs?.whatsapp_call ?? ''} onValue={(v) => set('whatsapp_call', v || null)}
              hidden={prefs?.hide_whatsapp_call ?? false} onHidden={(v) => set('hide_whatsapp_call', v)} />
            <ContactField icon={MessageSquare} label="WhatsApp texts" placeholder="(760) 555-0148"
              value={prefs?.whatsapp_text ?? ''} onValue={(v) => set('whatsapp_text', v || null)}
              hidden={prefs?.hide_whatsapp_text ?? false} onHidden={(v) => set('hide_whatsapp_text', v)} />
          </div>

          <p className="text-[10px] tracking-widest uppercase text-muted font-semibold mt-1">Social accounts</p>
          <div className="flex flex-col gap-2">
            <SocialField icon={Music2} label="TikTok" placeholder="@handle" value={prefs?.social_tiktok ?? ''} onValue={(v) => set('social_tiktok', v || null)} />
            <SocialField icon={Instagram} label="Instagram" placeholder="@handle" value={prefs?.social_instagram ?? ''} onValue={(v) => set('social_instagram', v || null)} />
            <SocialField icon={Facebook} label="Facebook" placeholder="profile URL" value={prefs?.social_facebook ?? ''} onValue={(v) => set('social_facebook', v || null)} />
            <SocialField icon={Linkedin} label="LinkedIn" placeholder="profile URL" value={prefs?.social_linkedin ?? ''} onValue={(v) => set('social_linkedin', v || null)} />
          </div>

          <p className="text-[10px] tracking-widest uppercase text-muted font-semibold mt-1">Preferred contact method</p>
          <p className="text-[11.5px] text-muted -mt-2">How you'd rather be reached by other members — all your shared channels still appear on your profile.</p>
          <select
            value={prefs?.preferred_contact ?? 'none'}
            onChange={(e) => set('preferred_contact', e.target.value as MyContactPrefs['preferred_contact'])}
            className="form-input w-full text-sm">
            {PREFERRED_CONTACT_OPTIONS
              .filter((o) => o.requires === null || !!(prefs && prefs[o.requires]))
              .map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <div className="flex items-center gap-2 mt-1">
            <button type="button" onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn-outline-gold">Close</button>
          </div>

          {cropFile && <AvatarCropModal file={cropFile} onConfirm={onCropConfirm} onCancel={() => setCropFile(null)} />}
        </div>
      )}
    </SectionCard>
  );
}
