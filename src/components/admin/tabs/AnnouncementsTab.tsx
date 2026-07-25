'use client';

import { useEffect, useState } from 'react';
import { Send, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  loadAnnouncements, saveAnnouncement, deleteAnnouncement,
  type Announcement, type AnnouncementType,
} from '@/lib/config/announcements';

export function AnnouncementsTab({ adminName }: { adminName: string }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<AnnouncementType>('update');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = () => loadAnnouncements().then(setItems);
  useEffect(() => { refresh(); }, []);

  async function post() {
    if (!title.trim() || !body.trim()) { toast.error('Title and body are required.'); return; }
    setBusy(true);
    try {
      await saveAnnouncement({ title: title.trim(), body: body.trim(), type, link: link.trim() || undefined, createdBy: adminName });
      setTitle(''); setBody(''); setLink(''); setType('update');
      toast.success('Announcement posted to all surveyors.');
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      toast.error(`Post failed: ${msg}`);
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    try { await deleteAnnouncement(id); await refresh(); }
    catch { toast.error('Delete failed.'); }
  }

  const input: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-neutral-200)', background: 'var(--color-neutral-50)', fontSize: 13 };

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Post an announcement</h3>
        <input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} style={input} />
        <textarea placeholder="Body (plain text)" value={body} onChange={e => setBody(e.target.value)} rows={3} style={{ ...input, resize: 'vertical' }} />
        <div className="flex gap-3">
          <select value={type} onChange={e => setType(e.target.value as AnnouncementType)} style={{ ...input, width: 140 }}>
            <option value="update">Update</option>
            <option value="blog">Blog</option>
            <option value="general">General</option>
          </select>
          <input placeholder="Link (optional, https://…)" value={link} onChange={e => setLink(e.target.value)} style={input} />
        </div>
        <button onClick={post} disabled={busy} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium" style={{ background: 'var(--color-primary)', color: 'var(--color-neutral-50)', border: 'none', cursor: busy ? 'wait' : 'pointer' }}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Post to all surveyors
        </button>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Recent ({items.length})</h4>
        {items.map(a => (
          <div key={a.id} className="flex items-start gap-3 px-4 py-3 rounded-lg border border-border">
            <div className="flex-1">
              <div className="flex items-center gap-2"><span className="text-sm font-medium">{a.title}</span><span className="text-[9px] uppercase tracking-wider text-muted-foreground">{a.type}</span></div>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{a.body}</p>
              <div className="text-[10px] text-muted-foreground mt-1">{new Date(a.createdAt).toLocaleString()} · {a.createdBy}</div>
            </div>
            <button onClick={() => remove(a.id)} className="text-[var(--color-status-danger)]" style={{ background: 'none', border: 'none', cursor: 'pointer' }} title="Delete"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
