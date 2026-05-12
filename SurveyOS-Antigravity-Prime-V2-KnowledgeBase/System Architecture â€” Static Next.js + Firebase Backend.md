---
source_file: "docs/ARCHITECTURE.md"
type: "document"
community: "AI Instructions & Security"
location: "line 1"
tags:
  - graphify/document
  - graphify/EXTRACTED
  - community/AI_Instructions_&_Security
---

# System Architecture â€” Static Next.js + Firebase Backend

## Connections
- [[3-Layer Persistence Model (In-Memory  Local  Cloud)]] - `implements` [EXTRACTED]
- [[AI Extraction Pipeline â€” useAIExtraction â†’ processor â†’ AIReviewDialog]] - `references` [EXTRACTED]
- [[Authentication Flow â€” Google Sign-In + SubscriptionGuard]] - `references` [EXTRACTED]
- [[Component Tree â€” AuthSyncWrapper â†’ AuthGate â†’ SubscriptionGuard â†’ Dashboard]] - `references` [EXTRACTED]
- [[Firestore Data Model â€” users  claims  newSignups  ai_config]] - `references` [EXTRACTED]
- [[Firestore Security Rules â€” isAdmin() Role-Based]] - `references` [EXTRACTED]
- [[Graphify Graph Report â€” 586 nodes  967 edges  38 communities]] - `references` [EXTRACTED]
- [[Knowledge Base â€” 01 Architecture and Status]] - `semantically_similar_to` [INFERRED]
- [[Launch Checklist â€” Security, Access, Features, DevOps]] - `references` [EXTRACTED]
- [[Report Generation Builders Table (PDFWordExcel)]] - `references` [EXTRACTED]
- [[SurveyOS Prime V2 â€” AI-Powered Survey Management Platform]] - `implements` [EXTRACTED]
- [[Zustand Stores â€” useAuthStore  useClaimStore  useProfileStore  useUIStore]] - `references` [EXTRACTED]

#graphify/document #graphify/EXTRACTED #community/AI_Instructions_&_Security