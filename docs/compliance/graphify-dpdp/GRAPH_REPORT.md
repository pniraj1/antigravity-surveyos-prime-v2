# Graph Report - _graph_src  (2026-05-30)

## Corpus Check
- Corpus is ~842 words - fits in a single context window. You may not need a graph.

## Summary
- 48 nodes · 61 edges · 6 communities detected
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.71)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `users/{uid}/claims` - 17 edges
2. `bramha_memories (PII copy)` - 9 edges
3. `MotorSurveyOS` - 7 edges
4. `Surveyor (client)` - 6 edges
5. `Google Gemini (US)` - 6 edges
6. `AI doc extraction` - 5 edges
7. `US Firebase region` - 4 edges
8. `Insured (no consent)` - 3 edges
9. `Driver third-party` - 3 edges
10. `Role: Data Fiduciary` - 3 edges

## Surprising Connections (you probably didn't know these)
- `bramha_memories (PII copy)` --triggers--> `Role: Data Fiduciary`  [INFERRED]
  _graph_src/dpdp-actual-state-source.md → _graph_src/dpdp-actual-state-source.md  _Bridges community 4 → community 1_
- `Surveyor (client)` --is_client_of--> `MotorSurveyOS`  [EXTRACTED]
  _graph_src/dpdp-actual-state-source.md → _graph_src/dpdp-actual-state-source.md  _Bridges community 4 → community 0_
- `Surveyor (client)` --creates--> `users/{uid}/claims`  [EXTRACTED]
  _graph_src/dpdp-actual-state-source.md → _graph_src/dpdp-actual-state-source.md  _Bridges community 0 → community 3_
- `Insured (no consent)` --captured_into--> `users/{uid}/claims`  [EXTRACTED]
  _graph_src/dpdp-actual-state-source.md → _graph_src/dpdp-actual-state-source.md  _Bridges community 5 → community 3_
- `users/{uid}/claims` --copied_to--> `bramha_memories (PII copy)`  [EXTRACTED]
  _graph_src/dpdp-actual-state-source.md → _graph_src/dpdp-actual-state-source.md  _Bridges community 3 → community 1_

## Hyperedges (group relationships)
- **Non-consenting data principals** — insured, driver, accident_tp [EXTRACTED 1.00]
- **Cross-border AI egress** — eg_doc, eg_photo, eg_bank, tp_gemini, tp_groq [EXTRACTED 0.90]
- **Launch-blocking gaps** — gap_consent, gap_links, gap_purpose [EXTRACTED 1.00]

## Communities

### Community 0 - "Surveyor Account & Secrets"
Cohesion: 0.2
Nodes (10): ai_config/routing (plaintext keys), newSignups, users/{uid}/payments, users/{uid}/profile, Control: admin gating, HIGH: plaintext secrets, IndexedDB claims (unencrypted), localStorage profile (PAN/bank/keys) (+2 more)

### Community 1 - "Bramha Reuse & Retention"
Cohesion: 0.22
Nodes (9): ai_usage (no retention), bramha_memories (PII copy), Bramha embedding, Google Drive upload, HIGH: erasure incomplete, CRITICAL: purpose-limitation breach, HIGH: no retention, Google Drive (US) (+1 more)

### Community 2 - "Cross-border AI Extraction"
Cohesion: 0.25
Nodes (9): Bank-statement extraction, AI doc extraction, Insured-report narrative, Damage-photo analysis, MEDIUM: no DPA, HIGH: no redaction, Google Gemini (US), Groq (US) (+1 more)

### Community 3 - "Claims, Residency & IRDAI"
Cohesion: 0.29
Nodes (8): Accident third-party, users/{uid}/claims, Control: per-user Firestore isolation, Telemetry (GPS), HIGH: cross-border, no safeguard, IRDAI India-residency flag, US Firebase region, Workshop

### Community 4 - "Roles & Governance Gaps"
Cohesion: 0.29
Nodes (7): MEDIUM: no breach notification, MEDIUM: no grievance/export, CRITICAL: dead privacy/terms links, MotorSurveyOS, Role: Data Fiduciary, Role: Data Processor, Significant Data Fiduciary risk

### Community 5 - "Non-consenting Principals"
Cohesion: 0.4
Nodes (5): Driver third-party, MEDIUM: no age-gating, CRITICAL: no notice/consent, Legacy IndexedDB (never deleted), Insured (no consent)

## Knowledge Gaps
- **22 isolated node(s):** `Accident third-party`, `Workshop`, `Role: Data Processor`, `Significant Data Fiduciary risk`, `users/{uid}/profile` (+17 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `users/{uid}/claims` connect `Claims, Residency & IRDAI` to `Surveyor Account & Secrets`, `Bramha Reuse & Retention`, `Cross-border AI Extraction`, `Non-consenting Principals`?**
  _High betweenness centrality (0.689) - this node is a cross-community bridge._
- **Why does `bramha_memories (PII copy)` connect `Bramha Reuse & Retention` to `Surveyor Account & Secrets`, `Claims, Residency & IRDAI`, `Roles & Governance Gaps`?**
  _High betweenness centrality (0.355) - this node is a cross-community bridge._
- **Why does `Surveyor (client)` connect `Surveyor Account & Secrets` to `Claims, Residency & IRDAI`, `Roles & Governance Gaps`?**
  _High betweenness centrality (0.216) - this node is a cross-community bridge._
- **What connects `Accident third-party`, `Workshop`, `Role: Data Processor` to the rest of the system?**
  _22 weakly-connected nodes found - possible documentation gaps or missing edges._