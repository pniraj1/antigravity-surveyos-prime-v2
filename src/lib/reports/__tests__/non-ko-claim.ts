import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

const row = (o: Partial<AssessmentRow>) => ({
  particulars: 'Item', estimated: 10000, assessed: 10000, partType: 'metal', gst: 18, section: 'parts',
  allowed: true, isDisposal: false, disposalPercent: 50, ...o,
}) as AssessmentRow;

/** Non-TL claim, no K.O. rows: fixture input for the byte-identical regression test. */
export function nonKoClaim(): ClaimData {
  return {
    id: 'c1', depreciationType: 'standard',
    assessmentRows: [row({ id: 'a', particulars: 'Bumper', assessed: 8000 }), row({ id: 'b', particulars: 'Rejected Lamp', assessed: 0, allowed: false }),
      row({ id: 'c', particulars: 'Denting', section: 'labour', estimated: 3000, assessed: 3000 })],
    vehicle: { registrationNumber: 'MH12AB1234', dateOfRegistration: '2024-08-05', yearOfManufacture: 2024 },
    policy: { idv: '500000' }, accident: { dateAndTime: '2026-08-05T10:00' }, driver: {}, spotDetails: {}, reinspection: {},
    feeBill: { salvageValue: 100, billSalvage: 100, compulsoryExcess: 1000, voluntaryExcess: 500, travelExpenses: 0 },
    billCheck: { billNo: 'B1', billDate: '2026-08-01', billTotal: 11800 },
    isTotalLoss: false,
  } as unknown as ClaimData;
}
