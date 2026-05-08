'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Cpu,
  FileCheck2,
  FileText,
  User,
  Hash,
  Calendar,
  Download,
  ChevronRight,
  CheckCircle2,
  Zap,
  ArrowRight,
  Car,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DemoSectionProps {
  onCta: () => void;
}

interface DemoField {
  label: string;
  value: string;
}

// ── Static data ───────────────────────────────────────────────────────────────

const DEMO_FIELDS: DemoField[] = [
  { label: 'Vehicle Reg.', value: 'MH 12 AB 1234' },
  { label: 'Owner', value: 'RAJESH KUMAR' },
  { label: 'IDV', value: '\u20B94,50,000' },
  { label: 'Engine No.', value: 'K12B1234567' },
  { label: 'Chassis No.', value: 'MA3EF1S00178234' },
  { label: 'Policy No.', value: 'UIIC/2024/12345678' },
  { label: 'Valid Until', value: '31/03/2026' },
  { label: 'Fuel Type', value: 'DIESEL' },
];

const STEPS = [
  {
    id: 0 as const,
    label: 'Upload Documents',
    short: 'Upload',
    desc: 'Drop RC Book, DL & Policy',
    Icon: Upload,
  },
  {
    id: 1 as const,
    label: 'AI Extraction',
    short: 'Extract',
    desc: 'AI reads every field instantly',
    Icon: Cpu,
  },
  {
    id: 2 as const,
    label: 'Report Ready',
    short: 'Report',
    desc: 'PDF ready in seconds',
    Icon: FileCheck2,
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function AppWindowHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/[0.03]">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full bg-red-400/60" />
        <div className="w-3 h-3 rounded-full bg-amber-400/60" />
        <div className="w-3 h-3 rounded-full bg-green-400/60" />
      </div>
      <span className="text-[10px] font-mono text-white/30 ml-2 truncate">{title}</span>
    </div>
  );
}

