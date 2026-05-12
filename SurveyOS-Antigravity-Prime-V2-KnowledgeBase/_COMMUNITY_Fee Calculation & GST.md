---
type: community
cohesion: 0.13
members: 20
---

# Fee Calculation & GST

**Cohesion:** 0.13 - loosely connected
**Members:** 20 nodes

## Members
- [[buildAnalytics()]] - code - src\lib\reports\irdai-summary-builder.ts
- [[buildClaimRegister()]] - code - src\lib\reports\irdai-summary-builder.ts
- [[buildClaimRow()]] - code - src\lib\reports\irdai-summary-builder.ts
- [[buildInsurerSummary()]] - code - src\lib\reports\irdai-summary-builder.ts
- [[buildMonthSummary()]] - code - src\lib\reports\irdai-summary-builder.ts
- [[calculateFeeGST()]] - code - src\lib\calculations\gst.ts
- [[calculateFeeSummary()]] - code - src\lib\calculations\fees.ts
- [[calculateLabourGST()]] - code - src\lib\calculations\gst.ts
- [[calculatePartsGST()]] - code - src\lib\calculations\gst.ts
- [[dataCell()]] - code - src\lib\reports\irdai-summary-builder.ts
- [[fees.ts]] - code - src\lib\calculations\fees.ts
- [[filterClaimsForExport()]] - code - src\lib\reports\irdai-summary-builder.ts
- [[generateIRDAISummary()]] - code - src\lib\reports\irdai-summary-builder.ts
- [[getCurrentFY()]] - code - src\lib\reports\irdai-summary-builder.ts
- [[getFYLabel()]] - code - src\lib\reports\irdai-summary-builder.ts
- [[getFYRange()]] - code - src\lib\reports\irdai-summary-builder.ts
- [[getFeeLineItems()]] - code - src\lib\calculations\fees.ts
- [[gst.ts]] - code - src\lib\calculations\gst.ts
- [[headerCell()]] - code - src\lib\reports\irdai-summary-builder.ts
- [[irdai-summary-builder.ts]] - code - src\lib\reports\irdai-summary-builder.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Fee_Calculation_&_GST
SORT file.name ASC
```

## Connections to other communities
- 3 edges to [[_COMMUNITY_UI Components & Forms]]
- 1 edge to [[_COMMUNITY_Claim Data Model & Billing]]
- 1 edge to [[_COMMUNITY_Assessment Grid & Evidence]]

## Top bridge nodes
- [[irdai-summary-builder.ts]] - degree 17, connects to 3 communities
- [[fees.ts]] - degree 5, connects to 1 community