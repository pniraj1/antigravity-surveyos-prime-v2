'use client';
import { motion } from 'framer-motion';
import { FileText, Camera, Cloud, Cpu, Shield, Zap } from 'lucide-react';
import { HeroHighlight } from '@/components/ui/hero-highlight';

const LARGE = [
  {
    icon: FileText,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    title: 'AI Document Reading',
    desc: 'Instantly reads RC Books, Driving Licences, and Insurance Policies. 99.9% accuracy on clear scans — no manual data entry.',
    badge: '99.9% accuracy',
    badgeColor: 'bg-amber-500/15 text-amber-600 border-amber-500/20',
  },
  {
    icon: Camera,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    title: 'Smart Photo Engine',
    desc: 'Upload heavy damage photos directly. SurveyOS compresses them from 5MB to 80KB and maps them to a beautiful PDF layout automatically.',
    badge: '5MB → 80KB',
    badgeColor: 'bg-blue-500/15 text-blue-600 border-blue-500/20',
  },
];

const SMALL = [
  { icon: Cloud,  color: 'text-emerald-500', bg: 'bg-emerald-500/10', title: 'Auto Drive Sync',    desc: 'Silently pushed to Google Drive as you work.' },
  { icon: Cpu,    color: 'text-purple-500',  bg: 'bg-purple-500/10',  title: 'AI Cross-Checking', desc: 'Spots conflicts between documents instantly.' },
  { icon: Shield, color: 'text-rose-500',    bg: 'bg-rose-500/10',    title: 'Offline First',     desc: 'Caches securely, syncs when reconnected.' },
  { icon: Zap,    color: 'text-gray-700',    bg: 'bg-gray-100',       title: 'Lightning Fast',    desc: 'Zero load times, native-like performance.' },
];

export function BentoFeatures() {
  return (
    <HeroHighlight className="py-32 px-6 lg:px-12 bg-gray-50/80 border-b border-gray-100">
      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-gray-900 mb-4">
            Built for the field.<br />Designed for speed.
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Everything you need to process claims from the garage or your desk.
          </p>
        </motion.div>

        {/* Large cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {LARGE.map((card, idx) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ scale: 1.02, y: -4 }}
              className="bg-white border border-gray-200 rounded-3xl p-8 flex flex-col gap-5 shadow-sm hover:shadow-xl transition-shadow duration-300 cursor-default"
            >
              <div className="flex items-start justify-between">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${card.bg} ${card.color}`}>
                  <card.icon size={24} />
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${card.badgeColor}`}>
                  {card.badge}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 mb-2">{card.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{card.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Small cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {SMALL.map((card, idx) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + idx * 0.08 }}
              whileHover={{ scale: 1.03, y: -2 }}
              className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow duration-300 cursor-default"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.bg} ${card.color}`}>
                <card.icon size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-gray-900 mb-1">{card.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{card.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </HeroHighlight>
  );
}