function UploadStep() {
  const docs = [
    {
      name: 'RC Book',
      ext: 'PDF',
      ring: 'border-blue-500/30 from-blue-500/10 to-blue-600/5',
      badge: 'text-blue-400 bg-blue-500/20',
      check: 'bg-blue-500',
    },
    {
      name: 'Driving Licence',
      ext: 'JPG',
      ring: 'border-emerald-500/30 from-emerald-500/10 to-emerald-600/5',
      badge: 'text-emerald-400 bg-emerald-500/20',
      check: 'bg-emerald-500',
    },
    {
      name: 'Insurance Policy',
      ext: 'PDF',
      ring: 'border-purple-500/30 from-purple-500/10 to-purple-600/5',
      badge: 'text-purple-400 bg-purple-500/20',
      check: 'bg-purple-500',
    },
  ];

  return (
    <div className="flex flex-col p-5 gap-5">
      <div>
        <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">
          Step 1 of 3
        </p>
        <h3 className="text-white text-base font-bold">Upload Survey Documents</h3>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {docs.map((doc, idx) => (
          <motion.div
            key={doc.name}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.18, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className={`relative bg-gradient-to-b ${doc.ring} border rounded-xl p-3 flex flex-col items-center gap-2`}
          >
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${doc.badge}`}>
              {doc.ext}
            </span>
            <FileText size={22} className={doc.badge.split(' ')[0]} />
            <span className="text-[9px] font-semibold text-white/60 text-center leading-tight">
              {doc.name}
            </span>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: idx * 0.18 + 0.35, type: 'spring', stiffness: 300, damping: 20 }}
              className={`absolute -top-1.5 -right-1.5 ${doc.check} rounded-full p-0.5 border-2 border-[#060F1A]`}
            >
              <CheckCircle2 size={9} className="text-white" />
            </motion.div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="flex items-center justify-center gap-2 py-3 bg-amber-500 rounded-xl text-[#0D1B2A] font-bold text-sm cursor-default"
      >
        Process with AI <ChevronRight size={15} />
      </motion.div>
    </div>
  );
}

function ExtractionStep() {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    let count = 0;
    const interval = setInterval(() => {
      count++;
      setVisibleCount(count);
      if (count >= DEMO_FIELDS.length) clearInterval(interval);
    }, 280);
    return () => clearInterval(interval);
  }, []);

  const progress = Math.round((visibleCount / DEMO_FIELDS.length) * 100);

  return (
    <div className="flex flex-col p-5 gap-4">
      <div>
        <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">
          Step 2 of 3
        </p>
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
          >
            <Cpu size={14} className="text-amber-500" />
          </motion.div>
          <span className="text-white text-base font-bold">Reading 3 documents…</span>
          <span className="ml-auto text-amber-500 font-mono text-sm font-black">{progress}%</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-amber-500 rounded-full"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.25 }}
        />
      </div>

      {/* Fields grid */}
      <div className="grid grid-cols-2 gap-2">
        {DEMO_FIELDS.map((field, idx) => (
          <AnimatePresence key={field.label}>
            {idx < visibleCount && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 min-w-0"
              >
                <div className="text-[8px] font-bold text-white/35 uppercase tracking-wider mb-0.5">
                  {field.label}
                </div>
                <div className="text-[11px] font-semibold text-white truncate">{field.value}</div>
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </div>
    </div>
  );
}

function ReportStep() {
  return (
    <div className="flex flex-col p-5 gap-4">
      <div>
        <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">
          Step 3 of 3
        </p>
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 22 }}
          className="flex items-center gap-2"
        >
          <div className="bg-green-500/20 border border-green-500/30 rounded-full p-1">
            <CheckCircle2 size={14} className="text-green-400" />
          </div>
          <span className="text-green-400 text-sm font-bold">Survey Report Generated</span>
        </motion.div>
      </div>

      {/* Report card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-white/5 border border-white/10 rounded-xl overflow-hidden"
      >
        {/* Card header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.03]">
          <div>
            <div className="text-[8px] font-black text-amber-500 uppercase tracking-widest">
              Motor Survey Report
            </div>
            <div className="text-white font-bold text-sm">CLM-2024-001234</div>
          </div>
          <span className="bg-amber-500/15 border border-amber-500/25 text-amber-400 text-[9px] font-bold px-2 py-0.5 rounded-lg">
            DRAFT
          </span>
        </div>

        {/* Card rows */}
        <div className="px-4 py-3 space-y-2.5">
          {[
            { Icon: Car, label: 'Vehicle', value: 'MH 12 AB 1234 · Swift Dzire' },
            { Icon: User, label: 'Owner', value: 'Rajesh Kumar' },
            { Icon: Hash, label: 'Assessment', value: '\u20B985,420' },
            { Icon: Calendar, label: 'Surveyor', value: 'R.S. Joshi (IRDA: 12345)' },
          ].map(({ Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3">
              <Icon size={11} className="text-white/30 shrink-0" />
              <span className="text-[10px] font-bold text-white/40 w-16 shrink-0">{label}</span>
              <span className="text-[11px] font-semibold text-white truncate">{value}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex gap-2"
      >
        <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-amber-500 rounded-xl text-[#0D1B2A] font-bold text-xs">
          <Download size={12} /> Download PDF
        </button>
        <button className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white/8 border border-white/15 rounded-xl text-white font-bold text-xs">
          <ArrowRight size={12} /> Submit
        </button>
      </motion.div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DemoSection({ onCta }: DemoSectionProps) {
  const [activeStep, setActiveStep] = useState(0);

  // Auto-advance every 4 seconds
  useEffect(() => {
    const t = setTimeout(() => {
      setActiveStep((s) => (s >= 2 ? 0 : s + 1));
    }, 4200);
    return () => clearTimeout(t);
  }, [activeStep]);

  return (
    <section
      id="demo"
      className="py-32 px-6 lg:px-12 bg-[#0D1B2A] relative overflow-hidden"
    >
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-amber-500/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/3 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* ── Header ── */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-400 mb-6"
          >
            <Zap size={11} className="fill-current" />
            LIVE DEMO
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="text-3xl md:text-5xl font-black tracking-tight text-white mb-4"
          >
            See a real claim in action
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.16 }}
            className="text-white/50 text-lg max-w-xl mx-auto"
          >
            From raw documents to a submission-ready report — the entire SurveyOS workflow in 3 steps.
          </motion.p>
        </div>

        {/* ── Demo layout ── */}
        <div className="grid lg:grid-cols-[240px_1fr_240px] gap-6 lg:gap-10 items-center">

          {/* Left: step selector */}
          <div className="hidden lg:flex flex-col gap-3">
            {STEPS.map((step, idx) => {
              const isActive = activeStep === idx;
              return (
                <button
                  key={step.id}
                  onClick={() => setActiveStep(idx)}
                  className={`flex items-center gap-3 p-4 rounded-2xl text-left transition-all duration-200 ${
                    isActive
                      ? 'bg-amber-500/10 border border-amber-500/25'
                      : 'bg-white/5 border border-white/8 hover:bg-white/10 hover:border-white/15'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isActive ? 'bg-amber-500 text-[#0D1B2A]' : 'bg-white/8 text-white/40'
                    }`}
                  >
                    <step.Icon size={17} />
                  </div>
                  <div className="min-w-0">
                    <div
                      className={`text-sm font-bold truncate transition-colors ${
                        isActive ? 'text-white' : 'text-white/40'
                      }`}
                    >
                      {step.label}
                    </div>
                    <div className="text-[10px] text-white/25 mt-0.5 truncate">{step.desc}</div>
                  </div>
                  {isActive && (
                    <motion.div
                      layoutId="activeStepIndicator"
                      className="ml-auto w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Center: app window mock */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[340px] mx-auto"
          >
            <div
              className="bg-[#060F1A] border border-white/10 rounded-2xl overflow-hidden"
              style={{ boxShadow: '0 30px 70px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)' }}
            >
              <AppWindowHeader title={`SurveyOS Prime · ${STEPS[activeStep].label}`} />

              <div style={{ minHeight: 360 }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStep}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.28, ease: 'easeInOut' }}
                  >
                    {activeStep === 0 && <UploadStep />}
                    {activeStep === 1 && <ExtractionStep />}
                    {activeStep === 2 && <ReportStep />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Mobile step dots */}
            <div className="flex justify-center gap-2 mt-5 lg:hidden">
              {STEPS.map((step, idx) => (
                <button
                  key={step.id}
                  onClick={() => setActiveStep(idx)}
                  aria-label={step.label}
                  className={`transition-all rounded-full ${
                    activeStep === idx
                      ? 'w-6 h-2 bg-amber-500'
                      : 'w-2 h-2 bg-white/20 hover:bg-white/40'
                  }`}
                />
              ))}
            </div>
          </motion.div>

          {/* Right: stats */}
          <div className="hidden lg:flex flex-col gap-3">
            {[
              { value: '8', unit: 'fields', sub: 'Auto-extracted from 3 docs' },
              { value: '<30', unit: 'sec', sub: 'End-to-end extraction time' },
              { value: '99.9', unit: '%', sub: 'Accuracy on clear scans' },
            ].map((stat, idx) => (
              <motion.div
                key={stat.sub}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white/5 border border-white/8 rounded-2xl p-4 text-right"
              >
                <div className="text-3xl font-black text-white leading-none">
                  {stat.value}
                  <span className="text-base text-amber-500 ml-1">{stat.unit}</span>
                </div>
                <div className="text-[10px] font-semibold text-white/35 mt-1.5 leading-tight">
                  {stat.sub}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-center mt-14"
        >
          <p className="text-white/30 text-xs font-semibold mb-5 uppercase tracking-widest">
            This is a simulation — the real app is even faster
          </p>
          <button
            onClick={onCta}
            className="inline-flex items-center gap-2 px-8 py-4 bg-amber-500 rounded-full text-[#0D1B2A] font-bold text-base hover:scale-105 active:scale-95 transition-transform shadow-[0_0_40px_rgba(245,158,11,0.25)]"
          >
            Try it yourself — it&apos;s free
            <ArrowRight size={18} />
          </button>
        </motion.div>
      </div>
    </section>
  );
}
