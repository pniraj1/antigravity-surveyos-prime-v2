'use client';

import { motion, AnimatePresence, useScroll, useTransform, useSpring, useMotionValueEvent } from 'framer-motion';
import { ArrowRight, Cloud, Camera, Shield, FileText, ChevronRight, Play, Zap, FileCheck2, Cpu, User, Clock, FileWarning, Lock, Database } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithGoogle } from '@/lib/firebase/auth';
import { useAuthStore } from '@/stores/auth-store';
import { Loader2 } from 'lucide-react';
import Logo from '@/components/ui/Logo';
import DemoSection from '@/components/landing/DemoSection';
import PricingSection from '@/components/landing/PricingSection';
import { logger } from '@/lib/utils/logger';

// Reusable animated container
const FadeIn = ({ children, delay = 0, className = '' }: { children: React.ReactNode, delay?: number, className?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-50px' }}
    transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    className={className}
  >
    {children}
  </motion.div>
);

// The Simulated AI Workflow Animation
function WorkflowSimulation({ activeTab, setActiveTab }: { activeTab: number, setActiveTab: (i: number) => void }) {
  const [step, setStep] = useState(0);

  // Auto-play the animation simulation loop for the active tab
  useEffect(() => {
    setStep(0); // reset step when tab changes
    const timer = setInterval(() => {
      setStep((s) => (s >= 3 ? 0 : s + 1));
    }, activeTab === 1 ? 3000 : 2500); // Tab 1 needs a slightly longer cycle
    return () => clearInterval(timer);
  }, [activeTab]);

  return (
    <div className="relative w-full max-w-4xl mx-auto mt-20 min-h-[400px] aspect-[16/10] md:aspect-[21/10] rounded-[2rem] border border-gray-200 bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col">
      {/* Mac-style Window Header & Tabs */}
      <div className="w-full border-b border-gray-100 flex flex-col bg-gray-50/50 backdrop-blur-md z-20">
        <div className="flex items-center px-4 h-10 gap-2 border-b border-gray-100/50">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
          <div className="ml-4 text-[10px] font-semibold text-gray-400 font-mono tracking-widest uppercase">SurveyOS Sandbox</div>
        </div>
        <div className="flex px-4 gap-4 pt-2">
          {["AI Document Extraction", "Minutes vs Hours", "Secure & Offline"].map((tab, idx) => (
            <button 
              key={idx}
              onClick={() => setActiveTab(idx)}
              className={`pb-3 px-2 text-sm font-bold transition-all border-b-2 ${activeTab === idx ? 'border-amber-500 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative bg-gray-50/30">
        <AnimatePresence mode="wait">
          {/* TAB 0: Realistic Document Scanning */}
          {activeTab === 0 && (
            <motion.div 
              key="tab0"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="absolute inset-0 flex items-stretch"
            >
              <div className="w-1/2 p-6 flex flex-col justify-center items-center relative border-r border-gray-100">
                <motion.div 
                  initial={false}
                  animate={{ scale: step === 0 ? 0.9 : 1, y: step === 0 ? 30 : 0, opacity: step === 0 ? 0 : 1 }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  className="w-full max-w-[280px] aspect-[1.6/1] bg-blue-50 border border-blue-200 rounded-xl shadow-lg p-3 relative overflow-hidden"
                >
                  <div className="text-center border-b border-blue-200 pb-1 mb-2">
                    <div className="text-[8px] font-bold text-blue-800 uppercase tracking-widest">Union of India</div>
                    <div className="text-[10px] font-black text-blue-900 uppercase">Driving Licence</div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-16 h-20 bg-gray-200 border border-gray-300 rounded overflow-hidden flex items-center justify-center">
                      <User size={24} className="text-gray-400"/>
                    </div>
                    <div className="flex-1 space-y-2 mt-1">
                      <div>
                        <div className="text-[6px] font-bold text-blue-800/60 uppercase">Name</div>
                        <div className={`h-2 w-3/4 rounded-sm transition-colors ${step >= 2 ? 'bg-amber-400' : 'bg-gray-800'}`}/>
                      </div>
                      <div>
                        <div className="text-[6px] font-bold text-blue-800/60 uppercase">DL Number</div>
                        <div className={`h-2 w-full rounded-sm transition-colors ${step >= 2 ? 'bg-amber-400' : 'bg-gray-800'}`}/>
                      </div>
                      <div>
                        <div className="text-[6px] font-bold text-blue-800/60 uppercase">Validity</div>
                        <div className={`h-2 w-1/2 rounded-sm transition-colors ${step >= 2 ? 'bg-amber-400' : 'bg-gray-800'}`}/>
                      </div>
                    </div>
                  </div>
                  {/* Scanning Laser */}
                  {step === 1 && (
                    <motion.div 
                      initial={{ top: 0 }} animate={{ top: "100%" }} transition={{ duration: 1.5, ease: "linear" }}
                      className="absolute left-0 w-full h-[2px] bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,1)] z-10"
                    />
                  )}
                </motion.div>
              </div>

              <div className="w-1/2 p-8 flex flex-col justify-center">
                <div className="space-y-6">
                  {[{ label: "Licence Holder", value: "RAMESH KUMAR" }, { label: "Licence No", value: "MH01 20260000000" }, { label: "Valid Till", value: "14 / 09 / 2035" }].map((field, idx) => (
                    <div key={idx} className="relative">
                      <div className="text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-1">{field.label}</div>
                      <div className="h-10 w-full bg-white border border-gray-200 rounded-lg flex items-center px-3 relative overflow-hidden">
                        <motion.div
                          initial={false}
                          animate={{ width: step >= 2 ? "100%" : "0%" }}
                          transition={{ delay: idx * 0.2 + (step === 2 ? 0 : 0), duration: 0.4 }}
                          className="absolute left-0 top-0 bottom-0 bg-amber-50/50 z-0"
                        />
                        <motion.span 
                          initial={false}
                          animate={{ opacity: step >= 2 ? 1 : 0 }}
                          transition={{ delay: idx * 0.2 + (step === 2 ? 0 : 0) }}
                          className="text-sm font-semibold text-gray-800 relative z-10"
                        >
                          {field.value}
                        </motion.span>
                      </div>
                    </div>
                  ))}
                  
                  <motion.div 
                    initial={false} animate={{ opacity: step === 3 ? 1 : 0, scale: step === 3 ? 1 : 0.9 }}
                    className="inline-flex items-center gap-2 mt-4 text-green-600 bg-green-50 px-3 py-1.5 rounded-full text-xs font-bold"
                  >
                    <FileCheck2 size={14}/> 100% Extracted
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 1: Minutes vs Hours USP */}
          {activeTab === 1 && (
            <motion.div 
              key="tab1"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="absolute inset-0 flex items-stretch"
            >
              <div className="w-1/2 p-6 flex flex-col justify-center items-center relative border-r border-red-100 bg-red-50/20">
                <div className="mb-4 text-red-500 animate-pulse"><Clock size={48} /></div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">The Old Way</h3>
                <p className="text-gray-500 text-sm text-center mb-6 max-w-[200px]">Manual physical verification & Excel data entry.</p>
                <div className="bg-red-100 border border-red-200 text-red-800 px-4 py-2 rounded-lg font-mono font-bold text-lg">
                  2 HOURS 30 MIN
                </div>
              </div>
              <div className="w-1/2 p-6 flex flex-col justify-center items-center bg-amber-50/30">
                <div className="relative mb-4">
                  <motion.div 
                    animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="text-amber-500"
                  >
                    <Cpu size={48} />
                  </motion.div>
                  {step >= 2 && (
                    <motion.div 
                      initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="absolute -bottom-2 -right-2 bg-green-500 text-white rounded-full p-1 border-2 border-white"
                    >
                      <FileCheck2 size={16}/>
                    </motion.div>
                  )}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">SurveyOS Prime</h3>
                <p className="text-gray-500 text-sm text-center mb-6 max-w-[220px]">AI verification & Instant beautifully formatted PDFs.</p>
                
                <div className="w-full max-w-[200px] h-3 bg-gray-200 rounded-full overflow-hidden mb-3">
                  <motion.div 
                    initial={{ width: "0%" }}
                    animate={{ width: step >= 1 ? "100%" : "0%" }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="h-full bg-amber-500"
                  />
                </div>

                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: step >= 2 ? 1 : 0, y: step >= 2 ? 0 : 10 }}
                  className="bg-green-100 border border-green-200 text-green-800 px-4 py-2 rounded-lg font-mono font-bold text-lg"
                >
                  10 MINUTES 00 SEC
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: Secure & Offline */}
          {activeTab === 2 && (
            <motion.div 
              key="tab2"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="absolute inset-0 flex flex-col justify-center items-center p-8 text-center"
            >
              <div className="flex items-center justify-center gap-6 mb-8 w-full max-w-lg">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-white border border-gray-200 rounded-2xl flex items-center justify-center shadow-sm">
                    <FileText size={32} className="text-gray-700"/>
                  </div>
                  <span className="text-xs font-bold text-gray-500 mt-2 uppercase">Local Device</span>
                </div>

                <div className="flex-1 flex flex-col items-center relative">
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0.5 }} animate={{ scale: 1.1, opacity: 1 }} transition={{ repeat: Infinity, duration: 1.5, repeatType: "reverse" }}
                    className="text-emerald-500 bg-emerald-50 p-2 rounded-full absolute -top-8 z-20 shadow-md border border-emerald-100"
                  >
                    <Lock size={20}/>
                  </motion.div>
                  <div className="w-full h-[2px] bg-emerald-200 relative overflow-hidden">
                    <motion.div 
                      initial={{ left: "-100%" }} animate={{ left: "100%" }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="w-1/2 h-full bg-emerald-500 absolute top-0"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 mt-2 tracking-widest uppercase">E2E Encrypted</span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-white border border-gray-200 rounded-2xl flex items-center justify-center shadow-sm relative">
                    <Cloud size={32} className="text-blue-500"/>
                    <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full w-5 h-5 flex items-center justify-center border-2 border-white">
                      <Shield size={10} className="text-white"/>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-gray-500 mt-2 uppercase">Google Drive</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 bg-red-50 border border-red-100 text-red-800 px-5 py-3 rounded-xl mt-4 max-w-md w-full">
                <Database size={20} className="opacity-50"/>
                <div className="h-full w-[1px] bg-red-200"/>
                <span className="text-sm font-semibold">A secured environment.<br/>Your files stay in your Drive.</span>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}

// The scroll-driven wrapper for the simulation
function StickySimulation() {
  const targetRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start start", "end end"]
  });

  const [tabIndex, setTabIndex] = useState(0);
  
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    let newTab = 0;
    if (latest > 0.66) newTab = 2;
    else if (latest > 0.33) newTab = 1;
    
    if (newTab !== tabIndex) {
      setTabIndex(newTab);
    }
  });

  return (
    <div ref={targetRef} className="h-full w-full relative">
      <div className="sticky top-16 h-[calc(100vh-64px)] flex flex-col justify-center items-center px-6 overflow-hidden">
        <div className="max-w-4xl w-full mb-12 text-center">
          <motion.div
            key={tabIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              {tabIndex === 0 && "Extract Data Instantly"}
              {tabIndex === 1 && "Draft Reports in Seconds"}
              {tabIndex === 2 && "Secure, Private, Professional"}
            </h2>
            <p className="text-gray-500 text-lg">
              {tabIndex === 0 && "Our AI engine identifies every field on a physical document with 99.9% accuracy."}
              {tabIndex === 1 && "What takes 2 hours manually now happens in under 10 minutes."}
              {tabIndex === 2 && "Everything stays inside your private Google Drive. We don't store your data."}
            </p>
          </motion.div>
        </div>
        
        <div className="w-full">
          <WorkflowSimulation activeTab={tabIndex} setActiveTab={setTabIndex} />
        </div>
      </div>
    </div>
  );
}

export default function LandingClient() {
  const { isAuthenticated, loading: authLoading } = useAuthStore();
  const [signingIn, setSigningIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      router.replace('/dashboard/');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleAction = async () => {
    if (isAuthenticated) {
      router.push('/dashboard/');
      return;
    }
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      logger.error("Sign in failed", error);
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] selection:bg-amber-500/20 font-sans">
      {/* ── Navigation ── */}
      <nav className="relative z-50 flex items-center justify-between px-6 lg:px-12 py-4 bg-white/70 backdrop-blur-xl border-b border-gray-200/50 sticky top-0">
        <Logo variant="light" size="md" />
        <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-gray-500">
          <a href="#features" className="hover:text-amber-600 transition-colors">Features</a>
          <a href="#how" className="hover:text-amber-600 transition-colors">How it works</a>
          <a href="#pricing" className="hover:text-amber-600 transition-colors">Pricing</a>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleAction}
            className="hidden sm:block text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
          >
            {isAuthenticated ? 'Dashboard' : 'Login'}
          </button>
          <button 
            onClick={handleAction}
            disabled={signingIn}
            className="group relative inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-gray-900 rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-lg disabled:opacity-50"
          >
            {signingIn ? <Loader2 size={16} className="animate-spin" /> : <span className="relative z-10">{isAuthenticated ? 'Go to App' : 'Launch App'}</span>}
            {!signingIn && <ArrowRight size={16} className="relative z-10 transition-transform group-hover:translate-x-1" />}
          </button>
        </div>
      </nav>

      <main className="relative z-10">
        {/* ── Hero Section ── */}
        <section className="pt-28 pb-32 px-6 lg:px-12 flex flex-col items-center text-center relative">
          <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-amber-100/50 rounded-full blur-[100px] pointer-events-none -z-10" />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: "easeOut" }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700 mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            INTRODUCING SURVEYOS PRIME
          </motion.div>

          <FadeIn delay={0.1} className="max-w-5xl mx-auto">
            <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-black tracking-tighter leading-[1.05] mb-6 text-gray-900">
              Motor surveying,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600">powered by AI.</span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.2} className="max-w-2xl mx-auto mb-10">
            <p className="text-lg md:text-xl text-gray-500 font-medium leading-relaxed">
              Why spend hours verifying physical documents manually? SurveyOS Prime automatically extracts data from RC, DL, and Policies, and drafts final reports in minutes.
            </p>
          </FadeIn>

          <FadeIn delay={0.3} className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <button 
              onClick={handleAction}
              disabled={signingIn}
              className="w-full sm:w-auto group relative inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold text-white bg-amber-500 rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-xl shadow-amber-500/20 hover:shadow-amber-500/40 disabled:opacity-50"
            >
              {signingIn ? <Loader2 size={20} className="animate-spin" /> : (isAuthenticated ? "Enter Dashboard" : "Start Free Trial")}
              {!signingIn && <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />}
            </button>
            <button
              onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 text-base font-bold text-gray-700 bg-white border border-gray-200 shadow-sm rounded-full hover:bg-gray-50 transition-all"
            >
              <Play size={18} className="text-amber-500" />
              Watch Demo
            </button>
          </FadeIn>

          {/* Simulation removed from here to follow metrics section */}
        </section>

        {/* ── Sticky Scroll Guided Tour ── */}
        <section className="relative h-[250vh]" id="how">
          <StickySimulation />
        </section>

        {/* ── Scroll Triggered Metrics ── */}
        <section className="py-24 border-y border-gray-100 bg-white relative z-10">
          <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100 text-center">
            <FadeIn delay={0.1} className="py-8 md:py-0">
              <div className="text-5xl font-black text-gray-900 mb-2">10 <span className="text-2xl text-amber-500">mins</span></div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Average Report Time</p>
              <p className="text-xs text-gray-400 mt-2">Down from 2+ hours manually</p>
            </FadeIn>
            <FadeIn delay={0.2} className="py-8 md:py-0">
              <div className="text-5xl font-black text-gray-900 mb-2">80 <span className="text-2xl text-blue-500">KB</span></div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Pristine Images</p>
              <p className="text-xs text-gray-400 mt-2">5MB images auto-compressed</p>
            </FadeIn>
            <FadeIn delay={0.3} className="py-8 md:py-0">
              <div className="text-5xl font-black text-gray-900 mb-2">0 <span className="text-2xl text-green-500">Breaches</span></div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Data Secured</p>
              <p className="text-xs text-gray-400 mt-2">Zero 3rd party databases used</p>
            </FadeIn>
          </div>
        </section>

        {/* ── Features Section ── */}
        <section id="features" className="py-32 px-6 lg:px-12 bg-gray-50/50 border-b border-gray-100 relative">
          <div className="max-w-7xl mx-auto">
            <FadeIn>
              <div className="text-center mb-20 max-w-2xl mx-auto">
                <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-gray-900">Built for the field.<br/>Designed for speed.</h2>
                <p className="text-gray-500 text-lg">Everything you need to process claims from the garage or your desk, without the usual paperwork nightmare.</p>
              </div>
            </FadeIn>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: <FileText size={24}/>, color: "text-amber-600", bg: "bg-amber-100", title: "AI Document Reading", desc: "Instantly reads Registration Certificates, Driving Licences, and Policies. 99.9% accuracy on clear scans, fills forms automatically." },
                { icon: <Camera size={24}/>, color: "text-blue-600", bg: "bg-blue-100", title: "Smart Photo Engine", desc: "Upload heavy damage photos directly. SurveyOS compresses them instantly and maps them to a beautiful PDF layout." },
                { icon: <Cloud size={24}/>, color: "text-emerald-600", bg: "bg-emerald-100", title: "Auto Drive Sync", desc: "As you work, files are silently pushed to your Google Drive in the background. Never manually organize folders again." },
                { icon: <Cpu size={24}/>, color: "text-purple-600", bg: "bg-purple-100", title: "AI Cross-Checking", desc: "Spots conflicts between driving licences and policies instantly, highlighting exactly where details don't match." },
                { icon: <Shield size={24}/>, color: "text-rose-600", bg: "bg-rose-100", title: "Offline First", desc: "Working in a garage with no signal? SurveyOS caches everything securely and syncs exactly when you reconnect." },
                { icon: <Zap size={24}/>, color: "text-gray-700", bg: "bg-gray-100", title: "Lightning Fast", desc: "Built on ultra-modern web technology. Zero load times, pure native-like performance on any device." }
              ].map((feature, idx) => (
                <FadeIn key={idx} delay={idx * 0.1}>
                  <div className="p-8 rounded-3xl bg-white border border-gray-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 shadow-sm ${feature.bg} ${feature.color}`}>
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-gray-900">{feature.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed font-medium">{feature.desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── Demo Section ── */}
        <DemoSection onCta={handleAction} />

        {/* ── Pricing Section ── */}
        <PricingSection onCta={handleAction} />

        {/* ── Call to Action ── */}
        <section className="py-32 px-6 lg:px-12 text-center relative overflow-hidden bg-[#05050A] text-white">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-amber-900/20 pointer-events-none" />
          <FadeIn className="relative z-10 max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-8">Ready to revolutionize your workflow?</h2>
            <p className="text-xl text-gray-400 mb-10">Deliver superior assessments in record time.</p>
            <button 
              onClick={handleAction}
              disabled={signingIn}
              className="inline-flex items-center justify-center gap-2 px-10 py-5 text-lg font-bold text-gray-900 bg-amber-500 rounded-full hover:scale-105 transition-transform shadow-[0_0_50px_rgba(245,158,11,0.3)] disabled:opacity-50"
            >
              {signingIn ? <Loader2 size={24} className="animate-spin" /> : "Open SurveyOS Prime"}
              {!signingIn && <ArrowRight size={20} />}
            </button>
          </FadeIn>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="py-12 px-6 border-t border-gray-800 relative z-10 bg-[#05050A]">
        <div className="max-w-6xl mx-auto">
          <Logo variant="dark" size="sm" className="justify-center mb-6" />
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-gray-400 mb-5">
            <Link href="/privacy" className="hover:text-amber-400 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-amber-400 transition-colors">Terms of Service</Link>
            <Link href="/refund" className="hover:text-amber-400 transition-colors">Refund Policy</Link>
            <Link href="/contact" className="hover:text-amber-400 transition-colors">Contact</Link>
          </div>
          <p className="text-center text-sm text-gray-500">
            © {new Date().getFullYear()} SurveyOS Prime. Engineered for Surveyors.
          </p>
        </div>
      </footer>
    </div>
  );
}
