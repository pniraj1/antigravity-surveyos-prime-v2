// ═══════════════════════════════════════════════════════════
// WORD REPORT BUILDER (.docx)
// Generates editable report documents using the 'docx' library.
// ═══════════════════════════════════════════════════════════

import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { ClaimData, AssessmentSummary, SurveyorProfile } from '@/types';
import { formatCurrency, formatDateDMY } from '@/lib/calculations';

const formatDateTimeDMY = (dt: string) => {
  if (!dt) return '—';
  try {
    const d = new Date(dt);
    return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  } catch (e) { return dt; }
};

/**
 * Helper to generate simple 2-column key-value rows
 */
function createKVRow(k1: string, v1: string, k2?: string, v2?: string) {
  const cells = [
    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: k1, color: "444444", size: 14 })] })] }),
    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(v1 || "—"), bold: k1.includes("Reg. No") || k1.includes("Driver Name") || k1.includes("Spot Report No") || k1.includes("Policy No."), size: 18 })] })] })
  ];

  if (k2 !== undefined) {
    cells.push(new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: k2, color: "444444", size: 14 })] })] }));
    cells.push(new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(v2 || "—"), size: 18 })] })] }));
  }

  return new TableRow({ children: cells });
}


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
              new TextRun({ text: `\nPolice Station: ${claim.accident.policeStation || "—"}`, break: 1 }),
              new TextRun({ text: `\nFIR / Diary No: ${claim.accident.firNumber || "—"}`, break: 1 }),
              new TextRun({ text: `\nFIR Date: ${claim.accident.firDate || "—"}`, break: 1 }),
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

/**
 * Builds and downloads a Word version of the SPOT survey report, matching the Power Print layout
 */
