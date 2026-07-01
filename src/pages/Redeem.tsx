import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Gift as GiftIcon, ArrowRight, Sparkles } from 'lucide-react';
import { openGift, redeemGift, type GiftReveal as GiftRevealData } from '../lib/gifts';
import { useAuth } from '../contexts/AuthContext';
import GiftRevealBox from '../components/gift/GiftReveal';
import Seo from '../components/Seo';

type Phase = 'loading' | 'invalid' | 'wrapped' | 'opened';

export default function Redeem() {
  const [params] = useSearchParams();
  const code = params.get('code') || '';
  const navigate = useNavigate();
  const { user } = useAuth();

  const [phase, setPhase] = useState<Phase>('loading');
  const [gift, setGift] = useState<GiftRevealData | null>(null);
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!code) { setPhase('invalid'); return; }
    openGift(code)
      .then((g) => {
        if (!active) return;
        if (!g) setPhase('invalid');
        else { setGift(g); setPhase('wrapped'); }
      })
      .catch(() => active && setPhase('invalid'));
    return () => { active = false; };
  }, [code]);

  async function handleRedeem() {
    if (!user) {
      // Send them to register/login, returning here to finish redeeming.
      navigate(`/register?redeem=${encodeURIComponent(code)}`);
      return;
    }
    const result = await redeemGift(code);
    if (result === 'redeemed') {
      navigate('/app');
    } else if (result === 'awaiting_intro_call') {
      setRedeemMsg("Almost there — we'll reach out to set up a quick intro call, then your booking unlocks.");
    } else if (result === 'already_redeemed') {
      setRedeemMsg('This gift has already been redeemed. Head to your account to book.');
    } else {
      setRedeemMsg("We couldn't redeem this just now. Please reach out and we'll sort it.");
    }
  }

  if (phase === 'loading') {
    return <div className="min-h-screen bg-green-950 flex items-center justify-center"><p className="text-white/70 font-sans">Finding your gift…</p></div>;
  }

  if (phase === 'invalid') {
    return (
      <div className="min-h-screen bg-green-950 flex items-center justify-center px-6 text-center">
        <div className="max-w-md">
          <GiftIcon size={32} className="text-gold-400 mx-auto mb-5" aria-hidden="true" />
          <h1 className="heading-section text-white mb-4">This gift link isn't valid</h1>
          <p className="text-on-dark-soft mb-8">It may have expired or already been opened. Reach out and we'll help.</p>
          <Link to="/contact" className="btn-ghost-white">Contact us <ArrowRight size={16} /></Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Seo title="You've Been Gifted | French Heritage Equestrian" description="Open your gift from French Heritage Equestrian." path="/redeem" noindex />
      <section className="min-h-screen bg-gradient-to-b from-green-900 to-green-950 flex items-center justify-center px-6 py-16">
        <div className="max-w-lg w-full text-center">
          {phase === 'wrapped' ? (
            <>
              <p className="eyebrow-on-dark mb-3">A gift for you{gift?.recipient_name ? `, ${gift.recipient_name}` : ''}</p>
              <h1 className="heading-display text-white mb-8 text-[clamp(2rem,5vw,3rem)]">Something's waiting.</h1>
              {/* Placeholder animated "open" element — swap the art later (see GiftReveal). */}
              <GiftRevealBox onOpen={() => setPhase('opened')} />
              <p className="text-on-dark-soft text-sm mt-8">Tap to open</p>
            </>
          ) : (
            <div className="animate-fade-up">
              <Sparkles size={28} className="text-gold-400 mx-auto mb-5" aria-hidden="true" />
              <p className="eyebrow-on-dark mb-3">You've been given</p>
              <h1 className="heading-display text-white mb-4 text-[clamp(2rem,5vw,3rem)]">{gift?.item_label}</h1>
              {gift?.buyer_name && <p className="text-on-dark-soft mb-2">From {gift.buyer_name}</p>}
              {gift?.gift_message && (
                <blockquote className="font-serif italic text-gold-200 text-lg my-6 max-w-md mx-auto">
                  “{gift.gift_message}”
                </blockquote>
              )}

              <div className="bg-white/[0.06] border border-white/15 p-6 mt-8 max-w-sm mx-auto">
                <p className="text-on-dark-soft text-sm mb-5">
                  To use your gift, create your account and book your time with us.
                </p>
                <button type="button" onClick={handleRedeem} className="btn-ghost-white w-full justify-center">
                  {user ? 'Redeem & book' : 'Create my account'}
                  <ArrowRight size={16} />
                </button>
                {redeemMsg && <p className="text-gold-200 text-sm mt-4">{redeemMsg}</p>}
              </div>

              <p className="text-white/[0.5] text-xs mt-6 font-mono">{code}</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
