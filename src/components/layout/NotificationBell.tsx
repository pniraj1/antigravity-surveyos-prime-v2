'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, ExternalLink, BellRing, Megaphone } from 'lucide-react';
import { useProfileStore } from '@/stores/profile-store';
import { useUIStore } from '@/stores/ui-store';
import { loadAnnouncements, countUnread, sanitizeLink, type Announcement } from '@/lib/config/announcements';
import { loadFeeSchedule, type FeeSchedule } from '@/lib/config/fee-schedule';
import { schedulePromptNeeded } from '@/lib/config/fee-schedule-adopt';

export function NotificationBell() {
  const { profile, updateProfile } = useProfileStore();
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Announcement[]>([]);
  const [globalSchedule, setGlobalSchedule] = useState<FeeSchedule | null>(null);

  useEffect(() => {
    loadAnnouncements().then(setItems);
    loadFeeSchedule().then(setGlobalSchedule);
  }, []);

  const schedulePrompt = schedulePromptNeeded(profile.feeSchedule, profile.feeScheduleAckVersion, globalSchedule?.version ?? null);
  const unreadAnnouncements = useMemo(() => countUnread(items, profile.notificationsLastSeen), [items, profile.notificationsLastSeen]);
  const badge = unreadAnnouncements + (schedulePrompt ? 1 : 0);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unreadAnnouncements > 0) updateProfile({ notificationsLastSeen: Date.now() });
  };

  const adoptGlobal = () => { if (globalSchedule) updateProfile({ feeSchedule: { ...globalSchedule }, feeScheduleAckVersion: globalSchedule.version }); };
  const keepMine = () => { if (globalSchedule) updateProfile({ feeScheduleAckVersion: globalSchedule.version }); };

  return (
    <div className="relative">
      <button onClick={toggle} title="Notifications" className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-900)]" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
        <Bell size={16} />
        {badge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 flex items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: 'var(--color-status-danger)' }}>
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-2 w-[300px] max-h-[60vh] overflow-y-auto rounded-xl shadow-xl z-50 bg-white border border-[var(--color-neutral-200)]">
            <div className="px-4 py-3 border-b border-[var(--color-neutral-100)] text-xs font-medium uppercase tracking-wider text-[var(--color-neutral-400)]">Notifications</div>

            {schedulePrompt && (
              <div className="px-4 py-3 border-b border-[var(--color-neutral-100)]" style={{ background: 'var(--color-status-warning-tint)' }}>
                <div className="flex items-center gap-2 mb-1"><BellRing size={13} style={{ color: 'var(--color-status-warning)' }} /><span className="text-xs font-medium text-[var(--color-neutral-900)]">IISLA schedule updated</span></div>
                <p className="text-[11px] text-[var(--color-neutral-600)] mb-2">Admin updated the fee schedule to {globalSchedule?.version}. Adopt the new slabs or keep your custom card.</p>
                <div className="flex gap-2">
                  <button onClick={adoptGlobal} className="px-2.5 py-1 rounded-md text-[11px] font-medium text-white" style={{ background: 'var(--color-primary)', border: 'none', cursor: 'pointer' }}>Adopt</button>
                  <button onClick={keepMine} className="px-2.5 py-1 rounded-md text-[11px] font-medium" style={{ background: 'var(--color-neutral-100)', border: 'none', cursor: 'pointer' }}>Keep mine</button>
                  <button onClick={() => { setActiveTab('profile'); setOpen(false); }} className="ml-auto px-2.5 py-1 rounded-md text-[11px] text-primary" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Open Profile</button>
                </div>
              </div>
            )}

            {items.length === 0 && !schedulePrompt && (
              <div className="px-4 py-8 text-center text-xs text-[var(--color-neutral-400)]">No notifications yet.</div>
            )}

            {items.map((a) => {
              const link = sanitizeLink(a.link);
              const isUnread = a.createdAt > (profile.notificationsLastSeen ?? 0);
              return (
                <div key={a.id} className="px-4 py-3 border-b border-[var(--color-neutral-100)]" style={{ background: isUnread ? 'var(--color-neutral-50)' : 'transparent' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Megaphone size={12} className="text-primary" />
                    <span className="text-xs font-medium text-[var(--color-neutral-900)]">{a.title}</span>
                    <span className="ml-auto text-[9px] uppercase tracking-wider text-[var(--color-neutral-400)]">{a.type}</span>
                  </div>
                  <p className="text-[11px] text-[var(--color-neutral-600)] whitespace-pre-wrap">{a.body}</p>
                  {link && (
                    <a href={link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary">
                      Open link <ExternalLink size={10} />
                    </a>
                  )}
                  <div className="mt-1 text-[9px] text-[var(--color-neutral-400)]">{new Date(a.createdAt).toLocaleDateString()}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
