import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractPaymentAdviceFromText,
  extractPaymentAdviceFromFile,
  parseAdviceJSON,
  PAYMENT_ADVICE_PROMPT,
} from '../payment-advice-extractor';

vi.mock('../service', () => ({
  callAIGateway: vi.fn(),
  lastUsedModelLabel: () => 'Gemini 2.0 Flash',
}));

vi.mock('../processor', () => ({
  fileToImages: vi.fn(),
}));

import { callAIGateway } from '../service';
import { fileToImages } from '../processor';

describe('Payment Advice Extractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses valid advice JSON structure cleanly', () => {
    const rawJSON = JSON.stringify({
      insurerName: 'The New India Assurance Co. Ltd.',
      paymentDate: '2026-11-15',
      utrNumber: 'CMS938210194',
      totalAmount: 5000,
      totalTds: 500,
      netPaid: 4500,
      claims: [
        {
          claimNumber: '310100/31/24/01/00001234',
          vehicleNumber: 'MH-12-AB-1234',
          policyNumber: '31010031230100005678',
          grossFee: 2500,
          conveyance: 500,
          tdsAmount: 250,
          netPaid: 2750,
        },
      ],
    });

    const parsed = parseAdviceJSON(rawJSON, 'email-body');
    expect(parsed).not.toBeNull();
    expect(parsed?.insurerName).toBe('The New India Assurance Co. Ltd.');
    expect(parsed?.utrNumber).toBe('CMS938210194');
    expect(parsed?.claims.length).toBe(1);
    expect(parsed?.claims[0].claimNumber).toBe('310100/31/24/01/00001234');
    expect(parsed?.claims[0].netPaid).toBe(2750);
  });

  it('auto-computes TDS if grossFee > netPaid and tdsAmount is missing', () => {
    const rawJSON = JSON.stringify({
      insurerName: 'United India Insurance',
      paymentDate: '2026-11-10',
      utrNumber: 'UTR445566',
      totalAmount: 2000,
      totalTds: 0,
      netPaid: 1800,
      claims: [
        {
          claimNumber: 'UIIC/2026/01',
          vehicleNumber: 'MH-14-CD-5678',
          grossFee: 2000,
          netPaid: 1800,
        },
      ],
    });

    const parsed = parseAdviceJSON(rawJSON, 'test.pdf');
    expect(parsed?.claims[0].tdsAmount).toBe(200);
    expect(parsed?.totalTds).toBe(200);
  });

  it('auto-computes 10% TDS when netPaid is 0 and grossFee > 0', () => {
    const rawJSON = JSON.stringify({
      insurerName: 'Oriental Insurance Company',
      paymentDate: '2026-11-14',
      utrNumber: 'OIC987654',
      claims: [
        {
          claimNumber: 'OIC/2026/99',
          vehicleNumber: 'DL-01-AB-1234',
          grossFee: 1500,
          netPaid: 0,
        },
      ],
    });

    const parsed = parseAdviceJSON(rawJSON, 'advice.pdf');
    expect(parsed?.claims[0].tdsAmount).toBe(150);
    expect(parsed?.claims[0].netPaid).toBe(1350);
    expect(parsed?.totalAmount).toBe(1500);
    expect(parsed?.totalTds).toBe(150);
    expect(parsed?.netPaid).toBe(1350);
  });

  it('strips markdown code fences when parsing JSON', () => {
    const fencedJSON = '```json\n{"insurerName":"ICICI Lombard","utrNumber":"ICICI123","totalAmount":1000,"netPaid":900,"claims":[]}\n```';
    const parsed = parseAdviceJSON(fencedJSON, 'email');
    expect(parsed).not.toBeNull();
    expect(parsed?.insurerName).toBe('ICICI Lombard');
    expect(parsed?.utrNumber).toBe('ICICI123');
  });

  it('returns null gracefully on invalid JSON', () => {
    const result = parseAdviceJSON('Not a valid JSON response at all', 'bad-input');
    expect(result).toBeNull();
  });

  it('calls callAIGateway and returns parsed advice', async () => {
    (callAIGateway as any).mockResolvedValueOnce(
      JSON.stringify({
        insurerName: 'National Insurance',
        paymentDate: '2026-11-12',
        utrNumber: 'NIC998877',
        totalAmount: 1500,
        totalTds: 150,
        netPaid: 1350,
        claims: [{ claimNumber: 'NIC/999', grossFee: 1500, netPaid: 1350 }],
      })
    );

    const result = await extractPaymentAdviceFromText('Payment details for NIC/999 UTR: NIC998877');
    expect(callAIGateway).toHaveBeenCalled();
    expect(result?.insurerName).toBe('National Insurance');
    expect(result?.utrNumber).toBe('NIC998877');
  });

  it('handles network / gateway errors gracefully by returning null', async () => {
    (callAIGateway as any).mockRejectedValueOnce(new Error('Gateway timeout 504'));
    const result = await extractPaymentAdviceFromText('Some advice text');
    expect(result).toBeNull();
  });

  it('extracts from .txt file by reading text', async () => {
    (callAIGateway as any).mockResolvedValueOnce(
      JSON.stringify({
        insurerName: 'Bajaj Allianz',
        paymentDate: '2026-11-18',
        utrNumber: 'BAJAJ1122',
        totalAmount: 3000,
        totalTds: 300,
        netPaid: 2700,
        claims: [{ claimNumber: 'BAGIC/01', grossFee: 3000, netPaid: 2700 }],
      })
    );

    const file = new File(['UTR: BAJAJ1122 Amount 3000'], 'advice.txt', { type: 'text/plain' });
    const result = await extractPaymentAdviceFromFile(file);
    expect(result?.insurerName).toBe('Bajaj Allianz');
    expect(result?.utrNumber).toBe('BAJAJ1122');
  });

  it('extracts from PDF file using fileToImages', async () => {
    (fileToImages as any).mockResolvedValueOnce({
      apiImages: ['data:image/jpeg;base64,page1', 'data:image/jpeg;base64,page2'],
      viewImages: [],
    });

    (callAIGateway as any).mockResolvedValueOnce(
      JSON.stringify({
        insurerName: 'HDFC ERGO',
        paymentDate: '2026-11-19',
        utrNumber: 'HDFC9900',
        totalAmount: 2500,
        totalTds: 250,
        netPaid: 2250,
        claims: [{ claimNumber: 'HDFC/555', grossFee: 2500, netPaid: 2250 }],
      })
    );

    const file = new File(['%PDF-1.4...'], 'advice.pdf', { type: 'application/pdf' });
    const result = await extractPaymentAdviceFromFile(file);
    expect(fileToImages).toHaveBeenCalledWith(file);
    expect(callAIGateway).toHaveBeenCalledWith(PAYMENT_ADVICE_PROMPT, expect.any(Array), 'json', 'light');
    expect(result?.insurerName).toBe('HDFC ERGO');
    expect(result?.utrNumber).toBe('HDFC9900');
  });

  it('bypasses callAIGateway completely when text matches deterministic parser (UIIC)', async () => {
    const uiicText = `For the claim 2310023126C050058001 on policy number: 2310023125P117257182, vehicle number: MH 18 BZ 2552, insured name: Vikram Patil and Survey report no. REP-99 your payment has been disbursed at Rs. 5468/-( gross=6076, TDS=608, GST TDS=0 )`;

    const result = await extractPaymentAdviceFromText(uiicText, 'uiic.eml');
    expect(callAIGateway).not.toHaveBeenCalled();
    expect(result).not.toBeNull();
    expect(result?.insurerName).toBe('United India Insurance Company Limited');
    expect(result?.claims[0].claimNumber).toBe('2310023126C050058001');
    expect(result?.claims[0].netPaid).toBe(5468);
  });

  it('skips AI gateway immediately when text lacks any financial keywords', async () => {
    const nonFinancialText = 'Hello world, please find the meeting agenda attached for tomorrow morning.';

    const result = await extractPaymentAdviceFromText(nonFinancialText, 'agenda.txt');
    expect(callAIGateway).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('uses "text" tier when falling back to AI for text advice', async () => {
    (callAIGateway as any).mockResolvedValueOnce(
      JSON.stringify({
        insurerName: 'Custom Insurer',
        paymentDate: '2026-11-20',
        utrNumber: 'CUST123',
        totalAmount: 1000,
        totalTds: 100,
        netPaid: 900,
        claims: [{ claimNumber: 'CLM-1', grossFee: 1000, netPaid: 900 }],
      })
    );

    const result = await extractPaymentAdviceFromText('Non-templated remittance advice: payment paid Rs 900 UTR CUST123', 'custom.txt');
    expect(callAIGateway).toHaveBeenCalledWith(expect.any(String), [], 'json', 'text');
    expect(result?.insurerName).toBe('Custom Insurer');
  });
});
