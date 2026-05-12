---
type: community
cohesion: 0.06
members: 58
---

# Claim Data Model & Billing

**Cohesion:** 0.06 - loosely connected
**Members:** 58 nodes

## Members
- [[BillCheckDocument()]] - code - src\components\pdf\BillCheckDocument.tsx
- [[BillCheckDocument.tsx]] - code - src\components\pdf\BillCheckDocument.tsx
- [[FeeBillDocument.tsx]] - code - src\components\pdf\FeeBillDocument.tsx
- [[ReportTab.tsx]] - code - src\components\tabs\ReportTab.tsx
- [[SpotActions.tsx]] - code - src\components\tabs\report\SpotActions.tsx
- [[SurveyActions.tsx]] - code - src\components\tabs\report\SurveyActions.tsx
- [[async()]] - code - src\components\tabs\report\SpotActions.tsx
- [[buildReinspectionHTML()]] - code - src\lib\reports\reinspection-report-builder.ts
- [[buildSpotFeeBillDocument()]] - code - src\lib\reports\spot-fee-bill-builder.ts
- [[buildSpotFeeBillHTML()]] - code - src\lib\reports\spot-fee-bill-builder.ts
- [[buildStandardFinalSurveyHTML()]] - code - src\lib\reports\standard-report-builder.ts
- [[buildStandardPrintDocument()]] - code - src\lib\reports\standard-report-builder.ts
- [[buildUIICBillCheckHTML()]] - code - src\lib\reports\uiic-final-builder.ts
- [[buildUIICBillCheckPrintDocument()]] - code - src\lib\reports\uiic-final-builder.ts
- [[buildUIICFinalHTML()]] - code - src\lib\reports\uiic-final-builder.ts
- [[buildUIICFinalPrintDocument()]] - code - src\lib\reports\uiic-final-builder.ts
- [[buildValuationReportHTML()]] - code - src\lib\reports\valuation-report-builder.ts
- [[claim.ts]] - code - src\types\claim.ts
- [[createBlankClaim()]] - code - src\types\claim.ts
- [[createKVRow()]] - code - src\lib\reports\word-builder.ts
- [[fa()]] - code - src\lib\reports\reinspection-report-builder.ts
- [[fa()_1]] - code - src\lib\reports\report-utils.ts
- [[fa()_2]] - code - src\lib\reports\uiic-final-builder.ts
- [[fd()_1]] - code - src\lib\reports\reinspection-report-builder.ts
- [[fd()_2]] - code - src\lib\reports\uiic-final-builder.ts
- [[fd()]] - code - src\lib\reports\valuation-report-builder.ts
- [[fmt2()]] - code - src\lib\reports\standard-report-builder.ts
- [[formatDateDMY()_1]] - code - src\lib\reports\report-utils.ts
- [[formatDateTimeDMY()_1]] - code - src\lib\reports\report-utils.ts
- [[formatDateTimeDMY()_2]] - code - src\lib\reports\word-builder.ts
- [[g()_2]] - code - src\lib\reports\reinspection-report-builder.ts
- [[g()_3]] - code - src\lib\reports\uiic-final-builder.ts
- [[g()_1]] - code - src\lib\reports\valuation-report-builder.ts
- [[generateSpotWordReport()]] - code - src\lib\reports\word-builder.ts
- [[generateWordReport()]] - code - src\lib\reports\word-builder.ts
- [[getDepRate()]] - code - src\lib\reports\standard-report-builder.ts
- [[getDepRate()_1]] - code - src\lib\reports\uiic-final-builder.ts
- [[getSigBlock()]] - code - src\lib\reports\report-utils.ts
- [[getSurveyorHeader()]] - code - src\lib\reports\report-utils.ts
- [[getVehicleAgeMonths()_1]] - code - src\lib\reports\report-utils.ts
- [[isExpired()]] - code - src\lib\reports\standard-report-builder.ts
- [[normalizeVehicleNumber()]] - code - src\lib\utils\vehicle.ts
- [[numberToWords()_1]] - code - src\lib\reports\report-utils.ts
- [[reinspection-report-builder.ts]] - code - src\lib\reports\reinspection-report-builder.ts
- [[report-utils.ts]] - code - src\lib\reports\report-utils.ts
- [[report.ts]] - code - src\types\report.ts
- [[spot-fee-bill-builder.ts]] - code - src\lib\reports\spot-fee-bill-builder.ts
- [[standard-report-builder.ts]] - code - src\lib\reports\standard-report-builder.ts
- [[triggerReinspectionPrint()]] - code - src\lib\reports\reinspection-report-builder.ts
- [[triggerSpotFeeBillPrint()]] - code - src\lib\reports\spot-fee-bill-builder.ts
- [[triggerStandardPrint()]] - code - src\lib\reports\standard-report-builder.ts
- [[triggerUIICBillCheckPrint()]] - code - src\lib\reports\uiic-final-builder.ts
- [[triggerUIICFinalPrint()]] - code - src\lib\reports\uiic-final-builder.ts
- [[uiic-final-builder.ts]] - code - src\lib\reports\uiic-final-builder.ts
- [[valuation-report-builder.ts]] - code - src\lib\reports\valuation-report-builder.ts
- [[vehicle.ts]] - code - src\types\vehicle.ts
- [[vehicleNumbersMatch()]] - code - src\lib\utils\vehicle.ts
- [[word-builder.ts]] - code - src\lib\reports\word-builder.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Claim_Data_Model_&_Billing
SORT file.name ASC
```

## Connections to other communities
- 10 edges to [[_COMMUNITY_UI Components & Forms]]
- 3 edges to [[_COMMUNITY_AI Review Dialog]]
- 1 edge to [[_COMMUNITY_Bill Check Grid]]
- 1 edge to [[_COMMUNITY_Assessment Grid & Evidence]]
- 1 edge to [[_COMMUNITY_Fee Calculation & GST]]
- 1 edge to [[_COMMUNITY_UIIC Excel Builder]]

## Top bridge nodes
- [[claim.ts]] - degree 14, connects to 3 communities
- [[ReportTab.tsx]] - degree 11, connects to 3 communities
- [[uiic-final-builder.ts]] - degree 17, connects to 2 communities
- [[standard-report-builder.ts]] - degree 12, connects to 1 community
- [[vehicle.ts]] - degree 12, connects to 1 community