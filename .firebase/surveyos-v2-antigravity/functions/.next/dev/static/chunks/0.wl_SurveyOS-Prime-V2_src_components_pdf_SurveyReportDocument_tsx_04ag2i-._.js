(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SurveyReportDocument",
    ()=>SurveyReportDocument
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
(()=>{
    const e = new Error("Cannot find module '@react-pdf/renderer'");
    e.code = 'MODULE_NOT_FOUND';
    throw e;
})();
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/lib/calculations/utils.ts [app-client] (ecmascript)");
;
;
;
// Optional: If we wanted custom fonts later, we register them here.
// For now, we rely on standard Helvetica which requires 0 bytes of loading.
const styles = StyleSheet.create({
    page: {
        padding: 30,
        fontFamily: 'Helvetica',
        fontSize: 10,
        color: '#111827'
    },
    header: {
        marginBottom: 20,
        textAlign: 'center',
        borderBottom: '1px solid #e5e7eb',
        paddingBottom: 10
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: 'Helvetica-Bold',
        marginBottom: 4
    },
    subtitle: {
        fontSize: 10,
        color: '#4b5563'
    },
    section: {
        marginBottom: 15
    },
    sectionTitle: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        backgroundColor: '#f3f4f6',
        padding: 4,
        marginBottom: 6,
        textTransform: 'uppercase'
    },
    row: {
        flexDirection: 'row',
        marginBottom: 4
    },
    colLabel: {
        width: '30%',
        fontFamily: 'Helvetica-Bold',
        fontSize: 9
    },
    colValue: {
        width: '70%',
        fontSize: 9
    },
    gridHeaderRow: {
        flexDirection: 'row',
        backgroundColor: '#e5e7eb',
        padding: 4,
        fontFamily: 'Helvetica-Bold',
        fontSize: 8
    },
    gridRow: {
        flexDirection: 'row',
        padding: 4,
        borderBottom: '1px solid #e5e7eb',
        fontSize: 8
    },
    colNo: {
        width: '5%'
    },
    colPart: {
        width: '35%'
    },
    colTy: {
        width: '10%'
    },
    colEst: {
        width: '15%',
        textAlign: 'right'
    },
    colAss: {
        width: '15%',
        textAlign: 'right'
    },
    colFirst: {
        width: '20%',
        textAlign: 'right'
    },
    summaryBox: {
        marginTop: 10,
        padding: 10,
        border: '1px solid #e5e7eb'
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
        fontSize: 9
    },
    summaryTotal: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 6,
        paddingTop: 6,
        borderTop: '1px solid #111827',
        fontFamily: 'Helvetica-Bold',
        fontSize: 10
    },
    photoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 10
    },
    photoBox: {
        marginBottom: 10
    },
    photoImage: {
        objectFit: 'contain'
    },
    photoCaption: {
        marginTop: 4,
        fontSize: 8,
        textAlign: 'center',
        fontFamily: 'Helvetica-Oblique'
    }
});
function SurveyReportDocument({ claim, summary }) {
    // Calculate dynamic photo size based on layout (4, 6, 8, 9)
    const getPhotoWidth = ()=>{
        if (claim.photoLayout === 4) return '48%';
        if (claim.photoLayout === 9) return '31%';
        return '48%'; // Default for 6 or 8 (we just fit them vertically)
    };
    const getPhotoHeight = ()=>{
        if (claim.photoLayout === 4) return 250;
        if (claim.photoLayout === 6) return 180;
        if (claim.photoLayout === 8) return 140;
        if (claim.photoLayout === 9) return 180;
        return 180;
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Document, {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Page, {
                size: "A4",
                style: styles.page,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                        style: styles.header,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                style: styles.title,
                                children: "MOTOR SURVEY REPORT"
                            }, void 0, false, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 142,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                style: styles.subtitle,
                                children: [
                                    "Report No: ",
                                    claim.reportNo || 'DRAFT',
                                    " | Date: ",
                                    claim.reportDate
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 143,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                        lineNumber: 141,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                        style: styles.section,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                style: styles.sectionTitle,
                                children: "1. Insurer Details"
                            }, void 0, false, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 147,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                                style: styles.row,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colLabel,
                                        children: "Insurer Name:"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 149,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colValue,
                                        children: claim.policy.insurerName || 'N/A'
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 150,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 148,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                                style: styles.row,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colLabel,
                                        children: "Policy Number:"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 153,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colValue,
                                        children: claim.policy.policyNumber || 'N/A'
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 154,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 152,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                                style: styles.row,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colLabel,
                                        children: "Insured Name:"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 157,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colValue,
                                        children: claim.policy.insuredName || 'N/A'
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 158,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 156,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                                style: styles.row,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colLabel,
                                        children: "IDV (₹):"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 161,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colValue,
                                        children: claim.policy.idv || 'N/A'
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 162,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 160,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                        lineNumber: 146,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                        style: styles.section,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                style: styles.sectionTitle,
                                children: "2. Vehicle Details"
                            }, void 0, false, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 167,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                                style: styles.row,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colLabel,
                                        children: "Registration No:"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 169,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colValue,
                                        children: claim.vehicle.registrationNumber || 'N/A'
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 170,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 168,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                                style: styles.row,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colLabel,
                                        children: "Make & Model:"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 173,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colValue,
                                        children: [
                                            claim.vehicle.make,
                                            " ",
                                            claim.vehicle.model
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 174,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 172,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                                style: styles.row,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colLabel,
                                        children: "Chassis Number:"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 177,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colValue,
                                        children: claim.vehicle.chassisNumber || 'N/A'
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 178,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 176,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                                style: styles.row,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colLabel,
                                        children: "Year of Mfg:"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 181,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colValue,
                                        children: claim.vehicle.yearOfManufacture || 'N/A'
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 182,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 180,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                        lineNumber: 166,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                        style: styles.section,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                style: styles.sectionTitle,
                                children: "3. Accident Details"
                            }, void 0, false, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 187,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                                style: styles.row,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colLabel,
                                        children: "Date of Loss:"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 189,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colValue,
                                        children: claim.accident.dateAndTime || 'N/A'
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 190,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 188,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                                style: styles.row,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colLabel,
                                        children: "Place of Accident:"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 193,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colValue,
                                        children: claim.accident.placeOfAccident || 'N/A'
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 194,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 192,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                                style: styles.row,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colLabel,
                                        children: "Cause:"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 197,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colValue,
                                        children: claim.accident.causeOfAccident || 'N/A'
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 198,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 196,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                        lineNumber: 186,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                lineNumber: 140,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Page, {
                size: "A4",
                style: styles.page,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                        style: styles.header,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                style: styles.title,
                                children: "ASSESSMENT SUMMARY"
                            }, void 0, false, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 206,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                style: styles.subtitle,
                                children: [
                                    claim.vehicle.registrationNumber,
                                    " | ",
                                    claim.vehicle.make,
                                    " ",
                                    claim.vehicle.model
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 207,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                        lineNumber: 205,
                        columnNumber: 9
                    }, this),
                    claim.assessmentRows.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                        style: styles.section,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                                style: styles.gridHeaderRow,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colNo,
                                        children: "#"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 213,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colPart,
                                        children: "Particulars"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 214,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colTy,
                                        children: "Type"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 215,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colEst,
                                        children: "Estimate"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 216,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.colAss,
                                        children: "Assessed"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 217,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 212,
                                columnNumber: 13
                            }, this),
                            claim.assessmentRows.filter((r)=>r.allowed).map((row, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                                    style: styles.gridRow,
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                            style: styles.colNo,
                                            children: idx + 1
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                            lineNumber: 222,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                            style: styles.colPart,
                                            children: row.particulars || 'Undefined Part'
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                            lineNumber: 223,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                            style: {
                                                ...styles.colTy,
                                                textTransform: 'capitalize'
                                            },
                                            children: row.partType
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                            lineNumber: 224,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                            style: styles.colEst,
                                            children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatCurrency"])(row.estimated)
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                            lineNumber: 225,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                            style: styles.colAss,
                                            children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatCurrency"])(row.assessed)
                                        }, void 0, false, {
                                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                            lineNumber: 226,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, row.id, true, {
                                    fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                    lineNumber: 221,
                                    columnNumber: 15
                                }, this))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                        lineNumber: 211,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                        style: styles.summaryBox,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                                style: styles.summaryRow,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        children: "Total Estimated Repairs:"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 235,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatCurrency"])(summary.totalEstimated)
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 236,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 234,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                                style: styles.summaryRow,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        children: "Total Parts Assessed (Base):"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 239,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatCurrency"])(summary.partsBase)
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 240,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 238,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                                style: styles.summaryRow,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        children: "Parts GST (CGST+SGST):"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 243,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatCurrency"])(summary.partsCGST + summary.partsSGST)
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 244,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 242,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                                style: styles.summaryRow,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        children: "Total Labour Assessed (Base):"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 247,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatCurrency"])(summary.labourBase)
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 248,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 246,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                                style: styles.summaryRow,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        children: "Labour GST:"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 251,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatCurrency"])(summary.labourGST)
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 252,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 250,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                                style: styles.summaryRow,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        children: "Less: Expected Salvage:"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 255,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        children: [
                                            "- ",
                                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatCurrency"])(summary.salvage)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 256,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 254,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                                style: styles.summaryRow,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        children: "Less: Policy Excess:"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 259,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        children: [
                                            "- ",
                                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatCurrency"])(summary.excess)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 260,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 258,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                                style: styles.summaryTotal,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        children: "NET ASSESSED LIABILITY:"
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 263,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$src$2f$lib$2f$calculations$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatCurrency"])(summary.netAssessedLoss)
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 264,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 262,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                style: {
                                    marginTop: 8,
                                    fontSize: 8,
                                    fontFamily: 'Helvetica-Oblique'
                                },
                                children: [
                                    "Amount In Words: ",
                                    summary.netInWords
                                ]
                            }, void 0, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 266,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                        lineNumber: 233,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                lineNumber: 204,
                columnNumber: 7
            }, this),
            claim.photos.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Page, {
                size: "A4",
                style: styles.page,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                        style: styles.header,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                            style: styles.title,
                            children: "VEHICLE DAMAGE PHOTOS"
                        }, void 0, false, {
                            fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                            lineNumber: 276,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                        lineNumber: 275,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                        style: styles.photoGrid,
                        children: claim.photos.map((photo, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(View, {
                                style: {
                                    ...styles.photoBox,
                                    width: getPhotoWidth()
                                },
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Image, {
                                        src: photo.dataUrl,
                                        style: {
                                            ...styles.photoImage,
                                            height: getPhotoHeight()
                                        }
                                    }, void 0, false, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 281,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$OneDrive$2f$Desktop$2f$Antigravity__Surveyor__V6__fixed$2f$SurveyOS$2d$Prime$2d$V2$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Text, {
                                        style: styles.photoCaption,
                                        children: [
                                            "Photo ",
                                            idx + 1,
                                            ": ",
                                            photo.name || 'Damage reference'
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                        lineNumber: 285,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, idx, true, {
                                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                                lineNumber: 280,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                        lineNumber: 278,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
                lineNumber: 274,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx",
        lineNumber: 138,
        columnNumber: 5
    }, this);
}
_c = SurveyReportDocument;
var _c;
__turbopack_context__.k.register(_c, "SurveyReportDocument");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx [app-client] (ecmascript, next/dynamic entry)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/src/components/pdf/SurveyReportDocument.tsx [app-client] (ecmascript)"));
}),
]);

//# sourceMappingURL=0.wl_SurveyOS-Prime-V2_src_components_pdf_SurveyReportDocument_tsx_04ag2i-._.js.map