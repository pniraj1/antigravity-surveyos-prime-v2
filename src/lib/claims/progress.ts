import type { ClaimData, PrintedKind } from '@/types/claim';
import type { SurveyType } from '@/types/report';
import type { AppTab } from '@/stores/ui-store';

export type { PrintedKind } from '@/types/claim';
export type StepStatus = 'done' | 'waiting' | 'optional' | 'na';
export interface StepResult { id: string; label: string; tab: AppTab | null; status: StepStatus; at?: string }
export interface ClaimProgress { steps: StepResult[]; done: number; total: number; next: StepResult | null; since?: string }

interface Eval { status: StepStatus; at?: string }
interface StepDef { id: string; label: string; tab: AppTab | null; eval: (c: ClaimData) => Eval }

const flag = (ok: boolean, at?: string): Eval => (ok ? { status: 'done', at } : { status: 'waiting' });
const docsOf = (c: ClaimData, type: string) => Object.values(c.documents ?? {}).filter((d) => d.type === type);
const earliest = (times: string[]): string | undefined => (times.length ? [...times].sort()[0] : undefined);
const printed = (id: string, label: string, tab: AppTab, kind: PrintedKind): StepDef => ({
  id, label, tab, eval: (c) => flag(!!c.printedAt?.[kind], c.printedAt?.[kind]),
});

/** True for claims completed through the old dashboard toggle (isCompleted) or the header (completedAt). */
export const isClaimCompleted = (c: Pick<ClaimData, 'completedAt' | 'isCompleted'>): boolean =>
  !!c.completedAt || !!c.isCompleted;

const DOC_IDS = ['rc', 'dl', 'permit', 'loadChallan', 'fitness', 'fireReport', 'fir'] as const;
const docs: StepDef = {
  id: 'docs', label: 'Documents verified', tab: 'details',
  eval: (c) => flag(DOC_IDS.every((k) => { const s = c.documentVerification?.[k]?.status; return s === 'YES' || s === 'N.A.'; })),
};
const photoSheet = printed('photoSheet', 'Photo sheet printed', 'photos', 'photoSheet');
const feeBill = printed('feeBill', 'Fee bill printed', 'fees', 'feeBill');
const couriered: StepDef = { id: 'couriered', label: 'Couriered', tab: null, eval: (c) => flag(!!c.courieredAt, c.courieredAt) };
const portal: StepDef = { id: 'portal', label: 'Uploaded to portal', tab: null, eval: (c) => flag(!!c.portalUploadedAt, c.portalUploadedAt) };
const fee: StepDef = { id: 'fee', label: 'Fee received', tab: 'fees', eval: (c) => flag(!!c.feeBill?.feePaid, c.feeBill?.paymentDate) };
const tail = [couriered, portal, fee];

const STEPS: Record<SurveyType, StepDef[]> = {
  final: [
    docs,
    {
      id: 'estimate', label: 'Estimate received', tab: 'documents',
      eval: (c) => {
        const at = docsOf(c, 'estimate').map((d) => d.addedAt);
        return flag(at.length > 0 || (c.assessmentRows?.length ?? 0) > 0, earliest(at));
      },
    },
    printed('surveyPrinted', 'Survey report printed', 'reports', 'surveyReport'),
    {
      id: 'bill', label: 'Bill received', tab: 'bill-check',
      eval: (c) => {
        const at = docsOf(c, 'invoice').map((d) => d.addedAt);
        return flag(at.length > 0 || (c.billCheck?.billTotal ?? 0) > 0, earliest(at));
      },
    },
    {
      id: 'billChecked', label: 'Bill checked', tab: 'bill-check',
      eval: (c) => flag(!!c.billCheck?.verifiedBySurveyor, c.billCheck?.verifiedAt),
    },
    {
      id: 'reinspection', label: 'Reinspection', tab: 'reinspection',
      eval: (c) => {
        if (!c.reinspectionNeeded) return { status: 'optional' };
        return flag(!!c.printedAt?.reinspectionReport, c.printedAt?.reinspectionReport);
      },
    },
    printed('billCheckPrinted', 'Bill check report printed', 'reports', 'billCheckReport'),
    photoSheet,
    feeBill,
    {
      id: 'portalReady', label: 'Portal files ready', tab: 'documents',
      eval: (c) => {
        if (!c.uploadSet) return { status: 'na' };
        const boxes = Object.values(c.uploadSet.boxes ?? {}).filter((b) => b.written !== false);
        const ok = boxes.length > 0 && boxes.every((b) => b.reviewedAt && !b.stale);
        const at = boxes.map((b) => b.reviewedAt ?? '').sort().pop() || undefined;
        return flag(ok, at);
      },
    },
    ...tail,
  ],
  spot: [
    docs,
    { id: 'spotFindings', label: 'Spot findings', tab: 'details', eval: (c) => flag((c.spotDamageRows?.length ?? 0) > 0) },
    {
      id: 'spotPhotos', label: 'Spot photos', tab: 'photos',
      eval: (c) => flag((c.photos ?? []).some((p) => p.tag === 'spot') || docsOf(c, 'spotPhotos').length > 0),
    },
    printed('spotPrinted', 'Spot report printed', 'reports', 'spotReport'),
    photoSheet,
    feeBill,
    ...tail,
  ],
  valuation: [
    {
      id: 'inspection', label: 'Inspection recorded', tab: 'valuation',
      eval: (c) => flag(!!c.valuationDetails?.inspectionDate),
    },
    { id: 'valPhotos', label: 'Photos', tab: 'photos', eval: (c) => flag((c.photos ?? []).some((p) => p.kind !== 'document')) },
    printed('valPrinted', 'Valuation report printed', 'reports', 'valuationReport'),
    photoSheet,
    feeBill,
    ...tail,
  ],
};

const counted = (s: StepResult) => s.status !== 'optional' && s.status !== 'na';

export function claimProgress(claim: ClaimData): ClaimProgress {
  const steps: StepResult[] = (STEPS[claim.surveyType] ?? STEPS.final).map(({ id, label, tab, eval: ev }) => ({ id, label, tab, ...ev(claim) }));
  const real = steps.filter(counted);
  const doneSteps = steps.filter((s) => s.status === 'done');
  return {
    steps,
    done: doneSteps.length,
    total: real.length,
    next: isClaimCompleted(claim) ? null : (steps.find((s) => s.status === 'waiting') ?? null),
    since: doneSteps.filter((s) => s.at).pop()?.at,
  };
}

export function tabMarks(p: ClaimProgress): Partial<Record<AppTab, 'done' | 'next'>> {
  const marks: Partial<Record<AppTab, 'done' | 'next'>> = {};
  const tabs = new Set(p.steps.map((s) => s.tab).filter((t): t is AppTab => t !== null));
  for (const tab of tabs) {
    if (p.next?.tab === tab) marks[tab] = 'next';
    else {
      const own = p.steps.filter((s) => s.tab === tab);
      if (own.some((s) => s.status === 'done') && !own.some((s) => s.status === 'waiting')) marks[tab] = 'done';
    }
  }
  return marks;
}
