import { useEffect, useState } from 'react';
import { Gift as GiftIcon, ChevronRight } from 'lucide-react';
import { listMyGifts, type MyGift } from '../../lib/api';
import { redeemGift, giftClaimLink, giftReschedule, giftTransfer, giftMarkSent } from '../../lib/gifts';
import { toErrorMessage } from '../../lib/ops/errors';
import { Modal } from '../ops/kit/Modal';

/**
 * MY GIFTS — the shared subject content (TASK-ACCOUNTSURFACE §1/§3), rendered
 * by both /app/gifts and the Account page's inline panel. Moved out of
 * Gifts.tsx unchanged.
 */

const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
const STATUS: Record<string, string> = {
  created: 'Being prepared', paid: 'Ready to send', delivered: 'Ready to use',
  opened: 'Opened', redeemed: 'Used', expired: 'Expired', cancelled: 'Cancelled',
};

export function GiftsContent() {
  const [gifts, setGifts] = useState<MyGift[] | null>(null);
  const [selected, setSelected] = useState<MyGift | null>(null);

  const reload = () => listMyGifts().then(setGifts).catch(() => setGifts([]));
  useEffect(() => { void reload(); }, []);

  const received = (gifts ?? []).filter((g) => g.direction === 'received');
  const given = (gifts ?? []).filter((g) => g.direction === 'given');

  return (
    <div className="mt-2.5 mb-1">
      {gifts === null ? (
        <p className="body-text text-muted">Loading…</p>
      ) : gifts.length === 0 ? (
        <div className="bg-white border border-green-800/10 rounded-xl p-8 text-center">
          <p className="body-text text-sm text-muted">You don't have any gifts yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <GiftGroup title="Received" gifts={received} onSelect={setSelected} />
          <GiftGroup title="Given" gifts={given} onSelect={setSelected} />
        </div>
      )}

      {selected && (
        <GiftDetail gift={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { void reload(); setSelected(null); }} />
      )}
    </div>
  );
}

function GiftGroup({ title, gifts, onSelect }: { title: string; gifts: MyGift[]; onSelect: (g: MyGift) => void }) {
  if (gifts.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted font-semibold mb-2">{title}</p>
      <div className="flex flex-col gap-2.5">
        {gifts.map((g) => (
          <button key={g.id} type="button" onClick={() => onSelect(g)}
            className="bg-white border border-green-800/10 rounded-xl p-4 flex items-center gap-3 text-left hover:border-green-800/30 focus-ring transition-colors">
            <span className="w-10 h-10 rounded-lg bg-gold-50 text-gold-700 grid place-items-center shrink-0"><GiftIcon size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-green-800 text-[16px] font-semibold leading-tight">
                {g.item_label || (g.amount != null ? `${usd(g.amount)} gift` : 'Gift')}
              </p>
              <p className="text-[12px] text-muted mt-0.5">
                {g.direction === 'received' ? `From ${g.buyer_name || 'someone'}` : `To ${g.recipient_name || 'someone'}`}
                {g.created_at && ` · ${fmtDate(g.created_at)}`}
              </p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-800/10 text-green-800 whitespace-nowrap">{STATUS[g.status ?? ''] ?? g.status}</span>
            <ChevronRight size={16} className="text-green-800/40 shrink-0" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}

function GiftDetail({ gift, onClose, onChanged }: {
  gift: MyGift; onClose: () => void; onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const canAct = gift.direction === 'given' && gift.status !== 'redeemed' && gift.status !== 'cancelled';

  /** 4b: redeem the gift for the signed-in recipient. The spine creates/promotes
   *  their CUSTOMER account, so the value lands on a real account. */
  async function useGift() {
    if (!gift.code) return;
    setBusy('redeem'); setErr(null); setMsg(null);
    try {
      const result = await redeemGift(gift.code);
      if (result === 'redeemed') { onChanged(); return; }
      setErr(result === 'already_redeemed' ? 'This gift has already been used.'
        : result === 'expired' ? 'This gift has expired.'
        : result === 'awaiting_intro_call' ? 'This gift unlocks after your intro call.'
        : 'This gift could not be used.');
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not use this gift.'));
    } finally { setBusy(null); }
  }

  async function act(kind: 'link' | 'resend' | 'reschedule' | 'transfer') {
    setBusy(kind); setErr(null); setMsg(null);
    try {
      if (kind === 'link') {
        const path = await giftClaimLink(gift.id);
        const url = `${window.location.origin}${path}`;
        try { await navigator.clipboard.writeText(url); setMsg('Claim link copied.'); }
        catch { setMsg(url); }
      } else if (kind === 'resend') {
        await giftMarkSent(gift.id);
        setMsg('Resent — the recipient gets the reveal link again.');
      } else if (kind === 'reschedule') {
        const when = window.prompt('Deliver on (YYYY-MM-DD):');
        if (!when) return;
        await giftReschedule(gift.id, when);
        setMsg(`Delivery moved to ${when}.`);
        onChanged();
      } else {
        const name = window.prompt('New recipient name:');
        if (!name?.trim()) return;
        const email = window.prompt('New recipient email (optional):') ?? undefined;
        await giftTransfer(gift.id, name.trim(), email?.trim() || undefined);
        setMsg('Transferred to the new recipient.');
        onChanged();
      }
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not complete that.'));
    } finally { setBusy(null); }
  }

  return (
    /* ⚠️ TASK-FIX4 §3 — converged, and this one is the OTHER half of the rule:
       *"an information modal or empty one can close on click out."* It holds no
       field, so the shared dialog lets the backdrop close it, exactly as before. */
    <Modal open onClose={onClose} size="sm"
      title={gift.item_label || 'Gift'} subtitle={STATUS[gift.status ?? ''] ?? gift.status}
      error={err}>
        <dl className="flex flex-col gap-2 text-sm">
          {gift.amount != null && <Detail label="Value" value={usd(gift.amount)} />}
          <Detail label={gift.direction === 'received' ? 'From' : 'To'} value={gift.direction === 'received' ? gift.buyer_name : gift.recipient_name} />
          {gift.gift_message && <Detail label="Message" value={gift.gift_message} />}
          {gift.code && gift.direction === 'received' && <Detail label="Code" value={gift.code} />}
          {gift.expires_at && <Detail label="Expires" value={fmtDate(gift.expires_at)} />}
          {gift.redeemed_at && <Detail label="Used" value={fmtDate(gift.redeemed_at)} />}
        </dl>
        {gift.direction === 'received' && gift.status !== 'redeemed' && (
          <button type="button" onClick={useGift} disabled={busy === 'redeem' || !gift.code}
            className="w-full mt-5 py-2.5 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring disabled:opacity-60">
            {busy === 'redeem' ? 'Using…' : 'Use this gift'}
          </button>
        )}

        {/* 4c: the giver's actions on an unredeemed gift. */}
        {canAct && (
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" className="btn-outline-gold text-sm" disabled={busy !== null}
              onClick={() => act('link')}>Copy claim link</button>
            <button type="button" className="btn-outline-gold text-sm" disabled={busy !== null}
              onClick={() => act('resend')}>Resend</button>
            <button type="button" className="btn-outline-gold text-sm" disabled={busy !== null}
              onClick={() => act('reschedule')}>Reschedule</button>
            <button type="button" className="btn-outline-gold text-sm" disabled={busy !== null}
              onClick={() => act('transfer')}>Transfer</button>
          </div>
        )}
        {msg && <p className="text-xs text-green-700 mt-3 break-all">{msg}</p>}
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-green-900 text-right">{value}</dd>
    </div>
  );
}
