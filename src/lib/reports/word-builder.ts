// ═══════════════════════════════════════════════════════════
// WORD REPORT BUILDER (.docx)
// Generates editable report documents using the 'docx' library.
// ═══════════════════════════════════════════════════════════

import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { ClaimData, AssessmentSummary } from '@/types';
import { formatCurrency } from '@/lib/calculations';

/**
 * Builds and downloads a Word version of the survey report.
 */
export async function generateWordReport(claim: ClaimData, summary: AssessmentSummary | null) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: "SURVEYOR'S FINAL MOTOR SURVEY REPORT",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Report No: ${claim.reportNo || claim.id}`, bold: true }),
              new TextRun({ text: `\tDate: ${claim.reportDate}`, break: 1 }),
            ],
          }),

          new Paragraph({ text: "\n1. VEHICLE DETAILS", heading: HeadingLevel.HEADING_2 }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Registration No")] }),
                  new TableCell({ children: [new Paragraph(claim.vehicle.registrationNumber || "—")] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Chassis No")] }),
                  new TableCell({ children: [new Paragraph(claim.vehicle.chassisNumber || "—")] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Make & Model")] }),
                  new TableCell({ children: [new Paragraph(`${claim.vehicle.make} ${claim.vehicle.model}`.trim() || "—")] }),
                ],
              }),
            ],
          }),

          new Paragraph({ text: "\n2. POLICY DETAILS", heading: HeadingLevel.HEADING_2 }),
          new Paragraph({
            children: [
              new TextRun({ text: `Insurer: ${claim.policy.insurerName || "—"}` }),
              new TextRun({ text: `\nPolicy No: ${claim.policy.policyNumber || "—"}`, break: 1 }),
              new TextRun({ text: `\nInsured: ${claim.policy.insuredName || "—"}`, break: 1 }),
            ],
          }),

          new Paragraph({ text: "\n3. ACCIDENT DETAILS", heading: HeadingLevel.HEADING_2 }),
          new Paragraph({
            children: [
              new TextRun({ text: `Date & Time: ${claim.accident.dateAndTime || "—"}` }),
              new TextRun({ text: `\nPlace: ${claim.accident.placeOfAccident || "—"}`, break: 1 }),
              new TextRun({ text: `\nCause: ${claim.accident.causeOfAccident || "—"}`, break: 1 }),
            ],
          }),

          new Paragraph({ text: "\n4. ASSESSMENT SUMMARY", heading: HeadingLevel.HEADING_2 }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Particulars", bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Estimated", bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Assessed", bold: true })] })] }),
                ],
              }),
              ...claim.assessmentRows.filter(r => r.allowed).map(row => 
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph(row.particulars || "—")] }),
                    new TableCell({ children: [new Paragraph(formatCurrency(row.estimated))] }),
                    new TableCell({ children: [new Paragraph(formatCurrency(row.assessed))] }),
                  ],
                })
              ),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "TOTAL ASSESSED LOSS", bold: true })] })] }),
                  new TableCell({ children: [new Paragraph("")] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatCurrency(summary?.netAssessedLoss ?? 0), bold: true })] })] }),
                ],
              }),
            ],
          }),

          new Paragraph({ children: [new TextRun({ text: `\nAmount In Words: ${summary?.netInWords ?? 'N/A'}`, break: 1 })] }),

          new Paragraph({ text: "\n5. SURVEYOR REMARKS", heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: claim.spotDetails.comments || "Survey carried out at the workshop. Document verification is completed." }),
        ],
      },
    ],
  });

  // Export to blob and trigger download
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `SurveyReport_${claim.vehicle.registrationNumber || 'Claim'}.docx`);
}
