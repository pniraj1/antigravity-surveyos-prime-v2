// ═══════════════════════════════════════════════════════════
// REPORT TEMPLATE CONFIG TYPES
// Config-driven report format system (JSON per insurer)
// ═══════════════════════════════════════════════════════════

export type ReportType = 'final' | 'spot' | 'bill-check' | 'reinspection' | 'fee-bill' | 'photo-sheet';

export type SurveyType = 'spot' | 'final';

export interface ReportFieldMapping {
  /** Label shown in the report */
  label: string;
  /** Key path into ClaimData to read the value, e.g. "vehicle.registrationNumber" */
  dataPath: string;
  /** Optional formatter: 'date', 'datetime', 'currency', 'monospace' */
  format?: 'date' | 'datetime' | 'currency' | 'monospace' | 'uppercase';
  /** If true, row spans the full width */
  fullWidth?: boolean;
}

export interface ReportSection {
  /** Section heading text */
  title: string;
  /** Section number shown in report, e.g. "1", "A" */
  sectionId: string;
  /** Fields in this section */
  fields: ReportFieldMapping[];
  /** Conditional: only show for certain vehicle types */
  vehicleTypes?: ('private' | 'comm-passenger' | 'comm-goods')[];
}

export interface ReportTemplate {
  /** Unique template ID, e.g. "standard", "uiic", "oriental" */
  id: string;
  /** Human-readable name */
  name: string;
  /** Insurer name this template is designed for, or "Standard" */
  insurer: string;
  /** Which report types this template supports */
  reportTypes: ReportType[];
  /** Page layout */
  layout: {
    pageSize: 'A4';
    orientation: 'portrait' | 'landscape';
    margins: { top: number; right: number; bottom: number; left: number };
    fontFamily: string;
    baseFontSize: number;
    headerColor: string;
    sectionHeaderBg: string;
    sectionHeaderColor: string;
  };
  /** Header configuration */
  header: {
    showSurveyorHeader: boolean;
    reportTitle: string;
    subtitle?: string;
    showConfidential: boolean;
    showDisclaimer: boolean;
    disclaimerText?: string;
  };
  /** Sections in order */
  sections: ReportSection[];
  /** Footer configuration */
  footer: {
    showSignatureBlock: boolean;
    showEnclosures: boolean;
    enclosureText?: string;
    showDisclaimer: boolean;
    disclaimerText?: string;
  };
}
