'use client';

import { ChevronRight, Camera } from 'lucide-react';
import type { ChecklistItem } from '@/lib/site/site-checklist';

interface Props {
  title: string;
  items: ChecklistItem[];
  onPick: (item: ChecklistItem) => void;
}

export function SiteChecklistCard({ title, items, onPick }: Props) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onPick(item)}
            className="flex w-full min-h-[48px] items-center justify-between gap-3 px-3 text-left text-sm"
          >
            <span>{item.label}</span>
            <span className="flex items-center gap-2 text-muted-foreground">
              {item.value && <span className="font-medium text-foreground">{item.value}</span>}
              {item.target === 'camera' ? <Camera size={16} /> : <ChevronRight size={16} />}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
