import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SpotPrintReport } from '@/components/print/SpotPrintReport';
import { buildStandardFinalSurveyHTML } from '@/lib/reports/standard-report-builder';
import type { ClaimData, SurveyorProfile } from '@/types';

/**
 * A surveyor reported a long sentence squeezed into a quarter-width cell while
 * the two cells beside it were empty. These tests pin both halves of the fix:
 * no row may end in empty cells, and the fields that routinely hold prose must
 * span the table rather than wrap in one column.
 *
 * Fields that are usually short — Police Station, Licence Classes, H.P.A.,
 * Issuing Authority, Pre-Accident Condition — are deliberately left paired.
 * Giving each its own row costs more vertical space than it saves.
 */

const LONG = 'The subject IV was carrying 36 no. of passengers from Mumbai to Indore.';

function claim(vehicleType: string): ClaimData {
  return {
    id: 'c1', vehicleType, surveyType: 'spot', assessmentRows: [], spotDamageRows: [],
    depreciationType: 'standard',
    vehicle: { registrationNumber: 'MH12AB1234' },
    policy: { appointingOffice: LONG },
    driver: {},
    accident: {
      dateAndTime: '2026-06-24T10:00',
      placeOfAccident: LONG,
      placeOfSurvey: LONG,
      thirdPartyDetails: LONG,
    },
    spotDetails: {
      loadDesc: LONG, areaOfOperation: LONG, natureOfPermit: LONG,
      permitNo: 'PMT/1', permitType: 'National', challanNo: 'CN/1',
      actualLoad: 12400, loadOrigin: 'Mumbai', loadDest: 'Indore',
      gvw: 23500, ulw: 10100, loadCapacity: 13400,
    },
    documentVerification: {},
    feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
    billCheck: {}, reinspection: {},
  } as unknown as ClaimData;
}

const profile = { name: 'S' } as SurveyorProfile;

const spot = (vt: string) =>
  renderToStaticMarkup(<SpotPrintReport claim={claim(vt)} profile={profile} />);
const standard = (vt: string) => buildStandardFinalSurveyHTML(claim(vt), profile);

interface Cell { span: number; txt: string }

function rows(html: string): Cell[][] {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
    .map((tr) =>
      [...tr[1].matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)].map((c) => ({
        span: Number(/colspan="(\d+)"/i.exec(c[1])?.[1] ?? 1),
        txt: c[2].replace(/<[^>]+>/g, '').trim(),
      })),
    )
    .filter((cells) => cells.length > 0);
}

/** A row whose last two cells are both empty is wasting half its width. */
function rowsWithEmptyTail(html: string): string[] {
  return rows(html)
    .filter((cells) => cells.length >= 4 && cells.slice(-2).every((c) => c.txt === ''))
    .map((cells) => cells[0].txt || '(unlabelled)');
}

/** Cells holding the long sentence in a single column. */
function crampedFields(html: string): string[] {
  return rows(html)
    .filter((cells) => cells.some((c) => c.txt.includes(LONG) && c.span < 3))
    .map((cells) => cells[0].txt || '(unlabelled)');
}

describe('No report row wastes half its width', () => {
  test.each(['comm-goods', 'comm-passenger', 'private'])('spot report — %s', (vt) => {
    expect(rowsWithEmptyTail(spot(vt))).toEqual([]);
  });

  test.each(['comm-goods', 'private'])('standard final — %s', (vt) => {
    expect(rowsWithEmptyTail(standard(vt))).toEqual([]);
  });

  test('standard final bill check', () => {
    expect(rowsWithEmptyTail(buildStandardFinalSurveyHTML(claim('comm-goods'), profile, 'bill-check'))).toEqual([]);
  });
});

describe('Prose fields span the table', () => {
  test('spot report gives every long field room', () => {
    expect(crampedFields(spot('comm-passenger'))).toEqual([]);
  });

  test('standard final gives every long field room', () => {
    expect(crampedFields(standard('comm-goods'))).toEqual([]);
  });
});

describe('Load details speak for goods and passenger vehicles alike', () => {
  test('spot report labels the field for both', () => {
    expect(spot('comm-passenger')).toContain('Goods / Passengers Carried');
    expect(spot('comm-goods')).toContain('Goods / Passengers Carried');
  });

  test('standard final labels the field for both', () => {
    expect(standard('comm-passenger')).toContain('Description of Goods / Passengers');
    expect(standard('comm-goods')).toContain('Description of Goods / Passengers');
  });
});
