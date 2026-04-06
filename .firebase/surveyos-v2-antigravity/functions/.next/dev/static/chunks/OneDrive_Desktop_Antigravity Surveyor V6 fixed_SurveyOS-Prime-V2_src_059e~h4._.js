(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/stores/ui-store.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useUIStore",
    ()=>useUIStore
]);
// ═══════════════════════════════════════════════════════════
// UI STATE STORE — Zustand
// Tab navigation, sidebar, and global UI state
// Replaces: switchTab(), sidebar toggle from legacy
// ═══════════════════════════════════════════════════════════
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/zustand/esm/react.mjs [app-client] (ecmascript)");
;
const useUIStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["create"])()((set)=>({
        activeTab: 'dashboard',
        previousTab: null,
        sidebarCollapsed: false,
        sidebarMobileOpen: false,
        isNewClaimDialogOpen: false,
        isClaimsListOpen: false,
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        isDriveConnected: false,
        driveEmail: '',
        setActiveTab: (tab)=>{
            set((state)=>({
                    activeTab: tab,
                    previousTab: state.activeTab,
                    sidebarMobileOpen: false
                }));
        },
        toggleSidebar: ()=>{
            set((state)=>({
                    sidebarCollapsed: !state.sidebarCollapsed
                }));
        },
        setSidebarMobileOpen: (open)=>set({
                sidebarMobileOpen: open
            }),
        setNewClaimDialogOpen: (open)=>set({
                isNewClaimDialogOpen: open
            }),
        setClaimsListOpen: (open)=>set({
                isClaimsListOpen: open
            }),
        setOnline: (online)=>set({
                isOnline: online
            }),
        setDriveConnected: (connected, email = '')=>{
            set({
                isDriveConnected: connected,
                driveEmail: email
            });
        }
    }));
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/stores/profile-store.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useProfileStore",
    ()=>useProfileStore
]);
// ═══════════════════════════════════════════════════════════
// SURVEYOR PROFILE STORE — Zustand + localStorage persistence
// Replaces: loadProfile() / saveProfile() from legacy
// ═══════════════════════════════════════════════════════════
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/zustand/esm/react.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/zustand/esm/middleware.mjs [app-client] (ecmascript)");
;
;
const DEFAULT_PROFILE = {
    name: '',
    qualifications: '',
    licenceNumber: '',
    licenceExpiry: '',
    iiislaNumber: '',
    code: '',
    categories: 'MOTOR',
    mobile: '',
    email: '',
    address: '',
    gstNumber: '',
    bankName: '',
    bankAccount: '',
    bankIFSC: '',
    panNumber: '',
    groqApiKey: '',
    groqModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
    googleClientId: '',
    signatureDataUrl: null,
    stampDataUrl: null
};
const useProfileStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["create"])()((0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["persist"])((set, get)=>({
        profile: {
            ...DEFAULT_PROFILE
        },
        updateProfile: (updates)=>{
            set((state)=>({
                    profile: {
                        ...state.profile,
                        ...updates
                    }
                }));
        },
        getInitials: ()=>{
            const name = get().profile.name;
            return name.split(' ').map((w)=>w[0]).join('').substring(0, 2).toUpperCase() || 'SP';
        }
    }), {
    name: 'surveyos-profile'
}));
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/types/vehicle.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// ═══════════════════════════════════════════════════════════
// VEHICLE, DRIVER & POLICY TYPES
// Mirrors legacy Surveyor_V6_MASTER.html field structure
// ═══════════════════════════════════════════════════════════
__turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/types/assessment.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// ═══════════════════════════════════════════════════════════
// ASSESSMENT ENGINE TYPES
// Mirrors: assessRows[], spotDamageRows[], riParts[], recalcSummary()
// from Surveyor_V6_MASTER.html
// ═══════════════════════════════════════════════════════════
__turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/types/claim.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// ═══════════════════════════════════════════════════════════
// MASTER CLAIM DATA INTERFACE
// The single source of truth for all claim state.
// This structure must be able to perfectly reconstruct
// the entire UI state from a serialized JSON file.
// See: SURVEYOS_V2_MASTER_BOOK.md Chapter 6, Section 4
// ═══════════════════════════════════════════════════════════
__turbopack_context__.s([
    "createBlankClaim",
    ()=>createBlankClaim
]);
function createBlankClaim(surveyType = 'final', vehicleType = 'private') {
    const now = new Date().toISOString();
    const id = `claim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
        id,
        createdAt: now,
        updatedAt: now,
        surveyType,
        vehicleType,
        depreciationType: 'standard',
        reportNo: '',
        reportDate: now.split('T')[0],
        vehicle: {
            registrationNumber: '',
            make: '',
            model: '',
            yearOfManufacture: null,
            chassisNumber: '',
            engineNumber: '',
            cubicCapacity: '',
            colour: '',
            bodyType: '',
            classOfVehicle: '',
            fuel: '',
            dateOfRegistration: '',
            hypothecation: '',
            fitnessNo: '',
            route: '',
            grossWeight: null,
            unladenWeight: null,
            registeredLoadWeight: '',
            odometer: '',
            preAccidentCondition: '',
            seatingCapacity: ''
        },
        driver: {
            name: '',
            parentName: '',
            relationType: 'S/o',
            licenceNumber: '',
            dateOfBirth: '',
            dateOfIssue: '',
            issuingAuthority: '',
            vehicleClasses: '',
            validityNonTransport: '',
            validityTransport: '',
            verificationStatus: 'verified',
            invalidRemarks: ''
        },
        policy: {
            policyNumber: '',
            claimNumber: '',
            insurerName: '',
            insuredName: '',
            insuredAddress: '',
            insuredMobile: '',
            idv: '',
            policyType: '',
            periodFrom: '',
            periodTo: '',
            policyIssuingOffice: '',
            appointingOffice: '',
            hpaWith: ''
        },
        accident: {
            dateAndTime: '',
            placeOfAccident: '',
            causeOfAccident: '',
            dateOfSurvey: '',
            placeOfSurvey: '',
            thirdPartyDetails: ''
        },
        assessmentRows: [],
        spotDetails: {
            reportNo: '',
            reportDate: '',
            allotmentDate: '',
            surveyDatetime: '',
            surveyPlace: '',
            driverName: '',
            dlParentName: '',
            dlRelation: '',
            mdlNo: '',
            dlAuthority: '',
            dlType: '',
            dlIssueDate: '',
            dlValidNT: '',
            dlValidT: '',
            mdlVerified: '',
            dlInvalidRemarks: '',
            tpInvolved: 'no',
            tpDetails: '',
            policeReported: 'no',
            policeStation: '',
            diaryNo: '',
            panchanama: 'no',
            damageSeverity: 'moderate',
            airbags: 'no',
            drivable: 'yes',
            comments: '',
            repairs: '',
            enclosures: '',
            permitNo: '',
            permitType: '',
            permitFrom: '',
            permitTo: '',
            fitnessNo: '',
            fitnessValid: '',
            authNo: '',
            authValid: '',
            gvw: null,
            ulw: null,
            loadCapacity: null,
            actualLoad: null,
            challanNo: '',
            challanDate: '',
            loadDesc: '',
            loadOrigin: '',
            loadDest: ''
        },
        spotDamageRows: [],
        reinspection: {
            refNo: '',
            date: '',
            surveyRef: '',
            surveyDate: '',
            repairQuality: 'satisfactory',
            vehicleCondition: 'roadworthy',
            salvageStatus: 'na',
            observations: '',
            parts: []
        },
        feeBill: {
            billDate: '',
            professionalFee: 0,
            riFee: 0,
            travelExpenses: 0,
            travelNote: '',
            photosCount: 0,
            photoRate: 0,
            postalCharges: 0,
            haltageCharges: 0,
            includeGST: false,
            advanceReceipt: '',
            cashReceived: ''
        },
        photos: [],
        photoLayout: 6,
        photoLandscape: false,
        extractedData: {},
        gDriveFolderId: null,
        telemetrySent: false
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/types/report.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// ═══════════════════════════════════════════════════════════
// REPORT TEMPLATE CONFIG TYPES
// Config-driven report format system (JSON per insurer)
// ═══════════════════════════════════════════════════════════
__turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/types/telemetry.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// ═══════════════════════════════════════════════════════════
// HIVE MIND TELEMETRY PAYLOAD
// ~5-10KB JSON sent silently on report finalization
// See: SURVEYOS_V2_MASTER_BOOK.md Chapter 4
// ═══════════════════════════════════════════════════════════
__turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/types/index.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
// Barrel export for all types
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$types$2f$vehicle$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/types/vehicle.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$types$2f$assessment$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/types/assessment.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$types$2f$claim$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/types/claim.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$types$2f$report$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/types/report.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$types$2f$telemetry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/types/telemetry.ts [app-client] (ecmascript)");
;
;
;
;
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/depreciation.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// ═══════════════════════════════════════════════════════════
// DEPRECIATION ENGINE
// Exact mirror of getDepRate() + getVehicleAgeMonths()
// from Surveyor_V6_MASTER.html lines 1841-1859
// ═══════════════════════════════════════════════════════════
__turbopack_context__.s([
    "applyDepreciation",
    ()=>applyDepreciation,
    "getAgeLabel",
    ()=>getAgeLabel,
    "getDepPolicyLabel",
    ()=>getDepPolicyLabel,
    "getDepreciationRate",
    ()=>getDepreciationRate,
    "getVehicleAgeMonths",
    ()=>getVehicleAgeMonths
]);
function getVehicleAgeMonths(registrationDate, yearOfManufacture, referenceDate) {
    let start = null;
    if (registrationDate) {
        start = new Date(registrationDate);
    } else if (yearOfManufacture) {
        start = new Date(yearOfManufacture, 0, 1); // Jan 1 of manufacture year
    }
    if (!start || isNaN(start.getTime())) return 0;
    const ref = referenceDate ? new Date(referenceDate) : new Date();
    if (isNaN(ref.getTime()) || ref < start) return 0;
    return (ref.getFullYear() - start.getFullYear()) * 12 + ref.getMonth() - start.getMonth();
}
function getDepreciationRate(partType, ageMonths, policyType) {
    // Nil depreciation and Zero dep policies = 0% on everything
    if (policyType === 'nil' || policyType === 'zero') return 0;
    // Standard IRDAI depreciation
    if (partType === 'glass') return 0;
    if (partType === 'plastic') return 50;
    if (partType === 'labour' || partType === 'paint') return 0;
    // Metal — age-based scale
    if (ageMonths <= 6) return 0;
    if (ageMonths <= 12) return 5;
    if (ageMonths <= 24) return 10;
    if (ageMonths <= 36) return 15;
    if (ageMonths <= 48) return 25;
    if (ageMonths <= 60) return 35;
    if (ageMonths <= 120) return 40;
    return 50;
}
function applyDepreciation(assessedAmount, partType, ageMonths, policyType) {
    const rate = getDepreciationRate(partType, ageMonths, policyType);
    return assessedAmount * (1 - rate / 100);
}
function getAgeLabel(ageMonths) {
    if (ageMonths <= 0) return '';
    const years = Math.floor(ageMonths / 12);
    const months = ageMonths % 12;
    return `${years}yr ${months}mo`;
}
function getDepPolicyLabel(policyType, ageMonths) {
    switch(policyType){
        case 'nil':
            return 'Nil Depreciation';
        case 'zero':
            return 'Zero Dep Policy';
        case 'standard':
        default:
            return `Standard IRDAI ${getAgeLabel(ageMonths)}`;
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/gst.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// ═══════════════════════════════════════════════════════════
// GST CALCULATION ENGINE
// Mirrors: recalcSummary() GST logic from
// Surveyor_V6_MASTER.html lines 1896-1910
//
// Parts: 9% CGST + 9% SGST = 18% total (applied on base)
// Labour: 18% GST flat (single line)
// ═══════════════════════════════════════════════════════════
__turbopack_context__.s([
    "calculateFeeGST",
    ()=>calculateFeeGST,
    "calculateLabourGST",
    ()=>calculateLabourGST,
    "calculatePartsGST",
    ()=>calculatePartsGST
]);
function calculatePartsGST(partsBase) {
    const cgst = partsBase * 0.09;
    const sgst = partsBase * 0.09;
    return {
        baseAmount: partsBase,
        cgst,
        sgst,
        igst: 0,
        totalGST: cgst + sgst,
        totalWithGST: partsBase + cgst + sgst
    };
}
function calculateLabourGST(labourBase) {
    const gst = labourBase * 0.18;
    return {
        baseAmount: labourBase,
        cgst: gst / 2,
        sgst: gst / 2,
        igst: 0,
        totalGST: gst,
        totalWithGST: labourBase + gst
    };
}
function calculateFeeGST(feeTotal) {
    const gst = feeTotal * 0.18;
    return {
        baseAmount: feeTotal,
        cgst: gst / 2,
        sgst: gst / 2,
        igst: 0,
        totalGST: gst,
        totalWithGST: feeTotal + gst
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/utils.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// Mirrors from Surveyor_V6_MASTER.html:
//   numberToWords()    — lines 2056-2062
//   formatDateDMY()    — lines 2064-2078
//   formatDateTimeDMY()— lines 2080-2087
//   fmt2() / fa()      — currency formatting
// ═══════════════════════════════════════════════════════════
/**
 * Convert a number to Indian English words.
 * Supports Lakh/Crore system (Indian numbering).
 * Legacy: numberToWords() — lines 2056-2062
 */ __turbopack_context__.s([
    "formatCurrency",
    ()=>formatCurrency,
    "formatCurrencyShort",
    ()=>formatCurrencyShort,
    "formatDateDMY",
    ()=>formatDateDMY,
    "formatDateTimeDMY",
    ()=>formatDateTimeDMY,
    "generateId",
    ()=>generateId,
    "numberToWords",
    ()=>numberToWords,
    "parseDateToISO",
    ()=>parseDateToISO
]);
function numberToWords(num) {
    if (!num || isNaN(num)) return 'ZERO';
    const ones = [
        '',
        'ONE',
        'TWO',
        'THREE',
        'FOUR',
        'FIVE',
        'SIX',
        'SEVEN',
        'EIGHT',
        'NINE',
        'TEN',
        'ELEVEN',
        'TWELVE',
        'THIRTEEN',
        'FOURTEEN',
        'FIFTEEN',
        'SIXTEEN',
        'SEVENTEEN',
        'EIGHTEEN',
        'NINETEEN'
    ];
    const tens = [
        '',
        '',
        'TWENTY',
        'THIRTY',
        'FORTY',
        'FIFTY',
        'SIXTY',
        'SEVENTY',
        'EIGHTY',
        'NINETY'
    ];
    function convert(n) {
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
        if (n < 1000) return ones[Math.floor(n / 100)] + ' HUNDRED' + (n % 100 ? ' ' + convert(n % 100) : '');
        if (n < 100000) return convert(Math.floor(n / 1000)) + ' THOUSAND' + (n % 1000 ? ' ' + convert(n % 1000) : '');
        if (n < 10000000) return convert(Math.floor(n / 100000)) + ' LAKH' + (n % 100000 ? ' ' + convert(n % 100000) : '');
        return convert(Math.floor(n / 10000000)) + ' CRORE' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
    }
    return convert(Math.floor(num));
}
function formatDateDMY(value) {
    if (!value) return '—';
    const dStr = String(value).split('T')[0];
    const parts = dStr.split('-');
    if (parts.length === 3) {
        // ISO format: YYYY-MM-DD
        if (parts[0].length === 4) {
            return `${parts[2]}.${parts[1]}.${parts[0]}`;
        }
        // DD-MM-YYYY
        if (parts[2].length === 4) {
            return `${parts[0]}.${parts[1]}.${parts[2]}`;
        }
    }
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
        return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
    }
    return value;
}
function formatDateTimeDMY(value) {
    if (!value) return '—';
    const s = String(value);
    const datePart = formatDateDMY(s.split('T')[0]);
    const timePart = s.includes('T') ? s.split('T')[1].substring(0, 5) : '';
    return timePart && timePart !== '00:00' ? `${datePart} at ${timePart} hrs` : datePart;
}
function formatCurrency(value) {
    return '₹ ' + value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function formatCurrencyShort(value) {
    const num = typeof value === 'string' ? parseFloat(value) || 0 : value;
    return '₹' + num.toLocaleString('en-IN');
}
function parseDateToISO(value) {
    if (!value) return '';
    const v = String(value).trim();
    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    // DD/MM/YYYY or DD-MM-YYYY
    const m = v.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (m) {
        return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    return v;
}
function generateId(prefix = 'id') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/assessment.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// ═══════════════════════════════════════════════════════════
// ASSESSMENT SUMMARY ENGINE
// Mirrors: recalcSummary() from Surveyor_V6_MASTER.html
// lines 1896-1910 — the core financial brain
// ═══════════════════════════════════════════════════════════
__turbopack_context__.s([
    "calculateAssessmentSummary",
    ()=>calculateAssessmentSummary,
    "createAssessmentRow",
    ()=>createAssessmentRow
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$depreciation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/depreciation.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$gst$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/gst.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/utils.ts [app-client] (ecmascript)");
;
;
;
function calculateAssessmentSummary(rows, ageMonths, depType, salvage = 0, excess = 500) {
    let metal = 0;
    let plastic = 0;
    let glass = 0;
    let labourBase = 0;
    // ─── Parts: apply depreciation and bucket ───────────
    rows.filter((r)=>r.section === 'parts').forEach((r)=>{
        if (!r.allowed) return;
        const depRate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$depreciation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDepreciationRate"])(r.partType, ageMonths, depType);
        const afterDep = r.assessed * (1 - depRate / 100);
        if (r.partType === 'metal') metal += afterDep;
        else if (r.partType === 'glass') glass += afterDep;
        else plastic += afterDep; // plastic/rubber
    });
    // ─── Labour + Paint: no depreciation ────────────────
    rows.filter((r)=>r.section === 'labour' || r.section === 'paint').forEach((r)=>{
        if (r.allowed) labourBase += r.assessed;
    });
    // ─── GST calculations ──────────────────────────────
    const partsBase = metal + plastic + glass;
    const partsGST = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$gst$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculatePartsGST"])(partsBase);
    const labourGST = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$gst$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateLabourGST"])(labourBase);
    // ─── Totals ────────────────────────────────────────
    const grandTotal = partsGST.totalWithGST + labourGST.totalWithGST;
    const netAssessedLoss = Math.max(0, grandTotal - salvage - excess);
    // ─── Estimated total (for comparison) ──────────────
    let totalEstimated = 0;
    rows.forEach((r)=>{
        totalEstimated += r.estimated * (1 + r.gst / 100);
    });
    return {
        metalTotal: metal,
        plasticTotal: plastic,
        glassTotal: glass,
        partsBase,
        partsCGST: partsGST.cgst,
        partsSGST: partsGST.sgst,
        partsTotal: partsGST.totalWithGST,
        labourBase,
        labourGST: labourGST.totalGST,
        labourTotal: labourGST.totalWithGST,
        grandTotal,
        salvage,
        excess,
        netAssessedLoss,
        netInWords: `RUPEES ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["numberToWords"])(netAssessedLoss)} ONLY`,
        totalEstimated
    };
}
function createAssessmentRow(section, overrides) {
    return {
        id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        particulars: '',
        estimated: 0,
        assessed: 0,
        partType: section === 'labour' ? 'labour' : section === 'paint' ? 'paint' : 'metal',
        gst: 18,
        section,
        allowed: true,
        ...overrides
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/fees.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// ═══════════════════════════════════════════════════════════
// FEE BILL CALCULATOR
// Mirrors: calcFeeTotal() + buildFeeBillHTML() from
// Surveyor_V6_MASTER.html lines 2036-2044, 2396-2414
// ═══════════════════════════════════════════════════════════
__turbopack_context__.s([
    "calculateFeeSummary",
    ()=>calculateFeeSummary,
    "getFeeLineItems",
    ()=>getFeeLineItems
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$gst$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/gst.ts [app-client] (ecmascript)");
;
function calculateFeeSummary(fee) {
    const photographyCharges = fee.photosCount * fee.photoRate;
    const subTotal = fee.professionalFee + fee.riFee + fee.travelExpenses + photographyCharges + fee.postalCharges + fee.haltageCharges;
    const gstAmount = fee.includeGST ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$gst$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateFeeGST"])(subTotal).totalGST : 0;
    const grandTotal = subTotal + gstAmount;
    return {
        professionalFee: fee.professionalFee,
        riFee: fee.riFee,
        travelExpenses: fee.travelExpenses,
        photographyCharges,
        postalCharges: fee.postalCharges,
        haltageCharges: fee.haltageCharges,
        subTotal,
        gstAmount,
        grandTotal
    };
}
function getFeeLineItems(fee, regNo = '') {
    const items = [
        {
            label: `Professional Survey Fee — ${regNo || 'Vehicle'}`,
            amount: fee.professionalFee
        },
        {
            label: 'RI Inspection Fee',
            amount: fee.riFee
        },
        {
            label: `Travel Expenses — ${fee.travelNote || ''}`,
            amount: fee.travelExpenses
        },
        {
            label: `Photography Charges (${fee.photosCount} photos × ₹${fee.photoRate})`,
            amount: fee.photosCount * fee.photoRate
        },
        {
            label: 'Postal / Courier Charges',
            amount: fee.postalCharges
        },
        {
            label: 'Haltage Charges',
            amount: fee.haltageCharges
        }
    ];
    return items.filter((item)=>item.amount > 0);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/index.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
// Barrel export for calculations engine
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$depreciation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/depreciation.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$gst$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/gst.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$assessment$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/assessment.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$fees$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/fees.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/utils.ts [app-client] (ecmascript)");
;
;
;
;
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/stores/claim-store.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useClaimStore",
    ()=>useClaimStore
]);
// ═══════════════════════════════════════════════════════════
// CENTRAL CLAIM STORE — Zustand
// Replaces all legacy window.* global state
// ═══════════════════════════════════════════════════════════
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/zustand/esm/react.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/zustand/esm/middleware.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$types$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/types/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$types$2f$claim$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/types/claim.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$assessment$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/assessment.ts [app-client] (ecmascript)");
;
;
;
;
const useClaimStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["create"])()((0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["devtools"])((set)=>({
        currentClaim: null,
        currentClaimId: null,
        isDirty: false,
        claimsList: [],
        newClaim: (surveyType, vehicleType)=>{
            const claim = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$types$2f$claim$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createBlankClaim"])(surveyType, vehicleType);
            set({
                currentClaim: claim,
                currentClaimId: claim.id,
                isDirty: false
            });
        },
        loadClaim: (claim)=>{
            set({
                currentClaim: {
                    ...claim
                },
                currentClaimId: claim.id,
                isDirty: false
            });
        },
        updateClaim: (updates)=>{
            set((state)=>({
                    currentClaim: state.currentClaim ? {
                        ...state.currentClaim,
                        ...updates,
                        updatedAt: new Date().toISOString()
                    } : null,
                    isDirty: true
                }));
        },
        updateVehicle: (updates)=>{
            set((state)=>({
                    currentClaim: state.currentClaim ? {
                        ...state.currentClaim,
                        vehicle: {
                            ...state.currentClaim.vehicle,
                            ...updates
                        },
                        updatedAt: new Date().toISOString()
                    } : null,
                    isDirty: true
                }));
        },
        updateDriver: (updates)=>{
            set((state)=>({
                    currentClaim: state.currentClaim ? {
                        ...state.currentClaim,
                        driver: {
                            ...state.currentClaim.driver,
                            ...updates
                        },
                        updatedAt: new Date().toISOString()
                    } : null,
                    isDirty: true
                }));
        },
        updatePolicy: (updates)=>{
            set((state)=>({
                    currentClaim: state.currentClaim ? {
                        ...state.currentClaim,
                        policy: {
                            ...state.currentClaim.policy,
                            ...updates
                        },
                        updatedAt: new Date().toISOString()
                    } : null,
                    isDirty: true
                }));
        },
        updateAccident: (updates)=>{
            set((state)=>({
                    currentClaim: state.currentClaim ? {
                        ...state.currentClaim,
                        accident: {
                            ...state.currentClaim.accident,
                            ...updates
                        },
                        updatedAt: new Date().toISOString()
                    } : null,
                    isDirty: true
                }));
        },
        updateSpotDetails: (updates)=>{
            set((state)=>({
                    currentClaim: state.currentClaim ? {
                        ...state.currentClaim,
                        spotDetails: {
                            ...state.currentClaim.spotDetails,
                            ...updates
                        },
                        updatedAt: new Date().toISOString()
                    } : null,
                    isDirty: true
                }));
        },
        setDepreciationType: (depType)=>{
            set((state)=>({
                    currentClaim: state.currentClaim ? {
                        ...state.currentClaim,
                        depreciationType: depType,
                        updatedAt: new Date().toISOString()
                    } : null,
                    isDirty: true
                }));
        },
        addAssessmentRow: (section)=>{
            set((state)=>{
                if (!state.currentClaim) return {};
                const newRow = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$assessment$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createAssessmentRow"])(section);
                return {
                    currentClaim: {
                        ...state.currentClaim,
                        assessmentRows: [
                            ...state.currentClaim.assessmentRows,
                            newRow
                        ],
                        updatedAt: new Date().toISOString()
                    },
                    isDirty: true
                };
            });
        },
        updateAssessmentRow: (id, updates)=>{
            set((state)=>{
                if (!state.currentClaim) return {};
                return {
                    currentClaim: {
                        ...state.currentClaim,
                        assessmentRows: state.currentClaim.assessmentRows.map((r)=>r.id === id ? {
                                ...r,
                                ...updates
                            } : r),
                        updatedAt: new Date().toISOString()
                    },
                    isDirty: true
                };
            });
        },
        deleteAssessmentRow: (id)=>{
            set((state)=>{
                if (!state.currentClaim) return {};
                return {
                    currentClaim: {
                        ...state.currentClaim,
                        assessmentRows: state.currentClaim.assessmentRows.filter((r)=>r.id !== id),
                        updatedAt: new Date().toISOString()
                    },
                    isDirty: true
                };
            });
        },
        toggleRowAllowed: (id)=>{
            set((state)=>{
                if (!state.currentClaim) return {};
                return {
                    currentClaim: {
                        ...state.currentClaim,
                        assessmentRows: state.currentClaim.assessmentRows.map((r)=>r.id === id ? {
                                ...r,
                                allowed: !r.allowed
                            } : r),
                        updatedAt: new Date().toISOString()
                    },
                    isDirty: true
                };
            });
        },
        addSpotDamageRow: (component = '', damage = '')=>{
            set((state)=>{
                if (!state.currentClaim) return {};
                const newRow = {
                    id: `spot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    component,
                    damage
                };
                return {
                    currentClaim: {
                        ...state.currentClaim,
                        spotDamageRows: [
                            ...state.currentClaim.spotDamageRows,
                            newRow
                        ],
                        updatedAt: new Date().toISOString()
                    },
                    isDirty: true
                };
            });
        },
        updateSpotDamageRow: (id, updates)=>{
            set((state)=>{
                if (!state.currentClaim) return {};
                return {
                    currentClaim: {
                        ...state.currentClaim,
                        spotDamageRows: state.currentClaim.spotDamageRows.map((r)=>r.id === id ? {
                                ...r,
                                ...updates
                            } : r),
                        updatedAt: new Date().toISOString()
                    },
                    isDirty: true
                };
            });
        },
        deleteSpotDamageRow: (id)=>{
            set((state)=>{
                if (!state.currentClaim) return {};
                return {
                    currentClaim: {
                        ...state.currentClaim,
                        spotDamageRows: state.currentClaim.spotDamageRows.filter((r)=>r.id !== id),
                        updatedAt: new Date().toISOString()
                    },
                    isDirty: true
                };
            });
        },
        updateFeeBill: (updates)=>{
            set((state)=>({
                    currentClaim: state.currentClaim ? {
                        ...state.currentClaim,
                        feeBill: {
                            ...state.currentClaim.feeBill,
                            ...updates
                        },
                        updatedAt: new Date().toISOString()
                    } : null,
                    isDirty: true
                }));
        },
        setClaimsList: (claims)=>set({
                claimsList: claims
            }),
        markClean: ()=>set({
                isDirty: false
            })
    }), {
    name: 'claim-store'
}));
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MobileMenuButton",
    ()=>MobileMenuButton,
    "Sidebar",
    ()=>Sidebar
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$ui$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/stores/ui-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$profile$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/stores/profile-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/stores/claim-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$layout$2d$dashboard$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LayoutDashboard$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/layout-dashboard.js [app-client] (ecmascript) <export default as LayoutDashboard>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/file-text.js [app-client] (ecmascript) <export default as FileText>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$scan$2d$search$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ScanSearch$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/scan-search.js [app-client] (ecmascript) <export default as ScanSearch>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clipboard$2d$list$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ClipboardList$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/clipboard-list.js [app-client] (ecmascript) <export default as ClipboardList>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$map$2d$pin$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MapPin$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/map-pin.js [app-client] (ecmascript) <export default as MapPin>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$calculator$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Calculator$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/calculator.js [app-client] (ecmascript) <export default as Calculator>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$printer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Printer$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/printer.js [app-client] (ecmascript) <export default as Printer>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$camera$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Camera$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/camera.js [app-client] (ecmascript) <export default as Camera>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$receipt$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Receipt$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/receipt.js [app-client] (ecmascript) <export default as Receipt>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$rotate$2d$ccw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RotateCcw$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/rotate-ccw.js [app-client] (ecmascript) <export default as RotateCcw>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__User$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/user.js [app-client] (ecmascript) <export default as User>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$brain$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Brain$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/brain.js [app-client] (ecmascript) <export default as Brain>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/plus.js [app-client] (ecmascript) <export default as Plus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$folder$2d$open$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FolderOpen$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/folder-open.js [app-client] (ecmascript) <export default as FolderOpen>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronLeft$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/chevron-left.js [app-client] (ecmascript) <export default as ChevronLeft>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronRight$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/chevron-right.js [app-client] (ecmascript) <export default as ChevronRight>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$menu$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Menu$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/menu.js [app-client] (ecmascript) <export default as Menu>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wifi$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wifi$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/wifi.js [app-client] (ecmascript) <export default as Wifi>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wifi$2d$off$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__WifiOff$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/wifi-off.js [app-client] (ecmascript) <export default as WifiOff>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cloud$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Cloud$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/cloud.js [app-client] (ecmascript) <export default as Cloud>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
const NAV_ITEMS = [
    // ─── Main ──────────────────────────────────────────
    {
        id: 'dashboard',
        label: 'Dashboard',
        icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$layout$2d$dashboard$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LayoutDashboard$3e$__["LayoutDashboard"], {
            size: 18
        }, void 0, false, {
            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
            lineNumber: 39,
            columnNumber: 48
        }, ("TURBOPACK compile-time value", void 0)),
        group: 'main'
    },
    // ─── Claim Workflow ────────────────────────────────
    {
        id: 'documents',
        label: 'Documents',
        icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__["FileText"], {
            size: 18
        }, void 0, false, {
            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
            lineNumber: 42,
            columnNumber: 48
        }, ("TURBOPACK compile-time value", void 0)),
        group: 'claim',
        requiresClaim: true
    },
    {
        id: 'review',
        label: 'AI Review',
        icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$scan$2d$search$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ScanSearch$3e$__["ScanSearch"], {
            size: 18
        }, void 0, false, {
            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
            lineNumber: 43,
            columnNumber: 45
        }, ("TURBOPACK compile-time value", void 0)),
        group: 'claim',
        requiresClaim: true
    },
    {
        id: 'details',
        label: 'Claim Details',
        icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clipboard$2d$list$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ClipboardList$3e$__["ClipboardList"], {
            size: 18
        }, void 0, false, {
            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
            lineNumber: 44,
            columnNumber: 50
        }, ("TURBOPACK compile-time value", void 0)),
        group: 'claim',
        requiresClaim: true
    },
    {
        id: 'spot',
        label: 'Spot Survey',
        icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$map$2d$pin$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MapPin$3e$__["MapPin"], {
            size: 18
        }, void 0, false, {
            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
            lineNumber: 45,
            columnNumber: 45
        }, ("TURBOPACK compile-time value", void 0)),
        group: 'claim',
        requiresClaim: true
    },
    {
        id: 'assessment',
        label: 'Assessment',
        icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$calculator$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Calculator$3e$__["Calculator"], {
            size: 18
        }, void 0, false, {
            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
            lineNumber: 46,
            columnNumber: 50
        }, ("TURBOPACK compile-time value", void 0)),
        group: 'claim',
        requiresClaim: true
    },
    // ─── Output ────────────────────────────────────────
    {
        id: 'reports',
        label: 'Reports',
        icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$printer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Printer$3e$__["Printer"], {
            size: 18
        }, void 0, false, {
            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
            lineNumber: 49,
            columnNumber: 44
        }, ("TURBOPACK compile-time value", void 0)),
        group: 'output',
        requiresClaim: true
    },
    {
        id: 'photos',
        label: 'Photo Sheet',
        icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$camera$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Camera$3e$__["Camera"], {
            size: 18
        }, void 0, false, {
            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
            lineNumber: 50,
            columnNumber: 47
        }, ("TURBOPACK compile-time value", void 0)),
        group: 'output',
        requiresClaim: true
    },
    {
        id: 'fees',
        label: 'Fee Bill',
        icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$receipt$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Receipt$3e$__["Receipt"], {
            size: 18
        }, void 0, false, {
            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
            lineNumber: 51,
            columnNumber: 42
        }, ("TURBOPACK compile-time value", void 0)),
        group: 'output',
        requiresClaim: true
    },
    {
        id: 'reinspection',
        label: 'Reinspection',
        icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$rotate$2d$ccw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RotateCcw$3e$__["RotateCcw"], {
            size: 18
        }, void 0, false, {
            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
            lineNumber: 52,
            columnNumber: 54
        }, ("TURBOPACK compile-time value", void 0)),
        group: 'output',
        requiresClaim: true
    },
    // ─── Settings ──────────────────────────────────────
    {
        id: 'profile',
        label: 'Profile',
        icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__User$3e$__["User"], {
            size: 18
        }, void 0, false, {
            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
            lineNumber: 55,
            columnNumber: 44
        }, ("TURBOPACK compile-time value", void 0)),
        group: 'settings'
    },
    {
        id: 'learning',
        label: 'Learning',
        icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$brain$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Brain$3e$__["Brain"], {
            size: 18
        }, void 0, false, {
            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
            lineNumber: 56,
            columnNumber: 46
        }, ("TURBOPACK compile-time value", void 0)),
        group: 'settings'
    }
];
const GROUP_LABELS = {
    main: '',
    claim: 'CLAIM WORKFLOW',
    output: 'OUTPUT',
    settings: 'SETTINGS'
};
;
function Sidebar() {
    _s();
    const [mounted, setMounted] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const { activeTab, setActiveTab, sidebarCollapsed, toggleSidebar, isOnline, isDriveConnected, driveEmail } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$ui$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUIStore"])();
    const { setNewClaimDialogOpen, setClaimsListOpen } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$ui$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUIStore"])();
    const { getInitials, profile } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$profile$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useProfileStore"])();
    const { currentClaim } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useClaimStore"])();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Sidebar.useEffect": ()=>{
            setMounted(true);
        }
    }["Sidebar.useEffect"], []);
    const hasClaim = !!currentClaim;
    const groups = [
        'main',
        'claim',
        'output',
        'settings'
    ];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden",
                style: {
                    display: __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$ui$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUIStore"].getState().sidebarMobileOpen ? 'block' : 'none'
                },
                onClick: ()=>__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$ui$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUIStore"].getState().setSidebarMobileOpen(false)
            }, void 0, false, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                lineNumber: 86,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("aside", {
                className: `
          fixed top-0 left-0 z-50 h-full flex flex-col
          bg-sidebar border-r border-sidebar-border
          transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? 'w-[60px]' : 'w-[240px]'}
          lg:relative
        `,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-3 px-3 py-4 border-b border-sidebar-border",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex-shrink-0 w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold",
                                children: getInitials()
                            }, void 0, false, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                lineNumber: 103,
                                columnNumber: 11
                            }, this),
                            !sidebarCollapsed && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex-1 min-w-0",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "text-sm font-semibold text-sidebar-foreground truncate",
                                        children: profile.name || 'Surveyor'
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                        lineNumber: 108,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "text-[10px] text-muted-foreground truncate",
                                        children: profile.licenceNumber || 'License #'
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                        lineNumber: 111,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                lineNumber: 107,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: toggleSidebar,
                                className: "hidden lg:flex items-center justify-center w-6 h-6 rounded-md hover:bg-sidebar-accent text-muted-foreground",
                                children: sidebarCollapsed ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronRight$3e$__["ChevronRight"], {
                                    size: 14
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                    lineNumber: 120,
                                    columnNumber: 33
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronLeft$3e$__["ChevronLeft"], {
                                    size: 14
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                    lineNumber: 120,
                                    columnNumber: 62
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                lineNumber: 116,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                        lineNumber: 102,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: `flex gap-2 px-3 py-3 border-b border-sidebar-border ${sidebarCollapsed ? 'flex-col items-center' : ''}`,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>setNewClaimDialogOpen(true),
                                className: "flex items-center gap-2 px-3 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex-1 justify-center",
                                title: "New Claim",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                                        size: 14
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                        lineNumber: 131,
                                        columnNumber: 13
                                    }, this),
                                    !sidebarCollapsed && 'New Claim'
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                lineNumber: 126,
                                columnNumber: 11
                            }, this),
                            !sidebarCollapsed && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>setClaimsListOpen(true),
                                className: "flex items-center justify-center w-9 h-9 rounded-lg border border-sidebar-border hover:bg-sidebar-accent text-muted-foreground",
                                title: "Open Claim",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$folder$2d$open$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FolderOpen$3e$__["FolderOpen"], {
                                    size: 14
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                    lineNumber: 140,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                lineNumber: 135,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                        lineNumber: 125,
                        columnNumber: 9
                    }, this),
                    hasClaim && !sidebarCollapsed && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mx-3 mt-3 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-[10px] font-semibold text-primary uppercase tracking-wider",
                                children: [
                                    currentClaim.surveyType,
                                    " Survey"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                lineNumber: 148,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs font-bold text-sidebar-foreground truncate mt-0.5",
                                children: currentClaim.vehicle.registrationNumber || currentClaim.reportNo || 'New Claim'
                            }, void 0, false, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                lineNumber: 151,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                        lineNumber: 147,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                        className: "flex-1 overflow-y-auto py-2 px-2",
                        children: groups.map((group)=>{
                            const items = NAV_ITEMS.filter((item)=>item.group === group);
                            if (!items.length) return null;
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mb-2",
                                children: [
                                    GROUP_LABELS[group] && !sidebarCollapsed && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "px-2 py-2 text-[9px] font-bold text-muted-foreground/60 uppercase tracking-[0.15em]",
                                        children: GROUP_LABELS[group]
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                        lineNumber: 166,
                                        columnNumber: 19
                                    }, this),
                                    items.map((item)=>{
                                        const disabled = item.requiresClaim && !hasClaim;
                                        const isActive = activeTab === item.id;
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: ()=>!disabled && setActiveTab(item.id),
                                            disabled: disabled,
                                            title: sidebarCollapsed ? item.label : undefined,
                                            className: `
                        w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm
                        transition-all duration-150 mb-0.5
                        ${sidebarCollapsed ? 'justify-center' : ''}
                        ${isActive ? 'bg-sidebar-accent text-sidebar-primary font-semibold' : disabled ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}
                      `,
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: isActive ? 'text-sidebar-primary' : '',
                                                    children: item.icon
                                                }, void 0, false, {
                                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                                    lineNumber: 192,
                                                    columnNumber: 23
                                                }, this),
                                                !sidebarCollapsed && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "truncate",
                                                    children: item.label
                                                }, void 0, false, {
                                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                                    lineNumber: 193,
                                                    columnNumber: 45
                                                }, this)
                                            ]
                                        }, item.id, true, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                            lineNumber: 175,
                                            columnNumber: 21
                                        }, this);
                                    })
                                ]
                            }, group, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                lineNumber: 164,
                                columnNumber: 15
                            }, this);
                        })
                    }, void 0, false, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                        lineNumber: 158,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "px-3 py-3 border-t border-sidebar-border space-y-1.5 h-[68px]",
                        children: mounted && (!sidebarCollapsed ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: `flex items-center gap-2 text-[10px] ${isOnline ? 'text-success' : 'text-danger'}`,
                                    children: [
                                        isOnline ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wifi$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wifi$3e$__["Wifi"], {
                                            size: 12
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                            lineNumber: 207,
                                            columnNumber: 29
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wifi$2d$off$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__WifiOff$3e$__["WifiOff"], {
                                            size: 12
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                            lineNumber: 207,
                                            columnNumber: 50
                                        }, this),
                                        isOnline ? 'Online' : 'Offline — data saved locally'
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                    lineNumber: 206,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: `flex items-center gap-2 text-[10px] ${isDriveConnected ? 'text-primary' : 'text-muted-foreground'}`,
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cloud$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Cloud$3e$__["Cloud"], {
                                            size: 12
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                            lineNumber: 211,
                                            columnNumber: 17
                                        }, this),
                                        isDriveConnected ? driveEmail : 'Drive: Not connected'
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                    lineNumber: 210,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-col items-center gap-2",
                            children: [
                                isOnline ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wifi$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wifi$3e$__["Wifi"], {
                                    size: 12,
                                    className: "text-success"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                    lineNumber: 217,
                                    columnNumber: 27
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wifi$2d$off$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__WifiOff$3e$__["WifiOff"], {
                                    size: 12,
                                    className: "text-danger"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                    lineNumber: 217,
                                    columnNumber: 73
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cloud$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Cloud$3e$__["Cloud"], {
                                    size: 12,
                                    className: isDriveConnected ? 'text-primary' : 'text-muted-foreground'
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                                    lineNumber: 218,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                            lineNumber: 216,
                            columnNumber: 13
                        }, this))
                    }, void 0, false, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                        lineNumber: 203,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
                lineNumber: 92,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true);
}
_s(Sidebar, "C2i/myY/lQssri4n3WTW7E139ts=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$ui$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUIStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$ui$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUIStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$profile$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useProfileStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useClaimStore"]
    ];
});
_c = Sidebar;
function MobileMenuButton() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        className: "lg:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-card border border-border",
        onClick: ()=>__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$ui$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUIStore"].getState().setSidebarMobileOpen(true),
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$menu$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Menu$3e$__["Menu"], {
            size: 20
        }, void 0, false, {
            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
            lineNumber: 233,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx",
        lineNumber: 229,
        columnNumber: 5
    }, this);
}
_c1 = MobileMenuButton;
var _c, _c1;
__turbopack_context__.k.register(_c, "Sidebar");
__turbopack_context__.k.register(_c1, "MobileMenuButton");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/utils.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "cn",
    ()=>cn
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/clsx/dist/clsx.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/tailwind-merge/dist/bundle-mjs.mjs [app-client] (ecmascript)");
;
;
function cn(...inputs) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["twMerge"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["clsx"])(inputs));
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/card.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Card",
    ()=>Card,
    "CardAction",
    ()=>CardAction,
    "CardContent",
    ()=>CardContent,
    "CardDescription",
    ()=>CardDescription,
    "CardFooter",
    ()=>CardFooter,
    "CardHeader",
    ()=>CardHeader,
    "CardTitle",
    ()=>CardTitle
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/utils.ts [app-client] (ecmascript)");
;
;
function Card({ className, size = "default", ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card",
        "data-size": size,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("group/card flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-sm text-card-foreground ring-1 ring-foreground/10 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/card.tsx",
        lineNumber: 11,
        columnNumber: 5
    }, this);
}
_c = Card;
function CardHeader({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-header",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-4 group-data-[size=sm]/card:px-3 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/card.tsx",
        lineNumber: 25,
        columnNumber: 5
    }, this);
}
_c1 = CardHeader;
function CardTitle({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-title",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/card.tsx",
        lineNumber: 38,
        columnNumber: 5
    }, this);
}
_c2 = CardTitle;
function CardDescription({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-description",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("text-sm text-muted-foreground", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/card.tsx",
        lineNumber: 51,
        columnNumber: 5
    }, this);
}
_c3 = CardDescription;
function CardAction({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-action",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/card.tsx",
        lineNumber: 61,
        columnNumber: 5
    }, this);
}
_c4 = CardAction;
function CardContent({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-content",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("px-4 group-data-[size=sm]/card:px-3", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/card.tsx",
        lineNumber: 74,
        columnNumber: 5
    }, this);
}
_c5 = CardContent;
function CardFooter({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-footer",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex items-center rounded-b-xl border-t bg-muted/50 p-4 group-data-[size=sm]/card:p-3", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/card.tsx",
        lineNumber: 84,
        columnNumber: 5
    }, this);
}
_c6 = CardFooter;
;
var _c, _c1, _c2, _c3, _c4, _c5, _c6;
__turbopack_context__.k.register(_c, "Card");
__turbopack_context__.k.register(_c1, "CardHeader");
__turbopack_context__.k.register(_c2, "CardTitle");
__turbopack_context__.k.register(_c3, "CardDescription");
__turbopack_context__.k.register(_c4, "CardAction");
__turbopack_context__.k.register(_c5, "CardContent");
__turbopack_context__.k.register(_c6, "CardFooter");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/input.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Input",
    ()=>Input
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$input$2f$Input$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/@base-ui/react/esm/input/Input.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/utils.ts [app-client] (ecmascript)");
;
;
;
function Input({ className, type, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$input$2f$Input$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
        type: type,
        "data-slot": "input",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/input.tsx",
        lineNumber: 8,
        columnNumber: 5
    }, this);
}
_c = Input;
;
var _c;
__turbopack_context__.k.register(_c, "Input");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/label.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Label",
    ()=>Label
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/utils.ts [app-client] (ecmascript)");
;
;
;
const Label = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](_c = ({ className, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
        ref: ref,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/label.tsx",
        lineNumber: 6,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0)));
