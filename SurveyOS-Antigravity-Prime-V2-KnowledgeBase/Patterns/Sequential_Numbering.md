# Sequential Numbering Pattern

SurveyOS Prime V2 employs an automatic sequence allocator to ensure that all reports generate exact sequential numbers dynamically, eliminating manual input.

## Core Sequences
- **Spot Reports**: `SPO/{Year}/{Sequence}` (e.g., `SPO/2026/001`)
- **Final Reports**: `FIN/{Year}/{Sequence}` (e.g., `FIN/2026/001`)

## Inherited Sequences
Due to identical data models being used across nested stages of a Final survey, Reinspections and Bill checks do **not** generate new numeric sequences. They share the parent's sequence identifier, and tracking is achieved via the `SurveyType` and Dashboard `stage` flagging mechanics.

## Configuration
Controlled by the `profile-store`. Every surveyor profile acts as an individual counter container, maintaining the sequence pointers locally to allow multi-year scaling safely.
