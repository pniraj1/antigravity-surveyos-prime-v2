# Graph Report - .  (2026-04-19)

## Corpus Check
- 177 files · ~286,628 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 335 nodes · 592 edges · 23 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `getDB()` - 16 edges
2. `driveRequest()` - 9 edges
3. `buildProvider()` - 7 edges
4. `getOrCreateClaimFolder()` - 7 edges
5. `getRootFolder()` - 6 edges
6. `generateIRDAISummary()` - 6 edges
7. `callAIGateway()` - 5 edges
8. `getDriveToken()` - 5 edges
9. `loadDriveIndex()` - 5 edges
10. `saveDriveIndex()` - 5 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (4): fetchAllProfiles(), handleApprove(), getNestedValue(), getReconciliationFields()

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (13): formatDateDMY(), formatDateTimeDMY(), buildSpotFeeBillDocument(), buildSpotFeeBillHTML(), triggerSpotFeeBillPrint(), buildStandardFinalSurveyHTML(), buildStandardPrintDocument(), fmt2() (+5 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (2): formatDateDMY(), formatDateTimeDMY()

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (0): 

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (17): addToDriveQueue(), addToSyncQueue(), deleteClaim(), getAllClaims(), getClaim(), getDB(), getDriveQueue(), getDriveQueueCount() (+9 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (4): applyDepreciation(), getAgeLabel(), getDepPolicyLabel(), getDepreciationRate()

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (15): extractBankStatement(), parseCsvTransactions(), AITaskQueue, extractDocument(), buildProvider(), callAIGateway(), callWithKey(), callWithRotation() (+7 more)

### Community 7 - "Community 7"
Cohesion: 0.32
Nodes (12): clearStoredToken(), createFolder(), driveRequest(), findFolder(), flushDriveQueue(), getDriveToken(), getIndexFileId(), getOrCreateClaimFolder() (+4 more)

### Community 8 - "Community 8"
Cohesion: 0.23
Nodes (9): buildUIICBillCheckHTML(), buildUIICBillCheckPrintDocument(), buildUIICFinalHTML(), buildUIICFinalPrintDocument(), fa(), fd(), g(), triggerUIICBillCheckPrint() (+1 more)

### Community 9 - "Community 9"
Cohesion: 0.23
Nodes (8): buildAnalytics(), buildClaimRegister(), buildInsurerSummary(), buildMonthSummary(), filterClaimsForExport(), generateIRDAISummary(), getFYLabel(), getFYRange()

### Community 10 - "Community 10"
Cohesion: 0.22
Nodes (0): 

### Community 11 - "Community 11"
Cohesion: 0.27
Nodes (5): fetchData(), handleRestore(), pushClaimToCloud(), stripPhotos(), syncAllLocalToCloud()

### Community 12 - "Community 12"
Cohesion: 0.29
Nodes (0): 

### Community 13 - "Community 13"
Cohesion: 0.33
Nodes (0): 

### Community 14 - "Community 14"
Cohesion: 0.47
Nodes (1): UIICExcelBuilder

### Community 15 - "Community 15"
Cohesion: 0.4
Nodes (1): ErrorBoundary

### Community 16 - "Community 16"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 16`** (2 nodes): `gen_chunks.py`, `make_node()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (2 nodes): `extract.js`, `extractPdf()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (1 nodes): `extract_pdf.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (1 nodes): `uiic-html-builder.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (1 nodes): `telemetry.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._