_c1 = Label;
Label.displayName = "Label";
;
var _c, _c1;
__turbopack_context__.k.register(_c, "Label$React.forwardRef");
__turbopack_context__.k.register(_c1, "Label");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "VehicleDetailsForm",
    ()=>VehicleDetailsForm
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/stores/claim-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/card.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/input.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/label.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
function VehicleDetailsForm() {
    _s();
    const { currentClaim, updateVehicle } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useClaimStore"])();
    if (!currentClaim) return null;
    const v = currentClaim.vehicle;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardHeader"], {
                className: "pb-3",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardTitle"], {
                    className: "text-lg text-primary",
                    children: "Vehicle Details"
                }, void 0, false, {
                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                    lineNumber: 17,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                lineNumber: 16,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "v-reg",
                                    children: "Registration No."
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 22,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "v-reg",
                                    value: v.registrationNumber,
                                    onChange: (e)=>updateVehicle({
                                            registrationNumber: e.target.value.toUpperCase()
                                        }),
                                    placeholder: "e.g. MH01AB1234",
                                    className: "uppercase"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 23,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                            lineNumber: 21,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "v-make",
                                    children: "Make"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 33,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "v-make",
                                    value: v.make,
                                    onChange: (e)=>updateVehicle({
                                            make: e.target.value
                                        }),
                                    placeholder: "e.g. MARUTI SUZUKI"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 34,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                            lineNumber: 32,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "v-model",
                                    children: "Model / Variant"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 43,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "v-model",
                                    value: v.model,
                                    onChange: (e)=>updateVehicle({
                                            model: e.target.value
                                        }),
                                    placeholder: "e.g. SWIFT VXI"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 44,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                            lineNumber: 42,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "v-year",
                                    children: "Year of Mfg (YOM)"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 53,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "v-year",
                                    type: "number",
                                    value: v.yearOfManufacture || '',
                                    onChange: (e)=>updateVehicle({
                                            yearOfManufacture: parseInt(e.target.value) || null
                                        }),
                                    placeholder: "YYYY"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 54,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                            lineNumber: 52,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "v-chassis",
                                    children: "Chassis No."
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 64,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "v-chassis",
                                    value: v.chassisNumber,
                                    onChange: (e)=>updateVehicle({
                                            chassisNumber: e.target.value.toUpperCase()
                                        }),
                                    className: "uppercase"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 65,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                            lineNumber: 63,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "v-engine",
                                    children: "Engine No."
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 74,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "v-engine",
                                    value: v.engineNumber,
                                    onChange: (e)=>updateVehicle({
                                            engineNumber: e.target.value.toUpperCase()
                                        }),
                                    className: "uppercase"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 75,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                            lineNumber: 73,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "v-cc",
                                    children: "Cubic Capacity (CC)"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 84,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "v-cc",
                                    value: v.cubicCapacity,
                                    onChange: (e)=>updateVehicle({
                                            cubicCapacity: e.target.value
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 85,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                            lineNumber: 83,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "v-color",
                                    children: "Colour"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 93,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "v-color",
                                    value: v.colour,
                                    onChange: (e)=>updateVehicle({
                                            colour: e.target.value
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 94,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                            lineNumber: 92,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "v-fuel",
                                    children: "Fuel Type"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 102,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                    id: "v-fuel",
                                    value: v.fuel,
                                    onChange: (e)=>updateVehicle({
                                            fuel: e.target.value
                                        }),
                                    className: "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: "",
                                            children: "Select Fuel"
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                            lineNumber: 109,
                                            columnNumber: 15
                                        }, this),
                                        [
                                            'Petrol',
                                            'Diesel',
                                            'CNG',
                                            'LPG',
                                            'Electric',
                                            'Hybrid',
                                            'Petrol+CNG',
                                            'Petrol+LPG'
                                        ].map((opt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: opt,
                                                children: opt
                                            }, opt, false, {
                                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                                lineNumber: 111,
                                                columnNumber: 17
                                            }, this))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 103,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                            lineNumber: 101,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "v-odo",
                                    children: "Odometer"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 117,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "v-odo",
                                    value: v.odometer,
                                    onChange: (e)=>updateVehicle({
                                            odometer: e.target.value
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 118,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                            lineNumber: 116,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "v-regdate",
                                    children: "Date of Registration"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 126,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "v-regdate",
                                    type: "date",
                                    value: v.dateOfRegistration,
                                    onChange: (e)=>updateVehicle({
                                            dateOfRegistration: e.target.value
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 127,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                            lineNumber: 125,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "v-hyp",
                                    children: "Hypothecation"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 136,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "v-hyp",
                                    value: v.hypothecation,
                                    onChange: (e)=>updateVehicle({
                                            hypothecation: e.target.value
                                        }),
                                    placeholder: "e.g. HDFC BANK"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 137,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                            lineNumber: 135,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "v-seats",
                                    children: "Seating Capacity"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 146,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "v-seats",
                                    value: v.seatingCapacity,
                                    onChange: (e)=>updateVehicle({
                                            seatingCapacity: e.target.value
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 147,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                            lineNumber: 145,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "v-cond",
                                    children: "Pre-Accident Condition"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 155,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "v-cond",
                                    value: v.preAccidentCondition,
                                    onChange: (e)=>updateVehicle({
                                            preAccidentCondition: e.target.value
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                                    lineNumber: 156,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                            lineNumber: 154,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                    lineNumber: 20,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
                lineNumber: 19,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx",
        lineNumber: 15,
        columnNumber: 5
    }, this);
}
_s(VehicleDetailsForm, "pXLws6SaKYSLb8+wmNn+wmJsni0=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useClaimStore"]
    ];
});
_c = VehicleDetailsForm;
var _c;
__turbopack_context__.k.register(_c, "VehicleDetailsForm");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DriverDetailsForm",
    ()=>DriverDetailsForm
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/stores/claim-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/card.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/input.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/label.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
function DriverDetailsForm() {
    _s();
    const { currentClaim, updateDriver } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useClaimStore"])();
    if (!currentClaim) return null;
    const d = currentClaim.driver;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardHeader"], {
                className: "pb-3",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardTitle"], {
                    className: "text-lg text-amber",
                    children: "Driver & Licence Details"
                }, void 0, false, {
                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                    lineNumber: 18,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                lineNumber: 17,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "d-name",
                                    children: "Driver Name"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                    lineNumber: 23,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "d-name",
                                    value: d.name,
                                    onChange: (e)=>updateDriver({
                                            name: e.target.value
                                        }),
                                    className: "uppercase"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                    lineNumber: 24,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                            lineNumber: 22,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "d-rel",
                                    children: "Relation"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                    lineNumber: 33,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                    id: "d-rel",
                                    value: d.relationType,
                                    onChange: (e)=>updateDriver({
                                            relationType: e.target.value
                                        }),
                                    className: "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: "S/o",
                                            children: "S/o (Son of)"
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                            lineNumber: 40,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: "D/o",
                                            children: "D/o (Daughter of)"
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                            lineNumber: 41,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: "W/o",
                                            children: "W/o (Wife of)"
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                            lineNumber: 42,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                    lineNumber: 34,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                            lineNumber: 32,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1 xl:col-span-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "d-parent",
                                    children: "Parent / Spouse Name"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                    lineNumber: 47,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "d-parent",
                                    value: d.parentName,
                                    onChange: (e)=>updateDriver({
                                            parentName: e.target.value
                                        }),
                                    className: "uppercase"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                    lineNumber: 48,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                            lineNumber: 46,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "d-dlno",
                                    children: "Licence No."
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                    lineNumber: 57,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "d-dlno",
                                    value: d.licenceNumber,
                                    onChange: (e)=>updateDriver({
                                            licenceNumber: e.target.value.toUpperCase()
                                        }),
                                    className: "uppercase"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                    lineNumber: 58,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                            lineNumber: 56,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "d-dob",
                                    children: "Date of Birth"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                    lineNumber: 67,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "d-dob",
                                    type: "date",
                                    value: d.dateOfBirth,
                                    onChange: (e)=>updateDriver({
                                            dateOfBirth: e.target.value
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                    lineNumber: 68,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                            lineNumber: 66,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "d-issue",
                                    children: "Date of Issue"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                    lineNumber: 77,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "d-issue",
                                    type: "date",
                                    value: d.dateOfIssue,
                                    onChange: (e)=>updateDriver({
                                            dateOfIssue: e.target.value
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                    lineNumber: 78,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                            lineNumber: 76,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "d-auth",
                                    children: "Issuing Authority"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                    lineNumber: 87,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "d-auth",
                                    value: d.issuingAuthority,
                                    onChange: (e)=>updateDriver({
                                            issuingAuthority: e.target.value.toUpperCase()
                                        }),
                                    className: "uppercase"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                    lineNumber: 88,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                            lineNumber: 86,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "d-class",
                                    children: "Authorized Classes"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                    lineNumber: 97,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "d-class",
                                    value: d.vehicleClasses,
                                    onChange: (e)=>updateDriver({
                                            vehicleClasses: e.target.value
                                        }),
                                    placeholder: "e.g. LMV-NT, MCWG"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                    lineNumber: 98,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                            lineNumber: 96,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "d-validnt",
                                    children: "Valid Non-Transport (NT)"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                    lineNumber: 107,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "d-validnt",
                                    type: "date",
                                    value: d.validityNonTransport,
                                    onChange: (e)=>updateDriver({
                                            validityNonTransport: e.target.value
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                    lineNumber: 108,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                            lineNumber: 106,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "d-validt",
                                    children: "Valid Transport (T)"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                    lineNumber: 117,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "d-validt",
                                    type: "date",
                                    value: d.validityTransport,
                                    onChange: (e)=>updateDriver({
                                            validityTransport: e.target.value
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                    lineNumber: 118,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                            lineNumber: 116,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "d-verif",
                                    children: "Verification Status"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                    lineNumber: 127,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                    id: "d-verif",
                                    value: d.verificationStatus,
                                    onChange: (e)=>updateDriver({
                                            verificationStatus: e.target.value
                                        }),
                                    className: `flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm font-semibold
                ${d.verificationStatus === 'verified' ? 'text-success' : d.verificationStatus === 'not-available' ? 'text-danger' : 'text-amber'}
              `,
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: "verified",
                                            children: "Verified (Online)"
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                            lineNumber: 136,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: "photocopy",
                                            children: "From Photocopy"
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                            lineNumber: 137,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: "not-available",
                                            children: "Not Available"
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                            lineNumber: 138,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                                    lineNumber: 128,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                            lineNumber: 126,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                    lineNumber: 21,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
                lineNumber: 20,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx",
        lineNumber: 16,
        columnNumber: 5
    }, this);
}
_s(DriverDetailsForm, "KPUWE4ITJbD2DiApOGS8Nzfd9eQ=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useClaimStore"]
    ];
});
_c = DriverDetailsForm;
var _c;
__turbopack_context__.k.register(_c, "DriverDetailsForm");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PolicyDetailsForm",
    ()=>PolicyDetailsForm
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/stores/claim-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/card.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/input.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/label.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
function PolicyDetailsForm() {
    _s();
    const { currentClaim, updatePolicy } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useClaimStore"])();
    if (!currentClaim) return null;
    const p = currentClaim.policy;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardHeader"], {
                className: "pb-3",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardTitle"], {
                    className: "text-lg text-teal",
                    children: "Policy & Insured Details"
                }, void 0, false, {
                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                    lineNumber: 17,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                lineNumber: 16,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "p-ins",
                                    children: "Insurer Name"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                                    lineNumber: 22,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "p-ins",
                                    value: p.insurerName,
                                    onChange: (e)=>updatePolicy({
                                            insurerName: e.target.value
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                                    lineNumber: 23,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                            lineNumber: 21,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "p-polno",
                                    children: "Policy No."
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                                    lineNumber: 31,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "p-polno",
                                    value: p.policyNumber,
                                    onChange: (e)=>updatePolicy({
                                            policyNumber: e.target.value
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                                    lineNumber: 32,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                            lineNumber: 30,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "p-claimno",
                                    children: "Claim No."
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                                    lineNumber: 40,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "p-claimno",
                                    value: p.claimNumber,
                                    onChange: (e)=>updatePolicy({
                                            claimNumber: e.target.value
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                                    lineNumber: 41,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                            lineNumber: 39,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "p-type",
                                    children: "Policy Type"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                                    lineNumber: 49,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                    id: "p-type",
                                    value: p.policyType,
                                    onChange: (e)=>updatePolicy({
                                            policyType: e.target.value
                                        }),
                                    className: "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: "",
                                            children: "Select Type"
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                                            lineNumber: 56,
                                            columnNumber: 15
                                        }, this),
                                        [
                                            'Comprehensive',
                                            'Third Party',
                                            'Standalone OD',
                                            'Package',
                                            'Commercial Comprehensive',
                                            'Commercial TP'
                                        ].map((opt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: opt,
                                                children: opt
                                            }, opt, false, {
                                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                                                lineNumber: 58,
                                                columnNumber: 17
                                            }, this))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                                    lineNumber: 50,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                            lineNumber: 48,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "p-from",
                                    children: "Valid From"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                                    lineNumber: 64,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "p-from",
                                    type: "date",
                                    value: p.periodFrom,
                                    onChange: (e)=>updatePolicy({
                                            periodFrom: e.target.value
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                                    lineNumber: 65,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                            lineNumber: 63,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "p-to",
                                    children: "Valid To"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                                    lineNumber: 74,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "p-to",
                                    type: "date",
                                    value: p.periodTo,
                                    onChange: (e)=>updatePolicy({
                                            periodTo: e.target.value
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                                    lineNumber: 75,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                            lineNumber: 73,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "p-idv",
                                    children: "Insured Declared Value (IDV)"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                                    lineNumber: 84,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "p-idv",
                                    type: "number",
                                    value: p.idv,
                                    onChange: (e)=>updatePolicy({
                                            idv: e.target.value
                                        }),
                                    placeholder: "0.00"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                                    lineNumber: 85,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                            lineNumber: 83,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "p-name",
                                    children: "Insured Name"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                                    lineNumber: 95,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "p-name",
                                    value: p.insuredName,
                                    onChange: (e)=>updatePolicy({
                                            insuredName: e.target.value
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                                    lineNumber: 96,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                            lineNumber: 94,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1 md:col-span-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "p-addr",
                                    children: "Insured Address"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                                    lineNumber: 104,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "p-addr",
                                    value: p.insuredAddress,
                                    onChange: (e)=>updatePolicy({
                                            insuredAddress: e.target.value
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                                    lineNumber: 105,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                            lineNumber: 103,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "p-mob",
                                    children: "Mobile"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                                    lineNumber: 113,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "p-mob",
                                    value: p.insuredMobile,
                                    onChange: (e)=>updatePolicy({
                                            insuredMobile: e.target.value
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                                    lineNumber: 114,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                            lineNumber: 112,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "p-office",
                                    children: "Issuing Office"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                                    lineNumber: 122,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "p-office",
                                    value: p.policyIssuingOffice,
                                    onChange: (e)=>updatePolicy({
                                            policyIssuingOffice: e.target.value
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                                    lineNumber: 123,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                            lineNumber: 121,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                    lineNumber: 20,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
                lineNumber: 19,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx",
        lineNumber: 15,
        columnNumber: 5
    }, this);
}
_s(PolicyDetailsForm, "Cg5NNKr463UmudRUsCqp2NT6dLM=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useClaimStore"]
    ];
});
_c = PolicyDetailsForm;
var _c;
__turbopack_context__.k.register(_c, "PolicyDetailsForm");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AccidentForm.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AccidentDetailsForm",
    ()=>AccidentDetailsForm
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/stores/claim-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/card.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/input.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/label.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
function AccidentDetailsForm() {
    _s();
    const { currentClaim, updateAccident } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useClaimStore"])();
    if (!currentClaim) return null;
    const a = currentClaim.accident;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardHeader"], {
                className: "pb-3",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardTitle"], {
                    className: "text-lg text-danger",
                    children: "Accident & Survey Details"
                }, void 0, false, {
                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AccidentForm.tsx",
                    lineNumber: 17,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AccidentForm.tsx",
                lineNumber: 16,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "a-date",
                                    children: "Date & Time of Accident"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AccidentForm.tsx",
                                    lineNumber: 22,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "a-date",
                                    type: "datetime-local",
                                    value: a.dateAndTime,
                                    onChange: (e)=>updateAccident({
                                            dateAndTime: e.target.value
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AccidentForm.tsx",
                                    lineNumber: 23,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AccidentForm.tsx",
                            lineNumber: 21,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1 lg:col-span-2 xl:col-span-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "a-place",
                                    children: "Place of Accident"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AccidentForm.tsx",
                                    lineNumber: 32,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "a-place",
                                    value: a.placeOfAccident,
                                    onChange: (e)=>updateAccident({
                                            placeOfAccident: e.target.value
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AccidentForm.tsx",
                                    lineNumber: 33,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AccidentForm.tsx",
                            lineNumber: 31,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1 lg:col-span-2 xl:col-span-4",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "a-cause",
                                    children: "Cause of Loss"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AccidentForm.tsx",
                                    lineNumber: 41,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "a-cause",
                                    value: a.causeOfAccident,
                                    onChange: (e)=>updateAccident({
                                            causeOfAccident: e.target.value
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AccidentForm.tsx",
                                    lineNumber: 42,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AccidentForm.tsx",
                            lineNumber: 40,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "a-sdate",
                                    children: "Date of Survey"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AccidentForm.tsx",
                                    lineNumber: 50,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "a-sdate",
                                    type: "date",
                                    value: a.dateOfSurvey,
                                    onChange: (e)=>updateAccident({
                                            dateOfSurvey: e.target.value
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AccidentForm.tsx",
                                    lineNumber: 51,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AccidentForm.tsx",
                            lineNumber: 49,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1 lg:col-span-2 xl:col-span-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "a-splace",
                                    children: "Place of Survey (Workshop Name)"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AccidentForm.tsx",
                                    lineNumber: 60,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    id: "a-splace",
                                    value: a.placeOfSurvey,
                                    onChange: (e)=>updateAccident({
                                            placeOfSurvey: e.target.value
                                        })
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AccidentForm.tsx",
                                    lineNumber: 61,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AccidentForm.tsx",
                            lineNumber: 59,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AccidentForm.tsx",
                    lineNumber: 20,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AccidentForm.tsx",
                lineNumber: 19,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AccidentForm.tsx",
        lineNumber: 15,
        columnNumber: 5
    }, this);
}
_s(AccidentDetailsForm, "xbCjBOdC0imImsz8qzUvvx1o8k0=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useClaimStore"]
    ];
});
_c = AccidentDetailsForm;
var _c;
__turbopack_context__.k.register(_c, "AccidentDetailsForm");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/DetailsTab.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DetailsTab",
    ()=>DetailsTab
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$claim$2f$VehicleForm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/VehicleForm.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$claim$2f$DriverForm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/DriverForm.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$claim$2f$PolicyForm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/PolicyForm.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$claim$2f$AccidentForm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AccidentForm.tsx [app-client] (ecmascript)");
'use client';
;
;
;
;
;
function DetailsTab() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "p-6 lg:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-2xl font-bold tracking-tight",
                        children: "Claim Details"
                    }, void 0, false, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/DetailsTab.tsx",
                        lineNumber: 12,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-muted-foreground text-sm",
                        children: "Core intake information for the claim. All changes save automatically offline."
                    }, void 0, false, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/DetailsTab.tsx",
                        lineNumber: 13,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/DetailsTab.tsx",
                lineNumber: 11,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-6",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$claim$2f$VehicleForm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VehicleDetailsForm"], {}, void 0, false, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/DetailsTab.tsx",
                        lineNumber: 19,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$claim$2f$PolicyForm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PolicyDetailsForm"], {}, void 0, false, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/DetailsTab.tsx",
                        lineNumber: 20,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$claim$2f$DriverForm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DriverDetailsForm"], {}, void 0, false, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/DetailsTab.tsx",
                        lineNumber: 21,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$claim$2f$AccidentForm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AccidentDetailsForm"], {}, void 0, false, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/DetailsTab.tsx",
                        lineNumber: 22,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/DetailsTab.tsx",
                lineNumber: 18,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/DetailsTab.tsx",
        lineNumber: 10,
        columnNumber: 5
    }, this);
}
_c = DetailsTab;
var _c;
__turbopack_context__.k.register(_c, "DetailsTab");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AssessmentGrid",
    ()=>AssessmentGrid
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/stores/claim-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$depreciation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/depreciation.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/card.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/input.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/trash-2.js [app-client] (ecmascript) <export default as Trash2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PlusCircle$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/circle-plus.js [app-client] (ecmascript) <export default as PlusCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wrench$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wrench$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/wrench.js [app-client] (ecmascript) <export default as Wrench>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ShieldAlert$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/shield-alert.js [app-client] (ecmascript) <export default as ShieldAlert>");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
function AssessmentGrid() {
    _s();
    const { currentClaim, addAssessmentRow, updateAssessmentRow, deleteAssessmentRow, toggleRowAllowed } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useClaimStore"])();
    if (!currentClaim) return null;
    const { assessmentRows, vehicle, accident, depreciationType } = currentClaim;
    // Calculate vehicle age once for the grid
    const ageMonths = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$depreciation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getVehicleAgeMonths"])(vehicle.dateOfRegistration, vehicle.yearOfManufacture, accident.dateAndTime);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
        className: "flex flex-col h-full border-border",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardHeader"], {
                className: "border-b border-border bg-card/50 px-4 py-3 flex flex-row items-center justify-between sticky top-0 z-10 rounded-t-xl",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardTitle"], {
                        className: "text-sm font-semibold flex items-center gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wrench$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wrench$3e$__["Wrench"], {
                                size: 16,
                                className: "text-primary"
                            }, void 0, false, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                lineNumber: 35,
                                columnNumber: 11
                            }, this),
                            "Parts Assessment Grid"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                        lineNumber: 34,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>addAssessmentRow('parts'),
                                className: "flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold transition-colors",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PlusCircle$3e$__["PlusCircle"], {
                                        size: 14
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                        lineNumber: 43,
                                        columnNumber: 13
                                    }, this),
                                    " Part Row"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                lineNumber: 39,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>addAssessmentRow('labour'),
                                className: "flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary transition-colors border border-primary/20 text-xs font-semibold",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PlusCircle$3e$__["PlusCircle"], {
                                        size: 14
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                        lineNumber: 49,
                                        columnNumber: 13
                                    }, this),
                                    " Labour Row"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                lineNumber: 45,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                        lineNumber: 38,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                lineNumber: 33,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "overflow-x-auto",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                    className: "w-full text-sm text-left",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                            className: "bg-muted/50 text-muted-foreground text-xs uppercase sticky top-0 z-0 shadow-sm",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        className: "px-3 py-2 font-medium w-6",
                                        children: "#"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                        lineNumber: 58,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        className: "px-3 py-2 font-medium w-8 text-center",
                                        title: "Allowed?",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ShieldAlert$3e$__["ShieldAlert"], {
                                            size: 12,
                                            className: "mx-auto opacity-50"
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                            lineNumber: 59,
                                            columnNumber: 86
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                        lineNumber: 59,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        className: "px-3 py-2 font-medium min-w-[250px]",
                                        children: "Particulars"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                        lineNumber: 60,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        className: "px-3 py-2 font-medium w-32",
                                        children: "Type"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                        lineNumber: 61,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        className: "px-3 py-2 font-medium w-28",
                                        children: "Est. (₹)"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                        lineNumber: 62,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        className: "px-3 py-2 font-medium w-28 text-primary",
                                        children: "Assessed (₹)"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                        lineNumber: 63,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        className: "px-3 py-2 font-medium w-20 text-danger text-center",
                                        children: "Dep %"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                        lineNumber: 64,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        className: "px-3 py-2 font-medium w-28 text-right pr-6",
                                        children: "Net (₹)"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                        lineNumber: 65,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        className: "px-2 py-2 font-medium w-10"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                        lineNumber: 66,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                lineNumber: 57,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                            lineNumber: 56,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                            className: "divide-y divide-border",
                            children: assessmentRows.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                    colSpan: 9,
                                    className: "px-6 py-12 text-center text-muted-foreground",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wrench$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wrench$3e$__["Wrench"], {
                                                size: 20,
                                                className: "opacity-50"
                                            }, void 0, false, {
                                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                                lineNumber: 74,
                                                columnNumber: 21
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                            lineNumber: 73,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-sm",
                                            children: "No items in assessment."
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                            lineNumber: 76,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-xs opacity-60",
                                            children: "Click the buttons above to add parts or labour."
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                            lineNumber: 77,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                    lineNumber: 72,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                lineNumber: 71,
                                columnNumber: 15
                            }, this) : assessmentRows.map((row, idx)=>{
                                // ─── Real-Time Math Output ─────────────────
                                const depRate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$depreciation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDepreciationRate"])(row.partType, ageMonths, depreciationType);
                                const depFactor = depRate / 100;
                                const netAssessed = row.assessed * (1 - depFactor);
                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                    className: `hover:bg-accent/30 transition-colors ${!row.allowed ? 'opacity-40 bg-muted/20' : ''}`,
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                            className: "px-3 py-2 text-xs font-medium text-muted-foreground",
                                            children: idx + 1
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                            lineNumber: 90,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                            className: "px-3 py-2 text-center",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                type: "checkbox",
                                                checked: row.allowed,
                                                onChange: ()=>toggleRowAllowed(row.id),
                                                className: "rounded border-border focus:ring-primary h-3.5 w-3.5 cursor-pointer accent-primary"
                                            }, void 0, false, {
                                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                                lineNumber: 94,
                                                columnNumber: 23
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                            lineNumber: 93,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                            className: "px-3 py-2",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                value: row.particulars,
                                                onChange: (e)=>updateAssessmentRow(row.id, {
                                                        particulars: e.target.value
                                                    }),
                                                className: "h-8 text-xs font-semibold lg:text-sm bg-transparent border-transparent hover:border-input focus:bg-background",
                                                placeholder: "Item Description"
                                            }, void 0, false, {
                                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                                lineNumber: 102,
                                                columnNumber: 23
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                            lineNumber: 101,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                            className: "px-2 py-2",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                value: row.partType,
                                                onChange: (e)=>{
                                                    const val = e.target.value;
                                                    updateAssessmentRow(row.id, {
                                                        partType: val,
                                                        section: val === 'labour' || val === 'paint' ? val : 'parts'
                                                    });
                                                },
                                                className: `h-8 w-full text-xs rounded-md border border-transparent hover:border-input focus:border-input focus:bg-background bg-transparent px-2 disabled:cursor-not-allowed
                          ${row.partType === 'metal' ? 'text-blue-500' : row.partType === 'plastic' ? 'text-amber' : row.partType === 'glass' ? 'text-teal' : row.partType === 'paint' ? 'text-purple-500' : 'text-sidebar-foreground'} font-medium
                        `,
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: "metal",
                                                        children: "🟦 Metal"
                                                    }, void 0, false, {
                                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                                        lineNumber: 127,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: "plastic",
                                                        children: "🟧 Plastic / Rubber"
                                                    }, void 0, false, {
                                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                                        lineNumber: 128,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: "glass",
                                                        children: "🟩 Glass"
                                                    }, void 0, false, {
                                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                                        lineNumber: 129,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: "paint",
                                                        children: "🎨 Paint Material"
                                                    }, void 0, false, {
                                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                                        lineNumber: 130,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: "labour",
                                                        children: "⚙️ Labour"
                                                    }, void 0, false, {
                                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                                        lineNumber: 131,
                                                        columnNumber: 25
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                                lineNumber: 110,
                                                columnNumber: 23
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                            lineNumber: 109,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                            className: "px-2 py-2",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                type: "number",
                                                value: row.estimated || '',
                                                onChange: (e)=>updateAssessmentRow(row.id, {
                                                        estimated: parseFloat(e.target.value) || 0
                                                    }),
                                                className: "h-8 text-xs text-right bg-transparent border-transparent hover:border-input focus:bg-background px-2",
                                                placeholder: "0.00",
                                                min: "0"
                                            }, void 0, false, {
                                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                                lineNumber: 135,
                                                columnNumber: 23
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                            lineNumber: 134,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                            className: "px-2 py-2",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                type: "number",
                                                value: row.assessed || '',
                                                onChange: (e)=>updateAssessmentRow(row.id, {
                                                        assessed: parseFloat(e.target.value) || 0
                                                    }),
                                                className: "h-8 text-xs text-right font-bold text-primary bg-transparent border-transparent hover:border-input focus:bg-background px-2",
                                                placeholder: "0.00",
                                                min: "0"
                                            }, void 0, false, {
                                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                                lineNumber: 145,
                                                columnNumber: 23
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                            lineNumber: 144,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                            className: "px-3 py-2 text-center text-xs font-bold text-danger bg-danger/5",
                                            children: row.allowed && row.section === 'parts' ? `${depRate}%` : '-'
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                            lineNumber: 154,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                            className: "px-3 py-2 text-right text-sm font-black pr-6 tabular-nums",
                                            children: row.allowed ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatCurrency"])(netAssessed) : '₹0.00'
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                            lineNumber: 157,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                            className: "px-2 py-2 text-center",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: ()=>deleteAssessmentRow(row.id),
                                                className: "text-muted-foreground hover:text-danger hover:bg-danger/10 p-1.5 rounded-md transition-colors",
                                                title: "Delete Row",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__["Trash2"], {
                                                    size: 14
                                                }, void 0, false, {
                                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                                    lineNumber: 166,
                                                    columnNumber: 25
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                                lineNumber: 161,
                                                columnNumber: 23
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                            lineNumber: 160,
                                            columnNumber: 21
                                        }, this)
                                    ]
                                }, row.id, true, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                                    lineNumber: 89,
                                    columnNumber: 19
                                }, this);
                            })
                        }, void 0, false, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                            lineNumber: 69,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                    lineNumber: 55,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
                lineNumber: 54,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx",
        lineNumber: 32,
        columnNumber: 5
    }, this);
}
_s(AssessmentGrid, "m7CseH5PCKWl8PbHGSE8sHDNoJw=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useClaimStore"]
    ];
});
_c = AssessmentGrid;
var _c;
__turbopack_context__.k.register(_c, "AssessmentGrid");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/index.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "applyDepreciation",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$depreciation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["applyDepreciation"],
    "calculateAssessmentSummary",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$assessment$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateAssessmentSummary"],
    "calculateFeeGST",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$gst$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateFeeGST"],
    "calculateFeeSummary",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$fees$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateFeeSummary"],
    "calculateLabourGST",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$gst$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateLabourGST"],
    "calculatePartsGST",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$gst$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculatePartsGST"],
    "createAssessmentRow",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$assessment$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createAssessmentRow"],
    "formatCurrency",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatCurrency"],
    "formatCurrencyShort",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatCurrencyShort"],
    "formatDateDMY",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatDateDMY"],
    "formatDateTimeDMY",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatDateTimeDMY"],
    "generateId",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["generateId"],
    "getAgeLabel",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$depreciation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAgeLabel"],
    "getDepPolicyLabel",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$depreciation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDepPolicyLabel"],
    "getDepreciationRate",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$depreciation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDepreciationRate"],
    "getFeeLineItems",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$fees$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getFeeLineItems"],
    "getVehicleAgeMonths",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$depreciation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getVehicleAgeMonths"],
    "numberToWords",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["numberToWords"],
    "parseDateToISO",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parseDateToISO"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$depreciation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/depreciation.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$gst$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/gst.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$assessment$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/assessment.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$fees$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/fees.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/utils.ts [app-client] (ecmascript)");
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/separator.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Separator",
    ()=>Separator
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$separator$2f$Separator$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/@base-ui/react/esm/separator/Separator.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/utils.ts [app-client] (ecmascript)");
"use client";
;
;
;
function Separator({ className, orientation = "horizontal", ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$separator$2f$Separator$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Separator"], {
        "data-slot": "separator",
        orientation: orientation,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/separator.tsx",
        lineNumber: 13,
        columnNumber: 5
    }, this);
}
_c = Separator;
;
var _c;
__turbopack_context__.k.register(_c, "Separator");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AssessmentSummary",
    ()=>AssessmentSummary
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/stores/claim-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/index.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/card.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/input.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/label.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$separator$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/separator.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
function AssessmentSummary() {
    _s();
    const { currentClaim, updateFeeBill } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useClaimStore"])();
    if (!currentClaim) return null;
    // Real-time zero-state math execution
    const summary = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["computeAssessmentSummary"])(currentClaim);
    const fb = currentClaim.feeBill;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
        className: "border-border shadow-lg sticky top-6",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardHeader"], {
                className: "bg-primary/5 border-b border-border pb-4",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardTitle"], {
                    className: "text-lg text-primary",
                    children: "Financial Summary"
                }, void 0, false, {
                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                    lineNumber: 22,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                lineNumber: 21,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                className: "p-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-5 space-y-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex justify-between items-center text-sm",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-muted-foreground",
                                        children: "Total Parts Assessed"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                        lineNumber: 28,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-semibold",
                                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatCurrency"])(summary.totalPartsAssessed)
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                        lineNumber: 29,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                lineNumber: 27,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex justify-between items-center text-sm text-danger",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: "Parts Depreciation"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                        lineNumber: 32,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-semibold",
                                        children: [
                                            "- ",
                                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatCurrency"])(summary.totalPartsDepreciation)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                        lineNumber: 33,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                lineNumber: 31,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$separator$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Separator"], {}, void 0, false, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                lineNumber: 35,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex justify-between items-center text-sm",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-muted-foreground",
                                        children: "Total Labour Assessed"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                        lineNumber: 38,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-semibold",
                                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatCurrency"])(summary.totalLabourAssessed)
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                        lineNumber: 39,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                lineNumber: 37,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex justify-between items-center text-sm text-amber",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: "Painting Material Dep (@25%)"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                        lineNumber: 43,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-semibold",
                                        children: [
                                            "- ",
                                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatCurrency"])(summary.totalPaintMaterialDepreciation)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                        lineNumber: 44,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                lineNumber: 42,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$separator$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Separator"], {}, void 0, false, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                lineNumber: 47,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex justify-between items-center text-sm font-semibold text-foreground",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: "Net Assessment before GST"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                        lineNumber: 50,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatCurrency"])(summary.netAssessmentBeforeTaxes)
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                        lineNumber: 51,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                lineNumber: 49,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex justify-between items-center text-sm",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-muted-foreground",
                                        children: "Total GST Additions"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                        lineNumber: 55,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-semibold",
                                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatCurrency"])(summary.totalGSTAmount)
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                        lineNumber: 56,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                lineNumber: 54,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex justify-between items-center text-sm text-sky-500",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: "Total IMT-23 Deductions"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                        lineNumber: 59,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-semibold",
                                        children: [
                                            "- ",
                                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatCurrency"])(summary.totalIMT23Deduction)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                        lineNumber: 60,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                lineNumber: 58,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                        lineNumber: 26,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "bg-muted/30 p-5 border-y border-border space-y-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex justify-between items-center",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "salvage-value",
                                            className: "text-xs text-muted-foreground uppercase tracking-wider",
                                            children: "Salvage Value (₹)"
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                            lineNumber: 67,
                                            columnNumber: 15
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                        lineNumber: 66,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                        id: "salvage-value",
                                        type: "number",
                                        value: fb.salvageValue || '',
                                        onChange: (e)=>updateFeeBill({
                                                salvageValue: parseFloat(e.target.value) || 0
                                            }),
                                        className: "text-right font-bold text-danger bg-background focus:ring-danger",
                                        placeholder: "0.00",
                                        min: "0"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                        lineNumber: 69,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                lineNumber: 65,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex justify-between items-center",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: "policy-excess",
                                            className: "text-xs text-muted-foreground uppercase tracking-wider",
                                            children: "Policy Excess (₹)"
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                            lineNumber: 82,
                                            columnNumber: 15
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                        lineNumber: 81,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                        id: "policy-excess",
                                        type: "number",
                                        value: fb.lessExcess || '',
                                        onChange: (e)=>updateFeeBill({
                                                lessExcess: parseFloat(e.target.value) || 0
                                            }),
                                        className: "text-right font-bold text-danger bg-background focus:ring-danger",
                                        placeholder: "1000.00",
                                        min: "0"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                        lineNumber: 84,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                lineNumber: 80,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                        lineNumber: 64,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-6 bg-card rounded-b-xl border-t-2 border-primary",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex justify-between items-end",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-xs font-bold text-primary uppercase tracking-widest mb-1",
                                            children: "Total Liability"
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                            lineNumber: 99,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-[10px] text-muted-foreground",
                                            children: "Net Payable to Insured"
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                            lineNumber: 100,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                    lineNumber: 98,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-3xl font-black text-foreground tracking-tight tabular-nums",
                                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatCurrency"])(summary.netLiability)
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                                    lineNumber: 102,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                            lineNumber: 97,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                        lineNumber: 96,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
                lineNumber: 25,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx",
        lineNumber: 20,
        columnNumber: 5
    }, this);
}
_s(AssessmentSummary, "dx0xS9Rx2NUG3lDIakcQx/F+U00=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useClaimStore"]
    ];
});
_c = AssessmentSummary;
var _c;
__turbopack_context__.k.register(_c, "AssessmentSummary");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/AssessmentTab.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AssessmentTab",
    ()=>AssessmentTab
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/stores/claim-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$claim$2f$AssessmentGrid$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$claim$2f$AssessmentSummary$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSummary.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/label.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
function AssessmentTab() {
    _s();
    const { currentClaim, setDepreciationType } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useClaimStore"])();
    if (!currentClaim) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "p-6 lg:p-8 max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                className: "text-2xl font-bold tracking-tight",
                                children: "Assessment"
                            }, void 0, false, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/AssessmentTab.tsx",
                                lineNumber: 17,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-muted-foreground text-sm mt-1",
                                children: "Build the assessment grid. Calculations apply IMT-23 and GST automatically based on part types."
                            }, void 0, false, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/AssessmentTab.tsx",
                                lineNumber: 18,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/AssessmentTab.tsx",
                        lineNumber: 16,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-3 bg-card p-3 rounded-xl border border-border",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                htmlFor: "dep-type",
                                className: "font-semibold text-sm",
                                children: "Policy Depreciation:"
                            }, void 0, false, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/AssessmentTab.tsx",
                                lineNumber: 24,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                id: "dep-type",
                                value: currentClaim.depreciationType,
                                onChange: (e)=>setDepreciationType(e.target.value),
                                className: "h-8 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary font-bold text-primary",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                        value: "standard",
                                        children: "Standard (Age Based)"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/AssessmentTab.tsx",
                                        lineNumber: 31,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                        value: "nil",
                                        children: "Nil Depreciation"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/AssessmentTab.tsx",
                                        lineNumber: 32,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                        value: "zero",
                                        children: "Zero Depreciation"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/AssessmentTab.tsx",
                                        lineNumber: 33,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/AssessmentTab.tsx",
                                lineNumber: 25,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/AssessmentTab.tsx",
                        lineNumber: 23,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/AssessmentTab.tsx",
                lineNumber: 15,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-1 lg:grid-cols-12 gap-8 items-start",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "lg:col-span-8 xl:col-span-9",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$claim$2f$AssessmentGrid$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AssessmentGrid"], {}, void 0, false, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/AssessmentTab.tsx",
                            lineNumber: 41,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/AssessmentTab.tsx",
                        lineNumber: 40,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "lg:col-span-4 xl:col-span-3",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$claim$2f$AssessmentSummary$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AssessmentSummary"], {}, void 0, false, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/AssessmentTab.tsx",
                            lineNumber: 46,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/AssessmentTab.tsx",
                        lineNumber: 45,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/AssessmentTab.tsx",
                lineNumber: 38,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/AssessmentTab.tsx",
        lineNumber: 14,
        columnNumber: 5
    }, this);
}
_s(AssessmentTab, "0iBbHYN4lRWnBluHL0Q3LIPy3Zs=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useClaimStore"]
    ];
});
_c = AssessmentTab;
var _c;
__turbopack_context__.k.register(_c, "AssessmentTab");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/storage/indexeddb.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "addToSyncQueue",
    ()=>addToSyncQueue,
    "deleteClaim",
    ()=>deleteClaim,
    "getAllClaims",
    ()=>getAllClaims,
    "getClaim",
    ()=>getClaim,
    "getLearningData",
    ()=>getLearningData,
    "getSyncQueue",
    ()=>getSyncQueue,
    "removeSyncItem",
    ()=>removeSyncItem,
    "saveClaim",
    ()=>saveClaim,
    "saveLearningData",
    ()=>saveLearningData
]);
// ═══════════════════════════════════════════════════════════
// INDEXEDDB STORAGE — Offline-First Persistence
// Using 'idb' library for a clean async wrapper.
// Replaces: localStorage-based loadClaims/saveClaims
// ═══════════════════════════════════════════════════════════
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$idb$2f$build$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/idb/build/index.js [app-client] (ecmascript)");
;
const DB_NAME = 'surveyos-v2';
const DB_VERSION = 1;
let dbPromise = null;
function getDB() {
    if (!dbPromise) {
        dbPromise = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$idb$2f$build$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["openDB"])(DB_NAME, DB_VERSION, {
            upgrade (db) {
                // Claims store
                if (!db.objectStoreNames.contains('claims')) {
                    const claimStore = db.createObjectStore('claims', {
                        keyPath: 'id'
                    });
                    claimStore.createIndex('by-updated', 'updatedAt');
                    claimStore.createIndex('by-survey-type', 'surveyType');
                }
                // Sync queue for offline actions
                if (!db.objectStoreNames.contains('syncQueue')) {
                    db.createObjectStore('syncQueue', {
                        keyPath: 'id'
                    });
                }
                // Learning data
                if (!db.objectStoreNames.contains('learning')) {
                    db.createObjectStore('learning', {
                        keyPath: 'id'
                    });
                }
            }
        });
    }
    return dbPromise;
}
async function saveClaim(claim) {
    const db = await getDB();
    await db.put('claims', {
        ...claim,
        updatedAt: new Date().toISOString()
    });
}
async function getClaim(id) {
    const db = await getDB();
    return db.get('claims', id);
}
async function getAllClaims() {
    const db = await getDB();
    return db.getAllFromIndex('claims', 'by-updated');
}
async function deleteClaim(id) {
    const db = await getDB();
    await db.delete('claims', id);
}
async function addToSyncQueue(type, payload) {
    const db = await getDB();
    await db.put('syncQueue', {
        id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        payload,
        createdAt: new Date().toISOString(),
        retries: 0
    });
}
async function getSyncQueue() {
    const db = await getDB();
    return db.getAll('syncQueue');
}
async function removeSyncItem(id) {
    const db = await getDB();
    await db.delete('syncQueue', id);
}
async function saveLearningData(key, data) {
    const db = await getDB();
    await db.put('learning', {
        id: key,
        ...data
    });
}
async function getLearningData(key) {
    const db = await getDB();
    return db.get('learning', key);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/hooks/useAutoSave.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useAutoSave",
    ()=>useAutoSave
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/stores/claim-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$storage$2f$indexeddb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/storage/indexeddb.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
;
;
function useAutoSave(debounceMs = 1000) {
    _s();
    const { currentClaim, isDirty, markClean } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useClaimStore"])();
    const timerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const lastSavedUpdateRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useAutoSave.useEffect": ()=>{
            // If we have no claim or it isn't marked dirty, do nothing
            if (!currentClaim || !isDirty) return;
            // Avoid saving if the timestamp hasn't actually changed since last save
            if (lastSavedUpdateRef.current === currentClaim.updatedAt) return;
            // Clear previous timer
            if (timerRef.current) clearTimeout(timerRef.current);
            // Set new timer for debounce
            timerRef.current = setTimeout({
                "useAutoSave.useEffect": async ()=>{
                    try {
                        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$storage$2f$indexeddb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["saveClaim"])(currentClaim);
                        lastSavedUpdateRef.current = currentClaim.updatedAt;
                        markClean();
                        console.log(`[AutoSave] Claim ${currentClaim.id} saved to IndexedDB`);
                    } catch (err) {
                        console.error('[AutoSave] Failed to save claim:', err);
                    }
                }
            }["useAutoSave.useEffect"], debounceMs);
            // Cleanup timer on unmount
            return ({
                "useAutoSave.useEffect": ()=>{
                    if (timerRef.current) clearTimeout(timerRef.current);
                }
            })["useAutoSave.useEffect"];
        }
    }["useAutoSave.useEffect"], [
        currentClaim,
        isDirty,
        debounceMs,
        markClean
    ]);
}
_s(useAutoSave, "nzSQvS7pVn0B5vKJO9vg2D87fU0=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useClaimStore"]
    ];
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/dialogs/NewClaimDialog.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "NewClaimDialog",
    ()=>NewClaimDialog
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$ui$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/stores/ui-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/stores/claim-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/card.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/input.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/ui/label.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
function NewClaimDialog() {
    _s();
    const { isNewClaimDialogOpen, setNewClaimDialogOpen, setActiveTab } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$ui$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUIStore"])();
    const { newClaim, loadClaim } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useClaimStore"])();
    const [vehicleNo, setVehicleNo] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [surveyType, setSurveyType] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('final');
    if (!isNewClaimDialogOpen) return null;
    const handleCreate = ()=>{
        if (!vehicleNo.trim()) return;
        // newClaim is a synchronous factory inside the Zustand store
        newClaim(surveyType, 'private'); // Defaulting to private, can be changed in settings later
        // We already generated it, but we need to fetch it to set registration no.
        // However, newClaim automatically creates and sets currentClaim.
        __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useClaimStore"].getState().updateVehicle({
            registrationNumber: vehicleNo.toUpperCase()
        });
        // Reset and close
        setVehicleNo('');
        setNewClaimDialogOpen(false);
        // Route to details
        setActiveTab('details');
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
            className: "w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardHeader"], {
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardTitle"], {
                        children: "Create New Claim"
                    }, void 0, false, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/dialogs/NewClaimDialog.tsx",
                        lineNumber: 40,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/dialogs/NewClaimDialog.tsx",
                    lineNumber: 39,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                    className: "space-y-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    children: "Vehicle Registration No."
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/dialogs/NewClaimDialog.tsx",
                                    lineNumber: 44,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    autoFocus: true,
                                    className: "uppercase text-lg font-bold",
                                    placeholder: "e.g. MH01AB1234",
                                    value: vehicleNo,
                                    onChange: (e)=>setVehicleNo(e.target.value),
                                    onKeyDown: (e)=>e.key === 'Enter' && handleCreate()
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/dialogs/NewClaimDialog.tsx",
                                    lineNumber: 45,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/dialogs/NewClaimDialog.tsx",
                            lineNumber: 43,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    children: "Survey Type"
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/dialogs/NewClaimDialog.tsx",
                                    lineNumber: 56,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex gap-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: ()=>setSurveyType('spot'),
                                            className: `flex-1 py-2 text-sm font-semibold rounded-md border ${surveyType === 'spot' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`,
                                            children: "Spot"
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/dialogs/NewClaimDialog.tsx",
                                            lineNumber: 58,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: ()=>setSurveyType('final'),
                                            className: `flex-1 py-2 text-sm font-semibold rounded-md border ${surveyType === 'final' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`,
                                            children: "Final"
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/dialogs/NewClaimDialog.tsx",
                                            lineNumber: 64,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: ()=>setSurveyType('reinspection'),
                                            className: `flex-1 py-2 text-sm font-semibold rounded-md border ${surveyType === 'reinspection' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`,
                                            children: "Re-inspection"
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/dialogs/NewClaimDialog.tsx",
                                            lineNumber: 70,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/dialogs/NewClaimDialog.tsx",
                                    lineNumber: 57,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/dialogs/NewClaimDialog.tsx",
                            lineNumber: 55,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/dialogs/NewClaimDialog.tsx",
                    lineNumber: 42,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardFooter"], {
                    className: "flex justify-end gap-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: ()=>setNewClaimDialogOpen(false),
                            className: "px-4 py-2 rounded-md text-sm font-semibold text-muted-foreground hover:bg-muted",
                            children: "Cancel"
                        }, void 0, false, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/dialogs/NewClaimDialog.tsx",
                            lineNumber: 80,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: handleCreate,
                            disabled: !vehicleNo.trim(),
                            className: "px-4 py-2 rounded-md text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-50",
                            children: "Create Claim"
                        }, void 0, false, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/dialogs/NewClaimDialog.tsx",
                            lineNumber: 86,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/dialogs/NewClaimDialog.tsx",
                    lineNumber: 79,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/dialogs/NewClaimDialog.tsx",
            lineNumber: 38,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/dialogs/NewClaimDialog.tsx",
        lineNumber: 37,
        columnNumber: 5
    }, this);
}
_s(NewClaimDialog, "BYf6KPH7oKn9MPPZllHtpMu0+d4=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$ui$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUIStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useClaimStore"]
    ];
});
_c = NewClaimDialog;
var _c;
__turbopack_context__.k.register(_c, "NewClaimDialog");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Home
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$layout$2f$sidebar$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/layout/sidebar.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$ui$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/stores/ui-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/stores/claim-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$layout$2d$dashboard$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LayoutDashboard$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/layout-dashboard.js [app-client] (ecmascript) <export default as LayoutDashboard>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/plus.js [app-client] (ecmascript) <export default as Plus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clock$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Clock$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/clock.js [app-client] (ecmascript) <export default as Clock>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trending$2d$up$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__TrendingUp$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/trending-up.js [app-client] (ecmascript) <export default as TrendingUp>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileCheck$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/file-check.js [app-client] (ecmascript) <export default as FileCheck>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/lucide-react/dist/esm/icons/zap.js [app-client] (ecmascript) <export default as Zap>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$tabs$2f$DetailsTab$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/DetailsTab.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$tabs$2f$AssessmentTab$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/tabs/AssessmentTab.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$hooks$2f$useAutoSave$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/hooks/useAutoSave.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$dialogs$2f$NewClaimDialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/dialogs/NewClaimDialog.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
'use client';
;
;
;
;
// ─── Dashboard Tab Content ──────────────────────────────
function DashboardContent() {
    _s();
    const { setNewClaimDialogOpen } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$ui$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUIStore"])();
    const { claimsList } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useClaimStore"])();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "p-6 lg:p-8 max-w-6xl mx-auto",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-8",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                        className: "text-2xl lg:text-3xl font-bold text-foreground tracking-tight",
                        children: [
                            "SurveyOS ",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-primary",
                                children: "V2"
                            }, void 0, false, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                lineNumber: 25,
                                columnNumber: 20
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                        lineNumber: 24,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-muted-foreground text-sm mt-1",
                        children: "Motor Insurance Survey Platform — AI-Powered, Offline-First"
                    }, void 0, false, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                        lineNumber: 27,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                lineNumber: 23,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>setNewClaimDialogOpen(true),
                        className: "group flex items-center gap-4 p-5 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/15 hover:border-primary/30 transition-all",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "w-11 h-11 rounded-lg bg-primary flex items-center justify-center text-primary-foreground",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                                    size: 22
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                    lineNumber: 39,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                lineNumber: 38,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-left",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "text-sm font-semibold text-foreground",
                                        children: "New Claim"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                        lineNumber: 42,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "text-xs text-muted-foreground",
                                        children: "Start a survey"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                        lineNumber: 43,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                lineNumber: 41,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                        lineNumber: 34,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: "group flex items-center gap-4 p-5 rounded-xl bg-card border border-border hover:border-primary/30 transition-all",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "w-11 h-11 rounded-lg bg-secondary flex items-center justify-center text-secondary-foreground",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileCheck$3e$__["FileCheck"], {
                                    size: 22
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                    lineNumber: 49,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                lineNumber: 48,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-left",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "text-sm font-semibold text-foreground",
                                        children: "Open Claim"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                        lineNumber: 52,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "text-xs text-muted-foreground",
                                        children: [
                                            claimsList.length,
                                            " saved"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                        lineNumber: 53,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                lineNumber: 51,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                        lineNumber: 47,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: "group flex items-center gap-4 p-5 rounded-xl bg-card border border-border hover:border-primary/30 transition-all",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "w-11 h-11 rounded-lg bg-secondary flex items-center justify-center text-secondary-foreground",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__["Zap"], {
                                    size: 22
                                }, void 0, false, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                    lineNumber: 59,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                lineNumber: 58,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-left",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "text-sm font-semibold text-foreground",
                                        children: "Quick Extract"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                        lineNumber: 62,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "text-xs text-muted-foreground",
                                        children: "AI document scan"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                        lineNumber: 63,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                lineNumber: 61,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                        lineNumber: 57,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                lineNumber: 33,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8",
                children: [
                    {
                        label: 'Claims Today',
                        value: '0',
                        icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$layout$2d$dashboard$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LayoutDashboard$3e$__["LayoutDashboard"], {
                            size: 16
                        }, void 0, false, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                            lineNumber: 71,
                            columnNumber: 54
                        }, this),
                        color: 'text-primary'
                    },
                    {
                        label: 'This Week',
                        value: '0',
                        icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trending$2d$up$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__TrendingUp$3e$__["TrendingUp"], {
                            size: 16
                        }, void 0, false, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                            lineNumber: 72,
                            columnNumber: 51
                        }, this),
                        color: 'text-success'
                    },
                    {
                        label: 'Pending',
                        value: '0',
                        icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clock$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Clock$3e$__["Clock"], {
                            size: 16
                        }, void 0, false, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                            lineNumber: 73,
                            columnNumber: 49
                        }, this),
                        color: 'text-amber'
                    },
                    {
                        label: 'Total Claims',
                        value: String(claimsList.length),
                        icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileCheck$3e$__["FileCheck"], {
                            size: 16
                        }, void 0, false, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                            lineNumber: 74,
                            columnNumber: 76
                        }, this),
                        color: 'text-muted-foreground'
                    }
                ].map((stat)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-4 rounded-xl bg-card border border-border",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-2 mb-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: stat.color,
                                        children: stat.icon
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                        lineNumber: 78,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-[10px] font-semibold text-muted-foreground uppercase tracking-wider",
                                        children: stat.label
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                        lineNumber: 79,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                lineNumber: 77,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-2xl font-bold text-foreground",
                                children: stat.value
                            }, void 0, false, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                lineNumber: 81,
                                columnNumber: 13
                            }, this)
                        ]
                    }, stat.label, true, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                        lineNumber: 76,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                lineNumber: 69,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-xl bg-card border border-border overflow-hidden",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "px-5 py-4 border-b border-border flex items-center justify-between",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                className: "text-sm font-semibold text-foreground",
                                children: "Recent Claims"
                            }, void 0, false, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                lineNumber: 89,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-[10px] text-muted-foreground",
                                children: [
                                    claimsList.length,
                                    " total"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                lineNumber: 90,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                        lineNumber: 88,
                        columnNumber: 9
                    }, this),
                    claimsList.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-8 text-center",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-muted-foreground/40 text-4xl mb-3",
                                children: "📋"
                            }, void 0, false, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                lineNumber: 94,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-sm text-muted-foreground",
                                children: "No claims yet"
                            }, void 0, false, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                lineNumber: 95,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs text-muted-foreground/60 mt-1",
                                children: 'Click "New Claim" to start your first survey'
                            }, void 0, false, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                lineNumber: 96,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                        lineNumber: 93,
                        columnNumber: 11
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "divide-y divide-border",
                        children: claimsList.slice(0, 10).map((claim)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "px-5 py-3 hover:bg-accent/50 cursor-pointer transition-colors flex items-center justify-between",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "text-sm font-medium text-foreground",
                                                children: claim.label || 'Untitled Claim'
                                            }, void 0, false, {
                                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                                lineNumber: 108,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "text-[10px] text-muted-foreground",
                                                children: [
                                                    claim.surveyType.toUpperCase(),
                                                    " • ",
                                                    new Date(claim.updatedAt).toLocaleDateString()
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                                lineNumber: 109,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                        lineNumber: 107,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: `text-[9px] font-bold px-2 py-0.5 rounded-full ${claim.surveyType === 'spot' ? 'bg-amber-soft text-amber' : claim.surveyType === 'final' ? 'bg-teal-soft text-teal' : 'bg-secondary text-secondary-foreground'}`,
                                        children: claim.surveyType.toUpperCase()
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                        lineNumber: 113,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, claim.id, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                                lineNumber: 103,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                        lineNumber: 101,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                lineNumber: 87,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
        lineNumber: 21,
        columnNumber: 5
    }, this);
}
_s(DashboardContent, "RUl910fZM2Nt099EvHnE+L4k6do=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$ui$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUIStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$claim$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useClaimStore"]
    ];
});
_c = DashboardContent;
;
;
;
;
// ─── Placeholder for other tabs ─────────────────────────
function TabPlaceholder({ tab }) {
    if (tab === 'details') return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$tabs$2f$DetailsTab$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DetailsTab"], {}, void 0, false, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
        lineNumber: 136,
        columnNumber: 33
    }, this);
    if (tab === 'assessment') return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$tabs$2f$AssessmentTab$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AssessmentTab"], {}, void 0, false, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
        lineNumber: 137,
        columnNumber: 36
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-col items-center justify-center h-full min-h-[60vh]",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "text-center",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "text-4xl mb-3 opacity-30",
                    children: "🚧"
                }, void 0, false, {
                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                    lineNumber: 142,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "text-lg font-semibold text-foreground capitalize",
                    children: tab
                }, void 0, false, {
                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                    lineNumber: 143,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "text-sm text-muted-foreground mt-1",
                    children: "Coming in Phase 4"
                }, void 0, false, {
                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                    lineNumber: 144,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
            lineNumber: 141,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
        lineNumber: 140,
        columnNumber: 5
    }, this);
}
_c1 = TabPlaceholder;
function Home() {
    _s1();
    const { activeTab } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$ui$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUIStore"])();
    // Enable offline-first sync (1000ms debounce on keystrokes)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$hooks$2f$useAutoSave$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAutoSave"])(1000);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex h-screen overflow-hidden",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$layout$2f$sidebar$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Sidebar"], {}, void 0, false, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                lineNumber: 159,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$layout$2f$sidebar$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MobileMenuButton"], {}, void 0, false, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                lineNumber: 160,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
                className: "flex-1 overflow-y-auto bg-background",
                children: activeTab === 'dashboard' ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DashboardContent, {}, void 0, false, {
                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                    lineNumber: 163,
                    columnNumber: 38
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TabPlaceholder, {
                    tab: activeTab
                }, void 0, false, {
                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                    lineNumber: 163,
                    columnNumber: 61
                }, this)
            }, void 0, false, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                lineNumber: 162,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$components$2f$dialogs$2f$NewClaimDialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NewClaimDialog"], {}, void 0, false, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
                lineNumber: 167,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/app/page.tsx",
        lineNumber: 158,
        columnNumber: 5
    }, this);
}
_s1(Home, "PCRSbSIb3H/8662bvgumjkrX5mw=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$stores$2f$ui$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUIStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$hooks$2f$useAutoSave$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAutoSave"]
    ];
});
_c2 = Home;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "DashboardContent");
__turbopack_context__.k.register(_c1, "TabPlaceholder");
__turbopack_context__.k.register(_c2, "Home");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=OneDrive_Desktop_Antigravity%20Surveyor%20V6%20fixed_SurveyOS-Prime-V2_src_059e~h4._.js.map