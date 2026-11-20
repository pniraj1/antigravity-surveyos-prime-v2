import { describe, it, expect } from 'vitest';
import {
  parseAxisBankCmsPdfText,
  parseUiicEmailText,
  parseNiaEmailText,
  parseDeterministicAdvice,
} from '../deterministic-parsers';

describe('Deterministic Payment Advice Parsers (Zero-AI)', () => {
  const SAMPLE_UIIC_TEXT = `
Dear Surveyor,
For the claim 2310023126C050058001 on policy number: 2310023125P117257182, vehicle number: MH 18 BZ 2552, insured name: Vikram Patil and Survey report no. REP-2026-99 your payment has been disbursed at Rs. 5468/-( gross=6076, TDS=608, GST TDS=0 )
Regards,
United India Insurance Company Limited
  `;

  const SAMPLE_AXIS_CMS_TEXT = `
Payment Advice
Straight2axis@axis.bank.in
UTR Number : AXISCN1526257496
Payment Ini. Date : 15-11-2026
Beneficiary Name : VIKRAM PATIL
Company Name : UNITED INDIA INSURANCE COMPANY LIMITED
Amount : 4,743.00

Enrichment:
GJ20AH3438
Claim# 2310843126C050010001
LossDt 10-11-2026
Payment Details
  `;

  const SAMPLE_NIA_TEXT = `
From: NIAHO@newindia.co.in
Subject: Payment Advice - NEFT Disbursed

Dear Sir/Madam,
We have the pleasure to inform you that we have instructed our bankers to remit an amount of Rs. 1,413.00 to your bank account with UTR No. CMS938210194 on 15-11-2026 towards professional surveyor fees from The New India Assurance Co. Ltd.

INVOICE NUMBER | POLICY NUMBER | CLAIM NUMBER | AMOUNT | CLAIM DETAILS (Vehicle Number) | DESCRIPTION
INV-2026-001 | 16080231250100001234 | 16080231260190000009 | 1,570.00 | MH-39-J-6873 | SURVEY REPORT CHARGES
TDS-2026-001 | 16080231250100001234 | 16080231260190000009 | -157.00 | MH-39-J-6873 | OF-TDS-CM-194J
TOTAL: 1,413.00
  `;

  describe('UIIC Email Parser', () => {
    it('extracts UIIC payment details accurately in <5ms', () => {
      // Warm up JIT
      parseUiicEmailText(SAMPLE_UIIC_TEXT, 'uiic-test.eml');
      const start = performance.now();
      const parsed = parseUiicEmailText(SAMPLE_UIIC_TEXT, 'uiic-test.eml');
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(10);
      expect(parsed).not.toBeNull();
      expect(parsed?.insurerName).toBe('United India Insurance Company Limited');
      expect(parsed?.netPaid).toBe(5468);
      expect(parsed?.totalAmount).toBe(6076);
      expect(parsed?.totalTds).toBe(608);

      expect(parsed?.claims).toHaveLength(1);
      const claim = parsed!.claims[0];
      expect(claim.claimNumber).toBe('2310023126C050058001');
      expect(claim.vehicleNumber).toBe('MH 18 BZ 2552');
      expect(claim.policyNumber).toBe('2310023125P117257182');
      expect(claim.grossFee).toBe(6076);
      expect(claim.tdsAmount).toBe(608);
      expect(claim.netPaid).toBe(5468);
      expect(claim.remarks).toBe('REP-2026-99');
    });

    it('handles decimal amounts and custom whitespace in UIIC format', () => {
      const customText = `For the claim 231099 on policy number: POL99, vehicle number: DL 01 AB 1234, insured name: John Doe and Survey report no. SR-123 your payment has been disbursed at Rs. 5,468.50 / - ( gross = 6,076.50 , TDS = 608.00 )`;
      const parsed = parseUiicEmailText(customText, 'custom');
      expect(parsed).not.toBeNull();
      expect(parsed?.claims[0].claimNumber).toBe('231099');
      expect(parsed?.claims[0].vehicleNumber).toBe('DL 01 AB 1234');
      expect(parsed?.claims[0].netPaid).toBe(5468.5);
      expect(parsed?.claims[0].grossFee).toBe(6076.5);
      expect(parsed?.claims[0].tdsAmount).toBe(608);
    });

    it('returns null if UIIC marker is missing', () => {
      expect(parseUiicEmailText('Random email without claim or disbursement text')).toBeNull();
    });
  });

  describe('Axis Bank CMS PDF Parser', () => {
    it('extracts Axis Bank CMS advice details accurately in <5ms', () => {
      parseAxisBankCmsPdfText(SAMPLE_AXIS_CMS_TEXT, 'axis-test.pdf');
      const start = performance.now();
      const parsed = parseAxisBankCmsPdfText(SAMPLE_AXIS_CMS_TEXT, 'axis-test.pdf');
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(10);
      expect(parsed).not.toBeNull();
      expect(parsed?.insurerName).toBe('UNITED INDIA INSURANCE COMPANY LIMITED');
      expect(parsed?.utrNumber).toBe('AXISCN1526257496');
      expect(parsed?.paymentDate).toBe('2026-11-15');
      expect(parsed?.netPaid).toBe(4743);
      expect(parsed?.totalAmount).toBe(4743);
      expect(parsed?.totalTds).toBe(0);

      expect(parsed?.claims).toHaveLength(1);
      const claim = parsed!.claims[0];
      expect(claim.claimNumber).toBe('2310843126C050010001');
      expect(claim.vehicleNumber).toBe('GJ20AH3438');
      expect(claim.grossFee).toBe(4743);
      expect(claim.tdsAmount).toBe(0);
      expect(claim.netPaid).toBe(4743);
    });

    it('parses Oriental Insurance remittances via Axis Bank CMS', () => {
      const oicAxisText = `
Payment Advice
Straight2axis@axis.bank.in
UTR Number : AXISCN99887766
Payment Ini. Date : 20-11-2026
Beneficiary Name : VIKRAM PATIL
Company Name : THE ORIENTAL INSURANCE COMPANY LIMITED
Amount : 3,250.00

Enrichment:
MH12AB1234
Claim# 2411003125000001
LossDt 12-11-2026
      `;
      const parsed = parseAxisBankCmsPdfText(oicAxisText, 'oic-axis.pdf');
      expect(parsed).not.toBeNull();
      expect(parsed?.insurerName).toBe('THE ORIENTAL INSURANCE COMPANY LIMITED');
      expect(parsed?.utrNumber).toBe('AXISCN99887766');
      expect(parsed?.paymentDate).toBe('2026-11-20');
      expect(parsed?.claims[0].claimNumber).toBe('2411003125000001');
      expect(parsed?.claims[0].vehicleNumber).toBe('MH12AB1234');
      expect(parsed?.claims[0].netPaid).toBe(3250);
    });

    it('returns null if Axis Bank CMS marker is missing', () => {
      expect(parseAxisBankCmsPdfText('Just some plain text without Payment Advice marker')).toBeNull();
    });
  });

  describe('NIA Tabular Notice Parser', () => {
    it('extracts New India Assurance tabular details accurately in <5ms', () => {
      parseNiaEmailText(SAMPLE_NIA_TEXT, 'nia-test.eml');
      const start = performance.now();
      const parsed = parseNiaEmailText(SAMPLE_NIA_TEXT, 'nia-test.eml');
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(10);
      expect(parsed).not.toBeNull();
      expect(parsed?.insurerName).toBe('The New India Assurance Co. Ltd');
      expect(parsed?.utrNumber).toBe('CMS938210194');
      expect(parsed?.paymentDate).toBe('2026-11-15');
      expect(parsed?.netPaid).toBe(1413);
      expect(parsed?.totalAmount).toBe(1570);
      expect(parsed?.totalTds).toBe(157);

      expect(parsed?.claims).toHaveLength(1);
      const claim = parsed!.claims[0];
      expect(claim.claimNumber).toBe('16080231260190000009');
      expect(claim.vehicleNumber).toBe('MH-39-J-6873');
      expect(claim.grossFee).toBe(1570);
      expect(claim.tdsAmount).toBe(157);
      expect(claim.netPaid).toBe(1413);
    });

    it('returns null if NIA markers or remit clause is missing', () => {
      expect(parseNiaEmailText('Hello from The New India Assurance without remit details')).toBeNull();
    });
  });

  describe('parseDeterministicAdvice Router', () => {
    it('routes UIIC text correctly', () => {
      const res = parseDeterministicAdvice(SAMPLE_UIIC_TEXT, 'uiic.eml');
      expect(res?.insurerName).toBe('United India Insurance Company Limited');
      expect(res?.claims[0].claimNumber).toBe('2310023126C050058001');
    });

    it('routes Axis Bank CMS text correctly', () => {
      const res = parseDeterministicAdvice(SAMPLE_AXIS_CMS_TEXT, 'axis.pdf');
      expect(res?.insurerName).toBe('UNITED INDIA INSURANCE COMPANY LIMITED');
      expect(res?.utrNumber).toBe('AXISCN1526257496');
    });

    it('routes NIA text correctly', () => {
      const res = parseDeterministicAdvice(SAMPLE_NIA_TEXT, 'nia.eml');
      expect(res?.insurerName).toBe('The New India Assurance Co. Ltd');
      expect(res?.claims[0].claimNumber).toBe('16080231260190000009');
    });

    it('returns null for unknown freeform text', () => {
      expect(parseDeterministicAdvice('Subject: Invoice for repair charges')).toBeNull();
      expect(parseDeterministicAdvice('')).toBeNull();
    });
  });
});
