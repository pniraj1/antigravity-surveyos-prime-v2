# Graph Report - .  (2026-07-18)

## Corpus Check
- 0 files · ~99,999 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1241 nodes · 1830 edges · 152 communities detected
- Extraction: 98% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.72)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `ClaimData` - 36 edges
2. `getDB()` - 28 edges
3. `driveRequest()` - 17 edges
4. `syncClaim` - 13 edges
5. `buildStandardFinalSurveyHTML` - 13 edges
6. `buildUIICFinalHTML` - 11 edges
7. `buildProvider()` - 10 edges
8. `getDriveToken()` - 10 edges
9. `extractDocument` - 10 edges
10. `applyExtractedData()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `stripPhotos` --calls--> `sanitize()`  [EXTRACTED]
  src/lib/firebase/sync.ts → src\lib\firebase\sync.ts
- `UIICExcelBuilder` --semantically_similar_to--> `generateIRDAISummary`  [INFERRED] [semantically similar]
  src/lib/reports/uiic-excel-builder.ts → src/lib/reports/irdai-summary-builder.ts
- `SyncClaimSummary` --semantically_similar_to--> `ClaimData`  [INFERRED] [semantically similar]
  src/lib/sync-bridge/types.ts → src/types/claim.ts
- `AppTab` --conceptually_related_to--> `ClaimData`  [AMBIGUOUS]
  src/stores/ui-store.ts → src/types/claim.ts
- `types barrel export` --conceptually_related_to--> `ClaimData`  [AMBIGUOUS]
  src/types/index.ts → src/types/claim.ts

## Hyperedges (group relationships)
- **AI Document Extraction Pipeline** — useAIExtraction_triggerExtraction, processor_extractDocument, service_callAIGateway, prompts_getDocPrompt [INFERRED 0.85]
- **Single-Session Lock + Kick + Logout Reset Flow** — useAuth_useAuth, useSessionHeartbeat_useSessionHeartbeat, resetAllState_resetAllState [INFERRED 0.85]
- **Insured Report 3-Pass AI Pipeline** — insuredReport_runPolicyAnalysis, insuredReport_runAssessmentAnalysis, insuredReport_runGenerateNarrative, insuredReport_generateInsuredReport [INFERRED 0.90]
- **Version-guarded push -> conflict detection -> Option B recovery** — sync_pushClaimToCloud, syncguard_canOverwrite, sync_recoverFromConflict [INFERRED 0.90]
- **Single-session lock: claim -> heartbeat freshness check -> ownership-checked release** — fbsession_claimSession, fbsession_isSessionFresh, fbsession_releaseSession [INFERRED 0.85]
- **Duplicate-safe Drive backup: serialized single-claim backup feeds the pending-claims sweep** — drive_backupClaimToDrive, drive_performClaimBackup, drive_backupAllPendingToDrive [INFERRED 0.85]
- **HTML Report Builder Family (window.open→print, shared report-utils.ts header/sig block)** — standardreportbuilder_buildStandardFinalSurveyHTML, uiicfinalbuilder_buildUIICFinalHTML, spotfeebillbuilder_buildSpotFeeBillHTML [INFERRED 0.85]
- **Claim Sync State Tracking Trio (claims = source of truth; pushTracking/driveTracking = device-local sync watermarks)** — indexeddb_claimsStore, indexeddb_pushTrackingStore, indexeddb_driveTrackingStore [INFERRED 0.80]
- **Local Folder Sync Pipeline (manifest diff → file placement → download)** — syncmanifest_diffManifest, syncengine_syncClaim, nomenclature_placeFile [INFERRED 0.90]
- **Claim store composed from 4 slices** — claimstore_useClaimStore, claimSlice_createClaimSlice, vehicleSlice_createVehicleSlice, assessmentSlice_createAssessmentSlice, aiDataSlice_createAIDataSlice [INFERRED 0.90]
- **ClaimData composed of domain sub-objects** — typesclaim_ClaimData, typesvehicle_VehicleDetails, typesassessment_AssessmentRow, typesassessment_SpotSurveyDetails [INFERRED 0.85]
- **AI-extracted document data reconciled into claim via key-specific mappers** — aiDataSlice_applyExtractedData, aiDataSlice_applyRC, aiDataSlice_applyPolicy, aiDataSlice_applyFinalBill, typesclaim_ClaimData [INFERRED 0.85]

## Communities

### Community 0 - "Community 0"
Cohesion: 0.03
Nodes (10): handleKeyDown(), handleSend(), handleFile(), processFile(), formatDateDMY(), formatDateTimeDMY(), addRow(), deleteRow() (+2 more)

### Community 1 - "Community 1"
Cohesion: 0.02
Nodes (13): composeFinalSurveyPreamble(), preambleFromClaim(), rs(), handleReferralReward(), verifyPayment(), getDaysRemaining(), isInWarningPeriod(), getExpiry() (+5 more)

### Community 2 - "Community 2"
Cohesion: 0.03
Nodes (9): ErrorBoundary, assessed(), depRate(), flushAllPendingToCloud(), pushClaimToCloud(), recoverFromConflict(), sanitize(), stripPhotos() (+1 more)

### Community 3 - "Community 3"
Cohesion: 0.03
Nodes (26): extractBankStatement(), parseCsvTransactions(), buildPreClassifiedExplanations(), derivePolicyContext(), enrichTaggedRows(), generateInsuredReport(), runAssessmentAnalysis(), runPolicyAnalysis() (+18 more)

### Community 4 - "Community 4"
Cohesion: 0.04
Nodes (68): AIDataSlice, applyAuth(), applyClaim(), applyDL(), applyEstimate(), applyExtractedData(), applyFinalBill(), applyFitness() (+60 more)

### Community 5 - "Community 5"
Cohesion: 0.04
Nodes (16): resetDefaults(), saveVisibility(), showAll(), toggleColumn(), applyDepreciation(), getAgeLabel(), getDepPolicyLabel(), getDepreciationRate() (+8 more)

### Community 6 - "Community 6"
Cohesion: 0.05
Nodes (34): buildReinspectionHTML(), fa(), fd(), g(), triggerReinspectionPrint(), getHtmlScale(), getScaleConfig(), getWordScale() (+26 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (32): adminKey(), refresh(), runTest(), fetchGroqModels(), fetchNvidiaModels(), fetchOpenAIStyleModels(), mapList(), computeEstimateCapacity() (+24 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (26): extFor(), fetchSyncDocFile(), fetchSyncDocFileAt(), getSyncClaim(), listSyncClaims(), parse(), db(), getStoredRootHandle() (+18 more)

### Community 9 - "Community 9"
Cohesion: 0.05
Nodes (47): extractBankStatement, parseCsvTransactions, getIRDAIStandardClauses (fallback policy clauses), buildHonestFallback, buildPreClassifiedExplanations, derivePolicyContext, enrichTaggedRows (Pass 2.5), generateInsuredReport (3-pass pipeline) (+39 more)

### Community 10 - "Community 10"
Cohesion: 0.1
Nodes (30): addRecoveredClaim(), addToDriveQueue(), addToSyncQueue(), deleteClaim(), getAllClaims(), getAllDriveBackedAt(), getAllPushedAt(), getClaim() (+22 more)

### Community 11 - "Community 11"
Cohesion: 0.14
Nodes (24): backupAllPendingToDrive(), backupClaimToDrive(), backupProfileToDrive(), clearStoredToken(), createFolder(), deleteFile(), downloadFileAsBase64(), driveRequest() (+16 more)

### Community 12 - "Community 12"
Cohesion: 0.1
Nodes (32): composeFinalSurveyPreamble, estimateTotalInclGst, preambleFromClaim, rs, Rationale: desktop gold-standard reference HTML files are never modified; builders are pixel-perfect ports, Rationale: statutory 'issued without prejudice' disclaimer subject to policy T&C, Rationale: report-utils.ts is the single source of truth shared across print builders (sync checklist), buildReinspectionHTML (+24 more)

### Community 13 - "Community 13"
Cohesion: 0.08
Nodes (31): ClaimGroup, filterAndGroupClaims, getAllClaims, claimFolderName, extFor, placeFile, sanitizeSegment, Rationale: receivedDocsAtSync change detection can only under-count, never false-mark synced (+23 more)

### Community 14 - "Community 14"
Cohesion: 0.09
Nodes (24): backupAllPendingToDrive, backupClaimToDrive, performClaimBackup, Idempotent duplicate-safe backup sweep; skips already-current claims; failures heal next call, Refuse overwrite only when cloud is strictly newer — optimistic-concurrency guard, Claim backup is best-effort and never throws — Firestore remains source of truth, Option B recovery: stash refused local copy, adopt newer remote, notify surveyor — nothing lost, Serialize every Drive backup through one promise chain — duplicate-safe against concurrent triggers (+16 more)

### Community 15 - "Community 15"
Cohesion: 0.22
Nodes (13): applyAuth(), applyClaim(), applyDL(), applyFinalBill(), applyFitness(), applyLokChallan(), applyPermit(), applyPolicy() (+5 more)

### Community 16 - "Community 16"
Cohesion: 0.3
Nodes (9): claimSession(), getDeviceHint(), getDeviceId(), isSessionFresh(), isSessionMine(), readActiveSession(), releaseSession(), sessionRef() (+1 more)

### Community 17 - "Community 17"
Cohesion: 0.18
Nodes (12): claims object store, deleteClaim, driveTracking object store, pushTracking object store, setDriveBackedAt, setPushedAt, Rationale: driveTracking is device-local knowledge of Drive backup status, Rationale: pushTracking guards against remote overwriting locally-dirty claims (+4 more)

### Community 18 - "Community 18"
Cohesion: 0.18
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 0.22
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 0.22
Nodes (9): resetAllState (logout state wipe), Rationale: clears Drive/profile/claim-list state, leaves IndexedDB and Firestore intact, Rationale: DB init/close wired to onAuthStateChanged, Rationale: intentional logout guard blocks silent re-auth, Rationale: pullProfileFromCloud before setUser prevents admin redirect flash, Rationale: single-session lock fails open on error, useAuth hook, Rationale: heartbeat + deviceId mismatch detection forces sign-out on kick (+1 more)

### Community 21 - "Community 21"
Cohesion: 0.22
Nodes (9): buildAnalytics, buildClaimRegister, buildClaimRow, buildInsurerSummary, buildMonthSummary, generateIRDAISummary, getFYLabel, Rationale: multi-sheet workbook generated for IRDAI annual regulatory return submission (+1 more)

### Community 22 - "Community 22"
Cohesion: 0.25
Nodes (8): deleteFile, getDriveToken, getOrCreateClaimFolder, listFilesInFolder, uploadFileToDrive, Upload never fails silently — queues to IndexedDB for retry and always toasts, generateSuffixedName, uploadWithDuplicateCheck

### Community 23 - "Community 23"
Cohesion: 0.43
Nodes (4): buildFields(), getConflictFields(), getNestedValue(), getUnanimousFields()

### Community 24 - "Community 24"
Cohesion: 0.29
Nodes (7): useAutoSave hook (Layer 1 IndexedDB), Rationale: delta sync from lastSyncTimestamp, full sync fallback on first login, milestonePushRef (milestone push fn), Rationale: push on milestones (tab/claim switch, close, hide) not continuously, Security note: backupProfileToDrive writes API keys to user's own Drive intentionally, useCloudSync hook (Layer 2/3), Rationale: visibilitychange fires reliably before freeze/close unlike beforeunload

### Community 25 - "Community 25"
Cohesion: 0.47
Nodes (1): UIICExcelBuilder

### Community 26 - "Community 26"
Cohesion: 0.33
Nodes (6): fetchGroqModels, fetchNvidiaModels, isLikelyVisionModel, mapList, PROVIDER_IMAGE_CAPS, computeEstimateCapacity

### Community 27 - "Community 27"
Cohesion: 0.4
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 0.4
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 0.4
Nodes (5): FIELD_MAPPINGS (AI key -> claim path), Rationale: conflict flagged only when values genuinely disagree, never unset fields, getConflictFields, FIELD_MAP (claim field -> docType/aiKey), useFieldEvidence hook

### Community 30 - "Community 30"
Cohesion: 0.4
Nodes (5): calculations index barrel, DEDUCTION_CATEGORIES, computeInsuredFinancialSummary, Use pre-GST billedTaxable so negotiated savings aren't distorted by GST, insuredPays floored at zero — insurer never owes insured more than garage bill

### Community 31 - "Community 31"
Cohesion: 0.4
Nodes (5): flushDriveQueue, linkGoogleDrive, silentlyRestoreDriveToken, Always show account picker so surveyor consciously chooses the linked Drive account, Silent auth failure never disconnects — cached token in localStorage may still be valid

### Community 32 - "Community 32"
Cohesion: 0.67
Nodes (2): drawFrame(), resizeCanvas()

### Community 33 - "Community 33"
Cohesion: 0.5
Nodes (4): calculateFeeSummary, getFeeLineItems, calculateFeeGST, Legacy travelExpenses fallback keeps old claims totaling correctly

### Community 34 - "Community 34"
Cohesion: 0.5
Nodes (4): isSessionMine, readActiveSession, releaseSession, Release session only if this device still owns it — never delete another device's force-claimed doc; non-fatal on error

### Community 35 - "Community 35"
Cohesion: 0.5
Nodes (4): getWordScale, createKVRow, generateSpotWordReport, generateWordReport

### Community 36 - "Community 36"
Cohesion: 0.5
Nodes (4): getDB, initUserDB, migrateFromLegacyDB, Rationale: per-user IndexedDB for shared-PC isolation

### Community 37 - "Community 37"
Cohesion: 0.5
Nodes (4): addRecoveredClaim, getRecoveredClaims, recoveredClaims object store, Rationale: recoveredClaims is the Option B stash for superseded sync-conflict copies

### Community 38 - "Community 38"
Cohesion: 0.5
Nodes (4): BridgeFileMeta, BridgeResponse<T>, SyncClaimDetail, SyncDocMeta

### Community 39 - "Community 39"
Cohesion: 0.67
Nodes (3): Rationale: use history.pushState not router.push to avoid full reload in static export, Rationale: stale-URL guard prevents reload from URL after closeClaim clears store, useRouteSync hook

### Community 40 - "Community 40"
Cohesion: 0.67
Nodes (3): getVehicleAgeMonths, runGenerateNarrative (Pass 3), buildCoveringNarrativePrompt

### Community 41 - "Community 41"
Cohesion: 0.67
Nodes (3): CTL_THRESHOLD = 0.75, Rationale: IRDA/industry CTL threshold 75% of IDV, surveyor makes final call via UI toggle, detectCTL (constructive total loss)

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (3): calculateAssessmentSummary, calculateBillCheckSummary, getDepreciationRate

### Community 43 - "Community 43"
Cohesion: 0.67
Nodes (3): FRESHNESS_WINDOW_MS, isSessionFresh, Session is LIVE only while heartbeat is fresh; crashed/closed tab goes stale so next device can claim without a fight

### Community 44 - "Community 44"
Cohesion: 0.67
Nodes (3): REMARK_REQUIRED_CATEGORIES, SELF_EXPLAINING_CATEGORIES, Self-explaining categories never block; judgment-call categories require a remark

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (2): Rationale: stale-while-revalidate — cached data first, then Drive fetch, useClaimDriveFiles hook

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (2): Rationale: block report when deduction reason can't be inferred from data alone, getBlockingRows (report generation gate)

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (2): loadAIModelsConfig, useAIConfig hook

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (2): AITaskQueue (sequential throttle), Rationale: sequential queue prevents API rate limiting per user request

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (2): SOURCE_PRIORITY, getBestSourceValue

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (2): driveRequest, 401 response clears connected state so the Drive gate re-engages

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (2): signInWithGoogle, Always show Google account picker so logout feels real instead of silent re-selection

### Community 53 - "Community 53"
Cohesion: 1.0
Nodes (2): getFirebaseApp, API key must come from env/CI secrets, never committed; public config values are safe to commit; keys are restricted by Firestore Rules + Auth

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (2): getDeviceId, Device UUID persisted in localStorage so same-device re-login avoids a false conflict

### Community 55 - "Community 55"
Cohesion: 1.0
Nodes (2): claimSession, getDeviceHint

### Community 56 - "Community 56"
Cohesion: 1.0
Nodes (2): ponytail: deleted claim's Drive folder (claim.json with PII) not cleaned up — deferred, tracked as F5, syncTombstones

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (2): formatDateDMY, Never hand numeric slash dates to new Date() — avoids US MM/DD/YYYY misread

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (2): Signatures, stamps and API keys stay local/Drive-only, never pushed to cloud profile, pushProfileToCloud

### Community 59 - "Community 59"
Cohesion: 1.0
Nodes (2): getLocalFile, Local disk read never throws — callers fall back to the Worker on any failure

### Community 60 - "Community 60"
Cohesion: 1.0
Nodes (2): mailto: hand-off avoids API keys, quotas, and backend dependencies, sendEmail

### Community 61 - "Community 61"
Cohesion: 1.0
Nodes (2): filterClaimsForExport, getFYRange

### Community 62 - "Community 62"
Cohesion: 1.0
Nodes (2): StorageFullError, saveClaim

### Community 63 - "Community 63"
Cohesion: 1.0
Nodes (2): addToDriveQueue, driveQueue object store

### Community 64 - "Community 64"
Cohesion: 1.0
Nodes (2): Rationale: Sync bridge client is read-only, authenticated via per-surveyor bearer token, redeemLinkCode

### Community 65 - "Community 65"
Cohesion: 1.0
Nodes (2): Rationale: 'compact' scale is a guaranteed no-op baseline for backward compatibility, SCALE_TABLE

### Community 66 - "Community 66"
Cohesion: 1.0
Nodes (2): ReportSection, ReportTemplate

### Community 67 - "Community 67"
Cohesion: 1.0
Nodes (1): Why claimSlice.resetStore exists (prevent cross-surveyor data leak)

### Community 68 - "Community 68"
Cohesion: 1.0
Nodes (0): 

### Community 69 - "Community 69"
Cohesion: 1.0
Nodes (0): 

### Community 70 - "Community 70"
Cohesion: 1.0
Nodes (0): 

### Community 71 - "Community 71"
Cohesion: 1.0
Nodes (0): 

### Community 72 - "Community 72"
Cohesion: 1.0
Nodes (1): useAIExtraction hook

### Community 73 - "Community 73"
Cohesion: 1.0
Nodes (1): useClaimsLoader hook

### Community 74 - "Community 74"
Cohesion: 1.0
Nodes (1): BankTransaction type

### Community 75 - "Community 75"
Cohesion: 1.0
Nodes (1): saveAIModelsConfig (admin-only)

### Community 76 - "Community 76"
Cohesion: 1.0
Nodes (1): mergeWithFallback

### Community 77 - "Community 77"
Cohesion: 1.0
Nodes (1): getUnanimousFields

### Community 78 - "Community 78"
Cohesion: 1.0
Nodes (1): createAssessmentRow

### Community 79 - "Community 79"
Cohesion: 1.0
Nodes (1): applyDepreciation

### Community 80 - "Community 80"
Cohesion: 1.0
Nodes (1): FeeSummary

### Community 81 - "Community 81"
Cohesion: 1.0
Nodes (1): calculatePartsGST

### Community 82 - "Community 82"
Cohesion: 1.0
Nodes (1): calculateLabourGST

### Community 83 - "Community 83"
Cohesion: 1.0
Nodes (1): computeRowNet

### Community 84 - "Community 84"
Cohesion: 1.0
Nodes (1): numberToWords

### Community 85 - "Community 85"
Cohesion: 1.0
Nodes (1): formatDateTimeDMY

### Community 86 - "Community 86"
Cohesion: 1.0
Nodes (1): formatCurrency

### Community 87 - "Community 87"
Cohesion: 1.0
Nodes (1): formatCurrencyShort

### Community 88 - "Community 88"
Cohesion: 1.0
Nodes (1): parseDateToISO

### Community 89 - "Community 89"
Cohesion: 1.0
Nodes (1): generateId

### Community 90 - "Community 90"
Cohesion: 1.0
Nodes (1): toggleFeePaid

### Community 91 - "Community 91"
Cohesion: 1.0
Nodes (1): stageVariant

### Community 92 - "Community 92"
Cohesion: 1.0
Nodes (1): CATEGORY_LABELS

### Community 93 - "Community 93"
Cohesion: 1.0
Nodes (1): backupProfileToDrive

### Community 94 - "Community 94"
Cohesion: 1.0
Nodes (1): restoreProfileFromDrive

### Community 95 - "Community 95"
Cohesion: 1.0
Nodes (1): restoreClaimFromDrive

### Community 96 - "Community 96"
Cohesion: 1.0
Nodes (1): buildApprovalEmail

### Community 97 - "Community 97"
Cohesion: 1.0
Nodes (1): buildDismissalEmail

### Community 98 - "Community 98"
Cohesion: 1.0
Nodes (1): signOutUser

### Community 99 - "Community 99"
Cohesion: 1.0
Nodes (1): submitPayment

### Community 100 - "Community 100"
Cohesion: 1.0
Nodes (1): verifyPayment

### Community 101 - "Community 101"
Cohesion: 1.0
Nodes (1): rejectPayment

### Community 102 - "Community 102"
Cohesion: 1.0
Nodes (1): handleReferralReward

### Community 103 - "Community 103"
Cohesion: 1.0
Nodes (1): countUnsynced

### Community 104 - "Community 104"
Cohesion: 1.0
Nodes (1): pullProfileFromCloud

### Community 105 - "Community 105"
Cohesion: 1.0
Nodes (1): getLastSyncTimestamp

### Community 106 - "Community 106"
Cohesion: 1.0
Nodes (1): isLocalSyncSupported

### Community 107 - "Community 107"
Cohesion: 1.0
Nodes (1): pickRootFolder

### Community 108 - "Community 108"
Cohesion: 1.0
Nodes (1): ensureReadWrite

### Community 109 - "Community 109"
Cohesion: 1.0
Nodes (1): FileSystemAccess ambient declarations

### Community 110 - "Community 110"
Cohesion: 1.0
Nodes (1): getClaimRecordedDocs

### Community 111 - "Community 111"
Cohesion: 1.0
Nodes (1): PlaceInput

### Community 112 - "Community 112"
Cohesion: 1.0
Nodes (1): FilePlacement

### Community 113 - "Community 113"
Cohesion: 1.0
Nodes (1): SyncProgress

### Community 114 - "Community 114"
Cohesion: 1.0
Nodes (1): ClaimRef

### Community 115 - "Community 115"
Cohesion: 1.0
Nodes (1): RemoteFile

### Community 116 - "Community 116"
Cohesion: 1.0
Nodes (1): ManifestEntry

### Community 117 - "Community 117"
Cohesion: 1.0
Nodes (1): ClaimSyncState

### Community 118 - "Community 118"
Cohesion: 1.0
Nodes (1): useLocalSync

### Community 119 - "Community 119"
Cohesion: 1.0
Nodes (1): ensureRoot

### Community 120 - "Community 120"
Cohesion: 1.0
Nodes (1): PreambleInputs

### Community 121 - "Community 121"
Cohesion: 1.0
Nodes (1): IRDAIExportOptions

### Community 122 - "Community 122"
Cohesion: 1.0
Nodes (1): ClaimRow

### Community 123 - "Community 123"
Cohesion: 1.0
Nodes (1): getCurrentFY

### Community 124 - "Community 124"
Cohesion: 1.0
Nodes (1): HtmlFontScale

### Community 125 - "Community 125"
Cohesion: 1.0
Nodes (1): WordFontScale

### Community 126 - "Community 126"
Cohesion: 1.0
Nodes (1): FontScaleConfig

### Community 127 - "Community 127"
Cohesion: 1.0
Nodes (1): getScaleConfig

### Community 128 - "Community 128"
Cohesion: 1.0
Nodes (1): formatDateTimeDMY

### Community 129 - "Community 129"
Cohesion: 1.0
Nodes (1): closeUserDB

### Community 130 - "Community 130"
Cohesion: 1.0
Nodes (1): getClaim

### Community 131 - "Community 131"
Cohesion: 1.0
Nodes (1): syncQueue object store

### Community 132 - "Community 132"
Cohesion: 1.0
Nodes (1): learning object store

### Community 133 - "Community 133"
Cohesion: 1.0
Nodes (1): tombstones object store

### Community 134 - "Community 134"
Cohesion: 1.0
Nodes (1): driveFileCache object store

### Community 135 - "Community 135"
Cohesion: 1.0
Nodes (1): getAllPushedAt

### Community 136 - "Community 136"
Cohesion: 1.0
Nodes (1): getAllDriveBackedAt

### Community 137 - "Community 137"
Cohesion: 1.0
Nodes (1): calculateSubscriptionState

### Community 138 - "Community 138"
Cohesion: 1.0
Nodes (1): getDaysRemaining

### Community 139 - "Community 139"
Cohesion: 1.0
Nodes (1): isInWarningPeriod

### Community 140 - "Community 140"
Cohesion: 1.0
Nodes (1): isExpired

### Community 141 - "Community 141"
Cohesion: 1.0
Nodes (1): generateReferralCode

### Community 142 - "Community 142"
Cohesion: 1.0
Nodes (1): calculateTrialEndDate

### Community 143 - "Community 143"
Cohesion: 1.0
Nodes (1): addDaysToDate

### Community 144 - "Community 144"
Cohesion: 1.0
Nodes (1): SyncHealth

### Community 145 - "Community 145"
Cohesion: 1.0
Nodes (1): SyncClaimResult

### Community 146 - "Community 146"
Cohesion: 1.0
Nodes (1): logger

### Community 147 - "Community 147"
Cohesion: 1.0
Nodes (1): DEFAULT_PROFILE

### Community 148 - "Community 148"
Cohesion: 1.0
Nodes (1): AssessmentSummary

### Community 149 - "Community 149"
Cohesion: 1.0
Nodes (1): InsuredReportSettings

### Community 150 - "Community 150"
Cohesion: 1.0
Nodes (1): SubscriptionState

### Community 151 - "Community 151"
Cohesion: 1.0
Nodes (0): 

## Ambiguous Edges - Review These
- `LocalManifest` → `claims object store`  [AMBIGUOUS]
  src/lib/local-sync/sync-manifest.ts · relation: conceptually_related_to
- `BridgeResponse<T>` → `SyncClaimDetail`  [AMBIGUOUS]
  src/lib/sync-bridge/types.ts · relation: conceptually_related_to
- `vehicleNumbersMatch()` → `VehicleDetails`  [AMBIGUOUS]
  src/lib/utils/vehicle.ts · relation: conceptually_related_to
- `useAIConfigStore` → `SurveyorProfile`  [AMBIGUOUS]
  src/stores/ai-config-store.ts · relation: conceptually_related_to
- `incrementReportNo()` → `Ponytail: 2-digit fiscal year vs sequence number ambiguity`  [AMBIGUOUS]
  src/stores/profile-store.ts · relation: rationale_for
- `AppTab` → `ClaimData`  [AMBIGUOUS]
  src/stores/ui-store.ts · relation: conceptually_related_to
- `ClaimData` → `types barrel export`  [AMBIGUOUS]
  src/types/index.ts · relation: conceptually_related_to
- `PaymentRecord` → `SurveyorProfile`  [AMBIGUOUS]
  src/types/payment.ts · relation: conceptually_related_to
- `TelemetryPayload` → `LearningData`  [AMBIGUOUS]
  src/types/telemetry.ts · relation: conceptually_related_to

## Knowledge Gaps
- **272 isolated node(s):** `useAIConfig hook`, `useAIExtraction hook`, `buildFocusHint`, `targetPageIndices`, `triggerExtraction` (+267 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 45`** (2 nodes): `sitemap.ts`, `sitemap()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (2 nodes): `Rationale: stale-while-revalidate — cached data first, then Drive fetch`, `useClaimDriveFiles hook`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (2 nodes): `Rationale: block report when deduction reason can't be inferred from data alone`, `getBlockingRows (report generation gate)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (2 nodes): `loadAIModelsConfig`, `useAIConfig hook`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (2 nodes): `AITaskQueue (sequential throttle)`, `Rationale: sequential queue prevents API rate limiting per user request`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (2 nodes): `SOURCE_PRIORITY`, `getBestSourceValue`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (2 nodes): `driveRequest`, `401 response clears connected state so the Drive gate re-engages`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (2 nodes): `signInWithGoogle`, `Always show Google account picker so logout feels real instead of silent re-selection`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (2 nodes): `getFirebaseApp`, `API key must come from env/CI secrets, never committed; public config values are safe to commit; keys are restricted by Firestore Rules + Auth`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (2 nodes): `getDeviceId`, `Device UUID persisted in localStorage so same-device re-login avoids a false conflict`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (2 nodes): `claimSession`, `getDeviceHint`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (2 nodes): `ponytail: deleted claim's Drive folder (claim.json with PII) not cleaned up — deferred, tracked as F5`, `syncTombstones`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (2 nodes): `formatDateDMY`, `Never hand numeric slash dates to new Date() — avoids US MM/DD/YYYY misread`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (2 nodes): `Signatures, stamps and API keys stay local/Drive-only, never pushed to cloud profile`, `pushProfileToCloud`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (2 nodes): `getLocalFile`, `Local disk read never throws — callers fall back to the Worker on any failure`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (2 nodes): `mailto: hand-off avoids API keys, quotas, and backend dependencies`, `sendEmail`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (2 nodes): `filterClaimsForExport`, `getFYRange`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (2 nodes): `StorageFullError`, `saveClaim`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (2 nodes): `addToDriveQueue`, `driveQueue object store`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (2 nodes): `Rationale: Sync bridge client is read-only, authenticated via per-surveyor bearer token`, `redeemLinkCode`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (2 nodes): `Rationale: 'compact' scale is a guaranteed no-op baseline for backward compatibility`, `SCALE_TABLE`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (2 nodes): `ReportSection`, `ReportTemplate`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (2 nodes): `resetStore()`, `Why claimSlice.resetStore exists (prevent cross-surveyor data leak)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (2 nodes): `subscription.js`, `isSubscriptionActive()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (1 nodes): `fs-access.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (1 nodes): `uiic-html-builder.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (1 nodes): `telemetry.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72`** (1 nodes): `useAIExtraction hook`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (1 nodes): `useClaimsLoader hook`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 74`** (1 nodes): `BankTransaction type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 75`** (1 nodes): `saveAIModelsConfig (admin-only)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 76`** (1 nodes): `mergeWithFallback`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 77`** (1 nodes): `getUnanimousFields`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 78`** (1 nodes): `createAssessmentRow`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 79`** (1 nodes): `applyDepreciation`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 80`** (1 nodes): `FeeSummary`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 81`** (1 nodes): `calculatePartsGST`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 82`** (1 nodes): `calculateLabourGST`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 83`** (1 nodes): `computeRowNet`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 84`** (1 nodes): `numberToWords`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 85`** (1 nodes): `formatDateTimeDMY`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 86`** (1 nodes): `formatCurrency`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 87`** (1 nodes): `formatCurrencyShort`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 88`** (1 nodes): `parseDateToISO`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 89`** (1 nodes): `generateId`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 90`** (1 nodes): `toggleFeePaid`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 91`** (1 nodes): `stageVariant`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 92`** (1 nodes): `CATEGORY_LABELS`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 93`** (1 nodes): `backupProfileToDrive`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 94`** (1 nodes): `restoreProfileFromDrive`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 95`** (1 nodes): `restoreClaimFromDrive`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 96`** (1 nodes): `buildApprovalEmail`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 97`** (1 nodes): `buildDismissalEmail`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 98`** (1 nodes): `signOutUser`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 99`** (1 nodes): `submitPayment`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 100`** (1 nodes): `verifyPayment`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 101`** (1 nodes): `rejectPayment`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 102`** (1 nodes): `handleReferralReward`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 103`** (1 nodes): `countUnsynced`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 104`** (1 nodes): `pullProfileFromCloud`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 105`** (1 nodes): `getLastSyncTimestamp`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 106`** (1 nodes): `isLocalSyncSupported`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 107`** (1 nodes): `pickRootFolder`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 108`** (1 nodes): `ensureReadWrite`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 109`** (1 nodes): `FileSystemAccess ambient declarations`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 110`** (1 nodes): `getClaimRecordedDocs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 111`** (1 nodes): `PlaceInput`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 112`** (1 nodes): `FilePlacement`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 113`** (1 nodes): `SyncProgress`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 114`** (1 nodes): `ClaimRef`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 115`** (1 nodes): `RemoteFile`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 116`** (1 nodes): `ManifestEntry`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 117`** (1 nodes): `ClaimSyncState`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 118`** (1 nodes): `useLocalSync`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 119`** (1 nodes): `ensureRoot`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 120`** (1 nodes): `PreambleInputs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 121`** (1 nodes): `IRDAIExportOptions`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 122`** (1 nodes): `ClaimRow`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 123`** (1 nodes): `getCurrentFY`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 124`** (1 nodes): `HtmlFontScale`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 125`** (1 nodes): `WordFontScale`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 126`** (1 nodes): `FontScaleConfig`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 127`** (1 nodes): `getScaleConfig`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 128`** (1 nodes): `formatDateTimeDMY`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 129`** (1 nodes): `closeUserDB`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 130`** (1 nodes): `getClaim`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 131`** (1 nodes): `syncQueue object store`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 132`** (1 nodes): `learning object store`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 133`** (1 nodes): `tombstones object store`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 134`** (1 nodes): `driveFileCache object store`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 135`** (1 nodes): `getAllPushedAt`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 136`** (1 nodes): `getAllDriveBackedAt`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 137`** (1 nodes): `calculateSubscriptionState`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 138`** (1 nodes): `getDaysRemaining`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 139`** (1 nodes): `isInWarningPeriod`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 140`** (1 nodes): `isExpired`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 141`** (1 nodes): `generateReferralCode`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 142`** (1 nodes): `calculateTrialEndDate`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 143`** (1 nodes): `addDaysToDate`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 144`** (1 nodes): `SyncHealth`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 145`** (1 nodes): `SyncClaimResult`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 146`** (1 nodes): `logger`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 147`** (1 nodes): `DEFAULT_PROFILE`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 148`** (1 nodes): `AssessmentSummary`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 149`** (1 nodes): `InsuredReportSettings`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 150`** (1 nodes): `SubscriptionState`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 151`** (1 nodes): `subscription.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.