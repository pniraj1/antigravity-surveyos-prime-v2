'use client';

import { Clock } from 'lucide-react';

/**
 * PendingApprovalBanner
 * Sticky top banner shown on the dashboard when the user's registration
 * is submitted but not yet approved by the admin.
 * Disappears automatically when AuthGate detects status = 'approved' via onSnapshot.
 */
export function PendingApprovalBanner() {
  return (
    <div
      className="w-full flex items-center justify-center gap-3 px-4 py-3 text-xs font-bold"
      style={{
        background: 'linear-gradient(90deg, rgba(212,175,55,0.15), rgba(212,175,55,0.08))',
        borderBottom: '1px solid rgba(212,175,55,0.3)',
        color: '#0D1B2A',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <Clock size={14} style={{ color: '#D4AF37', flexShrink: 0 }} />
      <span style={{ color: '#7a6010' }}>
        <strong>Your account is under review.</strong>
        {' '}You can explore the app, but actions are locked until the admin approves your registration.
        Typical approval time: 1–2 business days.
      </span>
    </div>
  );
}
