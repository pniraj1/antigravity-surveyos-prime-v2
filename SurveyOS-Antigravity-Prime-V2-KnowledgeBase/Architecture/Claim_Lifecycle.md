# Claim Lifecycle Workflow

This document outlines the step-by-step lifecycle of a claim within SurveyOS Prime V2, from creation to finalization. Technical implementations of these stages are handled by our [[State_Management]] logic.

## Phase 1: Intake & Initiation
The lifecycle begins on the [[Dashboard]].
1.  **Creation**: Surveyor clicks "New Claim".
2.  **Type Selection**: Surveyor selects `Spot` or `Final`.
    *   *System Action*: The [[Sequential_Numbering]] engine pulls the next available report number (e.g. `FIN/2026/088`).
3.  **Instantiation**: A blank `ClaimData` object is created in memory and immediately saved to the [[IndexedDB_Schema]] as an active draft.

## Phase 2: Assessment & Deepening
The surveyor fills out the vehicle, policy, and damage assessment details. As more data is entered, the claim conceptually evolves. 

*   **Final Survey expansion**: If the user begins adding parts to the *Reinspection* section, the [[Dashboard]] automatically detects this footprint and updates the "Stage" badge to `Reinspection`.
*   **Bill Checks**: If a garager's bill is received, the surveyor inputs the bill details. The [[Dashboard]] detects `billTotal > 0` and updates the badge to `Bill-Check`.

All of these sub-stages inherit the exact same root `FIN` tracking number to maintain data pedigree.

## Phase 3: Financials
The surveyor heads to the Fee Bill tab.
1.  They record their professional fees, travel expenses, and photo charges.
2.  They manually toggle the `Fee Paid` status depending on if the insurer has cleared the invoice. This status shines brightly on the [[Dashboard]] so no revenue gets lost.

## Phase 4: Output Generation
With data complete, the claim must be exported. The app passes the live `ClaimData` into the [[Reporting_Engine]].
1.  **UIIC Selection**: If the insurer is UIIC, the Excel engine binds the data to the specific Excel `.xlsx` coordinate map and initiates a browser download.
2.  **Standard Selection**: If standard, the Power Print engine spins up a pristine HTML replica for physical printing or PDF generation.

## Phase 5: Archiving
Once the report has been emailed to the insurer and the fee received, the surveyor returns to the [[Dashboard]].
1.  They click the **Archive** button on the claim row.
2.  *System Action*: The `isActive` flag in the background is set to `false`. The claim disappears from the 'Active' list and drops cleanly into the 'Archived' list, concluding the lifecycle.

---
*For a non-technical overview of how to operate these steps, see the [[Surveyor_User_Manual]].*
