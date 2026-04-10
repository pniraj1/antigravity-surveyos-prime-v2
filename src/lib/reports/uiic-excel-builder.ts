import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { ClaimData } from '@/types/claim';
import { AssessmentSummary, SurveyorProfile, AssessmentRow } from '@/types';

export class UIICExcelBuilder {
  private workbook: ExcelJS.Workbook;
  private worksheet: ExcelJS.Worksheet;
  private claim: ClaimData;
  private summary: AssessmentSummary;
  private profile: SurveyorProfile;

  private GREEN_UIIC = '006838';
  private BORDER_STYLE: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: '000000' } },
    left: { style: 'thin', color: { argb: '000000' } },
    bottom: { style: 'thin', color: { argb: '000000' } },
    right: { style: 'thin', color: { argb: '000000' } },
  };

  constructor(claim: ClaimData, summary: AssessmentSummary, profile: SurveyorProfile) {
    this.workbook = new ExcelJS.Workbook();
    this.worksheet = this.workbook.addWorksheet('UIIC Final Survey Report', {
        pageSetup: { 
            paperSize: 9, // A4
            orientation: 'portrait',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0, footer: 0 }
        },
        views: [{ state: 'normal', showGridLines: false }]
    });
    this.claim = claim;
    this.summary = summary;
    this.profile = profile;

    this.setupColumns();
  }

  private setupColumns() {
    // Audit shows columns A-H are standard for detail grid
    this.worksheet.columns = [
      { key: 'A', width: 25 },
      { key: 'B', width: 10 },
      { key: 'C', width: 15 },
      { key: 'D', width: 15 },
      { key: 'E', width: 18 },
      { key: 'F', width: 15 },
      { key: 'G', width: 15 },
      { key: 'H', width: 15 },
    ];
  }

  private styleCell(cell: ExcelJS.Cell, opts: { bold?: boolean, size?: number, color?: string, bg?: string, align?: 'left' | 'center' | 'right', border?: boolean } = {}) {
    cell.font = {
        name: 'Calibri',
        size: opts.size || 10,
        bold: !!opts.bold,
        color: { argb: opts.color || '000000' }
    };
    if (opts.bg) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.bg } };
    }
    if (opts.align) {
        cell.alignment = { vertical: 'middle', horizontal: opts.align, wrapText: true };
    }
    if (opts.border !== false) {
        cell.border = this.BORDER_STYLE;
    }
  }

  async build() {
    // --- TOP HEADER (REPLACING VIKRAM PATIL) ---
    this.worksheet.mergeCells('A1:H1');
    const titleCell = this.worksheet.getCell('A1');
    titleCell.value = this.profile.name.toUpperCase() || 'INSURANCE SURVEYOR';
    this.styleCell(titleCell, { size: 16, bold: true, align: 'center', border: false });

    this.worksheet.mergeCells('A2:H2');
    const addrCell = this.worksheet.getCell('A2');
    addrCell.value = this.profile.address || '';
    this.styleCell(addrCell, { size: 9, align: 'center', border: false });

    this.worksheet.mergeCells('A3:H3');
    const contactCell = this.worksheet.getCell('A3');
    contactCell.value = `Mobile: ${this.profile.mobile} | Email: ${this.profile.email}`;
    this.styleCell(contactCell, { size: 9, align: 'center', border: false });

    this.worksheet.mergeCells('A4:H4');
    const mainTitle = this.worksheet.getCell('A4');
    mainTitle.value = 'MOTOR SURVEY REPORT (FINAL)';
    this.styleCell(mainTitle, { size: 12, bold: true, align: 'center', bg: 'E6F4EA', color: this.GREEN_UIIC });

    // --- POLICY & CLAIM DETAILS GRID ---
    let currRow = 6;
    const addSectionHeader = (title: string) => {
        this.worksheet.mergeCells(`A${currRow}:H${currRow}`);
        const cell = this.worksheet.getCell(`A${currRow}`);
        cell.value = title;
        this.styleCell(cell, { bold: true, bg: 'F0F0F0', align: 'left' });
        currRow++;
    };

    const addFourColumnRow = (l1: string, v1: string, l2: string, v2: string) => {
        this.worksheet.mergeCells(`A${currRow}:B${currRow}`);
        this.worksheet.mergeCells(`C${currRow}:D${currRow}`);
        this.worksheet.mergeCells(`E${currRow}:F${currRow}`);
        this.worksheet.mergeCells(`G${currRow}:H${currRow}`);
        
        const cellL1 = this.worksheet.getCell(`A${currRow}`);
        const cellV1 = this.worksheet.getCell(`C${currRow}`);
        const cellL2 = this.worksheet.getCell(`E${currRow}`);
        const cellV2 = this.worksheet.getCell(`G${currRow}`);
        
        cellL1.value = l1; cellV1.value = v1;
        cellL2.value = l2; cellV2.value = v2;
        
        this.styleCell(cellL1, { bold: true });
        this.styleCell(cellV1);
        this.styleCell(cellL2, { bold: true });
        this.styleCell(cellV2);
        currRow++;
    };

    addSectionHeader('I. POLICY & CLAIM DETAILS');
    addFourColumnRow('Insurer', 'UNITED INDIA INSURANCE CO. LTD.', 'Policy No', this.claim.policy?.policyNumber || 'N/A');
    addFourColumnRow('Insured Name', this.claim.policy?.insuredName || 'N/A', 'Claim No', this.claim.reportNo || 'N/A');
    addFourColumnRow('Insured Address', this.claim.policy?.insuredAddress || 'N/A', 'Date of Loss', this.claim.accident?.dateAndTime || 'N/A');
    addFourColumnRow('Mobile No', this.claim.policy?.insuredMobile || 'N/A', 'Place of Loss', this.claim.accident?.placeOfAccident || 'N/A');
    
    currRow++;
    addSectionHeader('II. VEHICLE DETAILS');
    addFourColumnRow('Registration No', this.claim.vehicle?.registrationNumber || 'N/A', 'Chassis No', this.claim.vehicle?.chassisNumber || 'N/A');
    addFourColumnRow('Engine No', this.claim.vehicle?.engineNumber || 'N/A', 'Make & Model', `${this.claim.vehicle?.make || ''} ${this.claim.vehicle?.model || ''}`);
    addFourColumnRow('Color', this.claim.vehicle?.colour || 'N/A', 'Fuel Type', this.claim.vehicle?.fuel || 'N/A');
    addFourColumnRow('Odometer', this.claim.vehicle?.odometer || 'N/A', 'Date of Reg', this.claim.vehicle?.dateOfRegistration || 'N/A');

    addSectionHeader('III. DRIVER DETAILS');
    addFourColumnRow('Driver Name', this.claim.driver?.name || 'N/A', 'Licence No', this.claim.driver?.licenceNumber || 'N/A');
    addFourColumnRow('Date of Issue', this.claim.driver?.dateOfIssue || 'N/A', 'Issuing Authority', this.claim.driver?.issuingAuthority || 'N/A');
    addFourColumnRow('Validity (NT)', this.claim.driver?.validityNonTransport || 'N/A', 'Validity (T)', this.claim.driver?.validityTransport || 'N/A');
    addFourColumnRow('Class of Vehicle', this.claim.driver?.vehicleClass || 'N/A', 'Date of Birth', this.claim.driver?.dateOfBirth || 'N/A');

    currRow++;
    addSectionHeader('IV. ACCIDENT DETAILS');
    addFourColumnRow('Date & Time', this.claim.accident?.dateAndTime || 'N/A', 'Place of Loss', this.claim.accident?.placeOfAccident || 'N/A');
    addFourColumnRow('Cause of Accident', this.claim.accident?.causeOfAccident || 'N/A', 'Place of Survey', this.claim.accident?.placeOfSurvey || 'N/A');
    
    currRow++;
    addSectionHeader('V. ASSESSMENT DETAILS');
    
    const tableHeaderRow = this.worksheet.getRow(currRow);
    const headers = ['Sr.', 'Description of Parts', 'Qty', 'Rate', 'Depr %', 'Depr Amt', '', 'Net Amount'];
    headers.forEach((h, i) => {
        const cell = tableHeaderRow.getCell(i + 1);
        cell.value = h;
        this.styleCell(cell, { bold: true, bg: this.GREEN_UIIC, color: 'FFFFFF', align: 'center' });
    });
    this.worksheet.mergeCells(`F${currRow}:G${currRow}`);
    currRow++;

    // Spares
    const parts = this.claim.assessmentRows.filter(r => r.section === 'parts');
    parts.forEach((p, idx) => {
        const row = this.worksheet.getRow(currRow);
        row.getCell(1).value = idx + 1;
        row.getCell(2).value = p.particulars;
        row.getCell(3).value = 1; // Qty
        row.getCell(4).value = p.assessed;
        row.getCell(5).value = 0; // Depr %
        
        row.getCell(6).value = { formula: `(C${currRow}*D${currRow})*(E${currRow}/100)` };
        this.worksheet.mergeCells(`F${currRow}:G${currRow}`);
        row.getCell(8).value = { formula: `(C${currRow}*D${currRow})-F${currRow}` };

        [1,2,3,4,5,6,8].forEach(c => this.styleCell(row.getCell(c)));
        row.getCell(6).numFmt = '#,##0.00';
        row.getCell(8).numFmt = '#,##0.00';
        currRow++;
    });

    // Total Spares
    this.worksheet.mergeCells(`A${currRow}:G${currRow}`);
    const labS = this.worksheet.getCell(`A${currRow}`);
    labS.value = 'TOTAL SPARE PARTS (A)';
    this.styleCell(labS, { bold: true, align: 'right' });
    const valS = this.worksheet.getCell(`H${currRow}`);
    valS.value = parts.length > 0 ? { formula: `SUM(H${currRow - parts.length}:H${currRow - 1})` } : 0;
    this.styleCell(valS, { bold: true });
    const finalSparesRow = currRow;
    currRow += 2;

    addSectionHeader('VI. LABOUR CHARGES');
    const labours = this.claim.assessmentRows.filter(r => r.section === 'labour');
    const labourStartRow = currRow;
    labours.forEach((l, idx) => {
       const row = this.worksheet.getRow(currRow);
       row.getCell(1).value = idx + 1;
       this.worksheet.mergeCells(`B${currRow}:G${currRow}`);
       row.getCell(2).value = l.particulars;
       row.getCell(8).value = l.assessed;
       [1,2,8].forEach(c => this.styleCell(row.getCell(c)));
       currRow++;
    });
    const labourEndRow = currRow - 1;

    // Total Labour
    this.worksheet.mergeCells(`A${currRow}:G${currRow}`);
    const labL = this.worksheet.getCell(`A${currRow}`);
    labL.value = 'TOTAL LABOUR CHARGES (B)';
    this.styleCell(labL, { bold: true, align: 'right' });
    const valL = this.worksheet.getCell(`H${currRow}`);
    valL.value = labours.length > 0 ? { formula: `SUM(H${labourStartRow}:H${labourEndRow})` } : 0;
    this.styleCell(valL, { bold: true });
    const finalLabourRow = currRow;
    currRow += 2;

    addSectionHeader('VII. FINAL LIABILITY SUMMARY');
    const addSummRow = (label: string, val: any, bold = false) => {
        this.worksheet.mergeCells(`A${currRow}:G${currRow}`);
        const l = this.worksheet.getCell(`A${currRow}`);
        const v = this.worksheet.getCell(`H${currRow}`);
        l.value = label; v.value = val;
        this.styleCell(l, { bold });
        this.styleCell(v, { bold });
        v.numFmt = '#,##0.00';
        currRow++;
    };

    addSummRow('Total (A + B)', { formula: `H${finalSparesRow} + H${finalLabourRow}` }, true);
    addSummRow('Less: Salvage', this.summary.salvage || 0);
    addSummRow('Less: Compulsory Excess', this.summary.compulsoryExcess || 0);
    addSummRow('NET LIABILITY OF INSURER', { formula: `H${currRow - 3} - H${currRow - 2} - H${currRow - 1}` }, true);

    currRow += 3;
    this.worksheet.mergeCells(`A${currRow}:C${currRow + 4}`);
    const finalSign = this.worksheet.getCell(`A${currRow}`);
    finalSign.value = `Faithfully yours,\n\n\n\n${this.profile.name}\n${this.profile.licenceNumber}\n(Insurance Surveyor & Loss Assessor)`;
    this.styleCell(finalSign, { align: 'left', border: false });
    finalSign.alignment = { ...finalSign.alignment, vertical: 'top' };

    // Export
    const buffer = await this.workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `UIIC-Final-Report-${this.claim.vehicle?.registrationNumber || 'Claim'}.xlsx`);
  }
}