export async function generateSpotWordReport(claim: ClaimData, profile: SurveyorProfile) {
  const { spotDetails, spotDamageRows, vehicle, policy, accident } = claim;
  const isComm = claim.vehicleType !== 'private';
  const isGoods = claim.vehicleType === 'comm-goods';

  const headingStyle = { bold: true, size: 18, color: "000000" };
  const sectionHeaderStyle = { bold: true, size: 20, color: "000000" };

  const sections: any[] = [
    // Header
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: profile.name || 'SURVEYOR NAME', bold: true, size: 26 }),
        new TextRun({ text: `\n${profile.qualifications || 'QUALIFICATIONS'}`, size: 16, break: 1 }),
        new TextRun({ text: "\nINSURANCE SURVEYOR, LOSS ASSESSOR & VALUER", bold: true, size: 18, break: 1 }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: `\nLic. No.: ${profile.licenceNumber} | Expiry: ${profile.licenceExpiry} | IIISLA: ${profile.iiislaNumber}`, size: 14, break: 1 }),
        new TextRun({ text: `\nE-mail: ${profile.email} | Cell: ${profile.mobile}`, size: 14, break: 1 }),
        new TextRun({ text: `\n${profile.address}`, size: 14, break: 1 }),
      ],
    }),

    new Paragraph({ text: "" }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: "PRIVATE AND CONFIDENTIAL", bold: true, underline: {} }),
        new TextRun({ text: "\nSPOT SURVEY REPORT", bold: true, underline: {}, break: 1 }),
      ]
    }),
    new Paragraph({ text: "" }),

    // Report Metadata
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        createKVRow("Spot Report No.", spotDetails.reportNo, "Date of Report", formatDateDMY(spotDetails.reportDate)),
        createKVRow("Date of Allotment", formatDateDMY(spotDetails.allotmentDate), "Date & Time of Survey", formatDateTimeDMY(spotDetails.surveyDatetime)),
      ]
    }),

    new Paragraph({ text: "\nA. VEHICLE PARTICULARS", ...sectionHeaderStyle }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        createKVRow("Policy No.", policy.policyNumber, "Claim No.", policy.claimNumber),
        createKVRow("Policy Type", policy.policyType, "IDV (₹)", policy.idv),
        createKVRow("Policy Period", `${formatDateDMY(policy.periodFrom)} to ${formatDateDMY(policy.periodTo)}`, "Policy Issuing Office", policy.policyIssuingOffice),
        createKVRow("Appointing Office", policy.appointingOffice, "", ""),
        createKVRow("Reg. No.", vehicle.registrationNumber, "Make / Model / Year", `${vehicle.make} / ${vehicle.model} / ${vehicle.yearOfManufacture}`),
        createKVRow("Chassis No.", vehicle.chassisNumber, "Engine No.", vehicle.engineNumber),
        createKVRow("Date of Reg.", formatDateDMY(vehicle.dateOfRegistration), "Class of Vehicle", vehicle.classOfVehicle),
        createKVRow("Body Type", vehicle.bodyType, "Colour", vehicle.colour),
        createKVRow("Fuel", vehicle.fuel, "CC", vehicle.cubicCapacity),
        createKVRow("RLW / GVW / Seating", vehicle.rlw, "Odometer (KM)", vehicle.odometer),
        createKVRow("Pre-Accid. Cond.", vehicle.preAccidentCondition, isComm ? "Fitness Cert. No." : "", isComm ? vehicle.fitnessNo : ""),
        ...(isComm ? [
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Route / Area", color: "444444", size: 14 })] })] }),
              new TableCell({ columnSpan: 3, children: [new Paragraph({ children: [new TextRun({ text: vehicle.route || "—", size: 18 })] })] })
            ]
          })
        ] : []),
        createKVRow("Insured", policy.insuredName, "Insurer", policy.insurerName),
        createKVRow("Insured Mobile", policy.insuredMobile, "HPA / Finance", policy.hpa || "NIL"),
        ...(policy.insuredAddress ? [
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Insured Address", color: "444444", size: 14 })] })] }),
              new TableCell({ columnSpan: 3, children: [new Paragraph({ children: [new TextRun({ text: policy.insuredAddress || "—", size: 18 })] })] })
            ]
          })
        ] : []),
      ]
    }),

    new Paragraph({ text: "\nB. DRIVER'S PARTICULARS & DL VERIFICATION", ...sectionHeaderStyle }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        createKVRow("Driver Name", `${claim.driver.name || '—'} ${claim.driver.parentName ? (claim.driver.relationType || 'S/o') + ' ' + claim.driver.parentName : ''}`, "MDL No.", claim.driver.licenceNumber),
        createKVRow("Date of Birth", formatDateDMY(claim.driver.dob), "Issuing Authority", claim.driver.issuingAuthority),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Classes / Issue Date", color: "444444", size: 14 })] })] }),
            new TableCell({ columnSpan: 3, children: [new Paragraph({ children: [new TextRun({ text: `${claim.driver.vehicleClass || '—'} | Issued: ${formatDateDMY(claim.driver.dateOfIssue) || '—'}`, size: 18 })] })] })
          ]
        }),
        createKVRow("Non-Transport Valid", formatDateDMY(claim.driver.validityNonTransport), "Transport Valid", formatDateDMY(claim.driver.validityTransport)),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "MDL Status", color: "444444", size: 14 })] })] }),
            new TableCell({ columnSpan: 3, children: [new Paragraph({ children: [new TextRun({ text: `${claim.driver.verificationStatus === 'verified' ? 'ORIGINAL MDL VERIFIED' : claim.driver.verificationStatus === 'photocopy' ? 'PHOTOCOPY VERIFIED' : 'NOT AVAILABLE'} ${claim.driver.invalidRemarks ? '— ' + claim.driver.invalidRemarks : ''}`, bold: true, size: 18 })] })] })
          ]
        }),
      ]
    }),

    new Paragraph({ text: "\nC. ACCIDENT DETAILS", ...sectionHeaderStyle }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        createKVRow("Date & Time", formatDateTimeDMY(accident.dateAndTime), "Place of Accident", accident.placeOfAccident),
        createKVRow("Date of Survey", formatDateDMY(accident.dateOfSurvey), "Place of Survey", accident.placeOfSurvey),
        createKVRow("Third Party", spotDetails.tpInvolved === 'no' ? 'NIL' : spotDetails.tpInvolved.toUpperCase(), "TP Details", accident.thirdPartyDetails || 'NIL'),
        createKVRow("Police Reported", spotDetails.policeReported === 'yes' ? `Yes — ${accident.policeStation} | Diary: ${accident.firNumber}` : 'No', "Panchanama", spotDetails.panchanama === 'yes' ? 'Yes' : 'No'),
        createKVRow("FIR Date", formatDateDMY(accident.firDate), "", ""),
      ]
    }),

    new Paragraph({ text: "\nD. DOCUMENT VERIFICATION", ...sectionHeaderStyle }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Document", bold: true, size: 16 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Status", bold: true, size: 16 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Remarks", bold: true, size: 16 })] })] }),
          ]
        }),
        ...[
          { id: 'rc', label: 'RC' },
          { id: 'dl', label: 'DL' },
          { id: 'permit', label: 'Permit' },
          { id: 'fitness', label: 'Fitness' },
          { id: 'loadChallan', label: 'Load Challan' },
          { id: 'fireReport', label: 'Fire Report' },
          { id: 'fir', label: 'FIR' },
        ].map(({ id, label }) => {
          const docFlags = (claim.documentVerification || {}) as Record<string, { status: string; detail: string }>;
          const doc = docFlags[id] || { status: 'NO', detail: '' };
          return new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: label, size: 18 })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: doc.status || '—', bold: true, size: 18 })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: doc.detail || '—', size: 18 })] })] }),
            ]
          });
        })
      ]
    }),
  ];

  if (isComm) {
    sections.push(new Paragraph({ text: "\nE. COMMERCIAL VEHICLE DOCUMENTS", ...sectionHeaderStyle }));
    sections.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        createKVRow("Permit No.", spotDetails.permitNo, "Permit Type", spotDetails.permitType),
        createKVRow("Permit Valid From", spotDetails.permitFrom, "Permit Valid To", spotDetails.permitTo),
        createKVRow("Fitness No.", vehicle.fitnessNo, "Fitness Valid To", vehicle.fitnessValidUpto),
        createKVRow("Auth. No.", spotDetails.authNo, "Auth Valid To", spotDetails.authValid),
      ]
    }));
  }

  if (isGoods) {
    sections.push(new Paragraph({ text: "\nF. LOAD DETAILS", ...sectionHeaderStyle }));
    sections.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        createKVRow("GVW (kg)", String(spotDetails.gvw || ""), "ULW / Tare (kg)", String(spotDetails.ulw || "")),
        createKVRow("Load Capacity", String(spotDetails.loadCapacity || ""), "Actual Load", String(spotDetails.actualLoad || "")),
        createKVRow("CN / Challan No.", spotDetails.challanNo, "Challan Date", spotDetails.challanDate),
        createKVRow("Goods", spotDetails.loadDesc, "", ""),
        createKVRow("Origin", spotDetails.loadOrigin, "Destination", spotDetails.loadDest),
      ]
    }));
  }

  sections.push(new Paragraph({ text: "\nF. CAUSE AND NATURE OF ACCIDENT", ...sectionHeaderStyle }));
  sections.push(new Paragraph({ text: accident.causeOfAccident || "—" }));

  sections.push(new Paragraph({ text: "\nG. SPOT OBSERVATIONS / COMMENTS / REMARKS", ...sectionHeaderStyle }));
  sections.push(new Paragraph({ text: spotDetails.comments || "NIL" }));

  sections.push(new Paragraph({ text: "\nH. DAMAGE PARTICULARS AT SPOT", ...sectionHeaderStyle }));
  sections.push(new Paragraph({ text: `Severity: ${spotDetails.damageSeverity?.toUpperCase() || ''} | Airbags Deployed: ${spotDetails.airbags?.toUpperCase() || ''} | Drivable: ${spotDetails.drivable || ''}\n` }));

  if (spotDamageRows.length > 0) {
    sections.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Sr.", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Component", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Damage Description", bold: true })] })] }),
          ]
        }),
        ...spotDamageRows.map((r, i) => new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(String(i + 1))] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.component || "—", bold: true })] })] }),
            new TableCell({ children: [new Paragraph(r.damage || "—")] }),
          ]
        }))
      ]
    }));
  } else {
    sections.push(new Paragraph({ 
      children: [
        new TextRun({ 
          text: "No specific damage items listed. Refer to observations above.", 
          italics: true, 
          color: "666666" 
        })
      ]
    }));
  }
  
  sections.push(new Paragraph({ text: "\nWe have noted down maximum possible visible damages at accident spot. Any other unseen/hidden damages which are related to cause of accident if noticed may be considered on dismantled checkup. This report is issued without prejudice subject to policy terms and condition and the damages stated in this report are based on physical inspection of accidental I.V. on the spot of the accident.\n" }));

  sections.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [
      new TextRun({ text: `\n\n\n\n${profile.name || 'SURVEYOR NAME'}`, bold: true }),
      new TextRun({ text: "\nLicenced Surveyor & Loss Assessor", break: 1 }),
    ]
  }));

  sections.push(new Paragraph({ text: `\nENCL: ${spotDetails.enclosures || ' '.repeat(50)}` }));

  const doc = new Document({
    sections: [{
      properties: {},
      children: sections
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Spot_Report_${vehicle.registrationNumber || 'Claim'}.docx`);
}
