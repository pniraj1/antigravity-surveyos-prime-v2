'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Eye } from 'lucide-react';

/**
 * One Claim Details section, one source document. Fields flow in a grid on
 * the left; date fields always sit in a narrow column on the right so every
 * date on the page lines up down the same edge. Narrow cards stack the dates
 * under the fields.
 *
 * Wide fields inside `children` may use `@md:col-span-2` or `col-span-full`;
 * the field grid never has more than 3 columns.
 */
export function DocSection({ title, action, dates, footer, children }: {
  title: string;
  action?: React.ReactNode;
  dates?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-lg">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="@container">
        <div className="flex flex-col @2xl:flex-row gap-4 @2xl:gap-6">
          {children && (
            <div className={`flex-1 min-w-0 grid grid-cols-1 @md:grid-cols-2 ${dates ? '@4xl:grid-cols-3' : '@2xl:grid-cols-3'} gap-4 content-start`}>
              {children}
            </div>
          )}
          {dates && (
            <div data-dates className="grid grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-1 @2xl:w-64shrink-0 gap-4 content-start border-t pt-4 @2xl:border-t-0 @2xl:pt-0 @2xl:border-l @2xl:pl-6">
              {dates}
            </div>
          )}
        </div>
        {footer}
      </CardContent>
    </Card>
  );
}

export function EvidenceDot({ has }: { has: boolean }) {
  if (!has) return null;
  return <span title="Click field to view source document"><Eye size={10} className="inline ml-1 opacity-50 text-primary" /></span>;
}

/** Red border on an empty field. Only for the core fields a report cannot go out without. */
export const req = (v: unknown) => (!v ? 'border-red-400' : '');

export const selectCls = 'flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm';
