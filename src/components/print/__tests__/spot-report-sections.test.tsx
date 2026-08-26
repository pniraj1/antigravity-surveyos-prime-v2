import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SpotPrintReport } from '@/components/print/SpotPrintReport';
import type { ClaimData, SurveyorProfile } from '@/types';

/**
 * Two sections of the spot report are conditional, so section letters are
 * counted at render rather than hardcoded. These tests pin that: a surveyor
 * reported the sequence reading A B C D D E F G H on a goods claim, and
 * private claims silently skipping E.
 */

function claim(vehicleType: string): ClaimData {
  return {
    id: 'c1',
    vehicleType,
    surveyType: 'spot',
    assessmentRows: [],
    spotDamageRows: [],
    vehicle: { registrationNumber: 'MH12AB1234', fitnessNo: 'FIT/1', fitnessValidUpto: '2027-01-01' },
    policy: {},
    driver: {},
    accident: { thirdPartyDetails: 'TP text' },
    spotDetails: {
      permitNo: 'PERMIT-777',
      permitType: 'National',
      natureOfPermit: 'Goods Carriage',
      permitTo: '2027-03-01',
      authNo: 'AUTH-9',
      authValid: '2027-03-01',
      areaOfOperation: 'All India',
      challanNo: 'CN/8891',
      challanDate: '2026-06-24',
      gvw: 16200,
      ulw: 6200,
      loadCapacity: 10000,
      actualLoad: 12400,
      flagOverload: true,
      loadDesc: 'Cement bags',
      loadOrigin: 'Pune',
      loadDest: 'Solapur',
    },
    documentVerification: {},
    feeBill: {},
    billCheck: {},
    reinspection: {},
  } as unknown as ClaimData;
}

const profile = { name: 'SURVEYOR' } as SurveyorProfile;

const render = (vehicleType: string) =>
  renderToStaticMarkup(<SpotPrintReport claim={claim(vehicleType)} profile={profile} />);

/** The section letters, in document order, as the reader sees them. */
function sectionLetters(html: string): string[] {
  return [...html.matchAll(/>([A-Z])\.\s[A-Z]/g)].map((m) => m[1]);
}

describe('Spot report section lettering', () => {
  test.each(['comm-goods', 'comm-passenger', 'private'])(
    'runs A, B, C… with no gap and no repeat for %s',
    (vehicleType) => {
      const letters = sectionLetters(render(vehicleType));
      expect(letters.length).toBeGreaterThan(4);
      const expected = letters.map((_, i) => String.fromCharCode(65 + i));
      expect(letters).toEqual(expected);
    },
  );

  test('commercial claims carry two more sections than private', () => {
    expect(sectionLetters(render('comm-goods')).length).toBe(
      sectionLetters(render('private')).length + 2,
    );
  });
});

describe('Spot report commercial and load details', () => {
  test.each(['comm-goods', 'comm-passenger'])('prints permit and load data for %s', (vehicleType) => {
    const html = render(vehicleType);
    expect(html).toContain('PERMIT-777');
    expect(html).toContain('Goods Carriage'); // natureOfPermit had no row at all
    expect(html).toContain('CN/8891');
    expect(html).toContain('Cement bags');
    expect(html).toContain('Pune');
    expect(html).toContain('Solapur');
    expect(html).toContain('12400');
  });

  test('prints none of it for a private vehicle', () => {
    const html = render('private');
    expect(html).not.toContain('PERMIT-777');
    expect(html).not.toContain('CN/8891');
    expect(html).not.toContain('Cement bags');
  });

  test('prints Area of Operation once, not twice', () => {
    const html = render('comm-goods');
    expect(html.split('Area of Operation').length - 1).toBe(1);
  });
});
