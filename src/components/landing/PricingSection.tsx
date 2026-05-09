'use client';

import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Users,
  Zap,
  ArrowRight,
  Gift,
  Clock,
  Star,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PricingSectionProps {
  onCta: () => void;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const FEATURES = [
  'Unlimited survey reports',
  'AI document extraction (RC, DL, Policy)',
  'Auto Google Drive backup',
  'Offline-first — works without internet',
  'UIIC Excel Bridge export',
  'Smart photo compression engine',
  'AI conflict review',
  'Multi-device access',
  'Priority email support',
];

// ── Helper ────────────────────────────────────────────────────────────────────

const FadeUp = ({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-40px' }}
    transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    className={className}
  >
    {children}
  </motion.div>
);

// ── Main component ────────────────────────────────────────────────────────────

export default function PricingSection({ onCta }: PricingSectionProps) {
  return (
    <section
      id="pricing"
      className="py-32 px-6 lg:px-12 bg-[#FBFBFD] border-t border-gray-100 relative overflow-hidden"
    >
      {/* Soft background gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-50/60 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10">

        {/* ── Header ── */}
        <div className="text-center mb-16">
          <FadeUp>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700 mb-6">
              <Star size={11} className="fill-amber-500 text-amber-500" />
              SIMPLE PRICING
            </div>
          </FadeUp>
          <FadeUp delay={0.08}>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-gray-900 mb-4">
              Start free. Pay only when
              <br />
              <span className="text-amber-500">you love it.</span>
            </h2>
          </FadeUp>
          <FadeUp delay={0.14}>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Full access for 60 days, no credit card required. After your trial, one
              straightforward plan covers everything.
            </p>
          </FadeUp>
        </div>

        {/* ── Pricing cards ── */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">

          {/* Free Trial card */}
          <FadeUp delay={0.1}>
            <div className="h-full bg-white border border-gray-200 rounded-3xl p-8 flex flex-col shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Clock size={18} className="text-gray-600" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Get started
                  </div>
                  <div className="text-lg font-black text-gray-900">60-Day Free Trial</div>
                </div>
              </div>

              <div className="mb-6">
                <div className="text-5xl font-black text-gray-900 leading-none">
                  \u20B90
                  <span className="text-lg text-gray-400 font-medium ml-1">/ 60 days</span>
                </div>
                <p className="text-sm text-gray-400 mt-2">No credit card · No commitment</p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {FEATURES.slice(0, 5).map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <CheckCircle2 size={15} className="text-green-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
                <li className="flex items-start gap-2.5 text-sm text-gray-400">
                  <CheckCircle2 size={15} className="text-gray-300 mt-0.5 shrink-0" />
                  …and everything else
                </li>
              </ul>

              <button
                onClick={onCta}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-gray-900 text-gray-900 font-bold text-sm hover:bg-gray-900 hover:text-white transition-all"
              >
                Start Free Trial <ArrowRight size={15} />
              </button>
            </div>
          </FadeUp>

          {/* Pro card */}
          <FadeUp delay={0.18}>
            <div className="h-full bg-gray-900 rounded-3xl p-8 flex flex-col shadow-xl shadow-gray-900/20 relative overflow-hidden">
              {/* Glow ring */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-[60px] pointer-events-none" />

              <div className="flex items-center gap-2 mb-6 relative z-10">
                <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center">
                  <Zap size={18} className="text-[#0D1B2A] fill-current" />
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-500/70 uppercase tracking-widest">
                    After trial
                  </div>
                  <div className="text-lg font-black text-white">SurveyOS Pro</div>
                </div>
                <span className="ml-auto text-[10px] font-bold text-amber-500 bg-amber-500/15 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  MOST POPULAR
                </span>
              </div>

              <div className="mb-6 relative z-10">
                <div className="text-5xl font-black text-white leading-none">
                  \u20B9999
                  <span className="text-lg text-white/40 font-medium ml-1">/ month</span>
                </div>
                <p className="text-sm text-white/40 mt-2">Billed monthly · Cancel anytime</p>
              </div>

              <ul className="space-y-3 mb-8 flex-1 relative z-10">
                {FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white/70">
                    <CheckCircle2 size={15} className="text-amber-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={onCta}
                className="relative z-10 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-amber-500 text-[#0D1B2A] font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-amber-500/20"
              >
                Start Free, Upgrade Later <ArrowRight size={15} />
              </button>
            </div>
          </FadeUp>
        </div>

        {/* ── Referral banner ── */}
        <FadeUp delay={0.25} className="mt-8 max-w-3xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl px-6 py-5">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
              <Gift size={20} className="text-amber-600" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div className="text-sm font-black text-gray-900">
                Refer a Surveyor → Get 1 Month Free
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Share your unique referral link. Every new surveyor who joins extends your
                subscription by one month — no cap.
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-amber-700 text-xs font-bold shrink-0">
              <Users size={13} />
              Earn for every referral
            </div>
          </div>
        </FadeUp>

        {/* ── Fine print ── */}
        <FadeUp delay={0.3} className="text-center mt-8">
          <p className="text-xs text-gray-400">
            Payment via UPI, NetBanking, or Credit / Debit card. Renewal reminders sent 7 days
            before expiry. Questions?{' '}
            <a
              href="mailto:surveyosprime@gmail.com"
              className="text-amber-600 hover:underline font-semibold"
            >
              surveyosprime@gmail.com
            </a>
          </p>
        </FadeUp>
      </div>
    </section>
  );
}
