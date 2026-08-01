/**
 * Standalone PDF generation script for screenshot capture.
 * Run with: npx tsx scripts/generate-pdf.ts
 * Output: .tmp-screenshots/report-demo.pdf
 */
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { SurveyReportDocument } from '../src/components/pdf/SurveyReportDocument';
import { MOCK_CLAIM } from '../src/app/screenshots/_mock-data';

const OUT = join(__dirname, '..', '.tmp-screenshots');
mkdirSync(OUT, { recursive: true });

(async () => {
  console.log('Rendering PDF…');
  const element = React.createElement(SurveyReportDocument, { claim: MOCK_CLAIM });
  const buffer = await renderToBuffer(element as any);
  const outPath = join(OUT, 'report-demo.pdf');
  writeFileSync(outPath, buffer);
  console.log(`PDF saved → ${outPath} (${Math.round(buffer.length / 1024)} KB)`);
})();
