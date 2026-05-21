# Project Bramha

> [!status] **STATUS: LIVE IN SHADOW MODE**
> The backend infrastructure (Firebase Cloud Functions + Gemini Embeddings) and the Admin Simulator are deployed and currently active in Shadow Mode.

**Project Bramha** is the designated intelligence engine and autonomous reasoning module for SurveyOS Prime V2 (motorSurveyos). 

While the core SurveyOS app acts as the interface and basic data extraction layer, Bramha is the system that will "learn" from past assessments, evaluate new claims autonomously, and generate comprehensive reports.

All development for this module is isolated to ensure the main SurveyOS platform remains stable during Bramha's evolution.

---

## 1. The Core AI Fundamentals (How it Learns)

Bramha's ability to learn relies on three foundational AI concepts rather than traditional hardcoded rules or complex ML model training:

### A. Embeddings (The Translation of Meaning)
An embedding converts text (like an assessment stating *"Replaced Swift front bumper due to heavy collision"*) into a high-dimensional list of numbers. These numbers represent the *meaning* and *context* of the text. Mathematically, an embedding for a Swift bumper replacement will sit very close to a Dzire bumper replacement, and far from a windshield replacement. 

### B. Vector Database (Native Firestore)
Instead of relying on third-party services like Pinecone, Bramha uses **Firebase's Native Vector Search**. When a claim is completed, a Cloud Function generates the embedding using Gemini and stores it directly into a special `bramha_memories` collection inside Firestore. When a new claim arrives, Firestore uses the `findNearest` vector function to instantly retrieve the most conceptually similar past claims.

### C. RAG (Retrieval-Augmented Generation)
RAG is the "Open-Book Test" method. Large Language Models (like Gemini) hallucinate when answering from memory. With RAG, Bramha first retrieves the closest past assessments from the Vector DB, attaches them to the prompt, and asks the AI to evaluate the new claim *based exactly on those past examples*. This ensures Bramha flawlessly mimics past business logic.

---

## 2. Proposed Architecture: "Agentic RAG"

Bramha operates using specialized AI Agents:
1. **Agent A (The Extractor):** Reads the policy and RC (currently active in SurveyOS).
2. **Agent B (The Assessor):** Looks at photos, queries the Vector Database for similar past claims, and drafts the new assessment grid.
3. **Agent C (The Reviewer):** Checks Agent B's work against IRDAI compliance rules and depreciation tables.

---

## 3. Infrastructure & Cost Strategy

To support the Vector Database and background processing, Bramha requires backend capabilities:

### The Backend Requirement
- **Current State:** SurveyOS runs purely on the Firebase Blaze (Pay-as-you-go) plan.
- **The Architecture:** 100% Google-Native. Cloud Functions listen for claim completions, Gemini generates embeddings via Server Actions, and Firestore securely stores the vector data.
- **Cost Reality:** The Blaze free tier is massive (2 million invocations/month). The actual monthly cost to run Bramha will likely remain **$0.00** at current scale.

---

## 4. Collective Intelligence & Privacy

Bramha is designed as a **Global Collective Intelligence**. 
If Surveyor A accurately assesses a complex vehicle damage, Bramha learns it. When Surveyor B encounters a similar scenario, Bramha uses Surveyor A's logic as the blueprint.

**Privacy Protocol:** The Firebase Cloud Function *must* strip all Personal Identifiable Information (PII) such as customer names, policy numbers, and chassis numbers before generating the embedding. Bramha only learns the "mechanics" (parts, labor, depreciation).

---

## 5. Phased Rollout: "Shadow Mode"

Bramha will be trained on real data before users ever interact with it.

1. **Phase 1: Silent Observation**
   - Bramha's infrastructure is deployed. 
   - As surveyors use SurveyOS normally, a Cloud Function silently anonymizes completed assessments, embeds them, and stores them in the Vector DB.
2. **Phase 2: Developer "Shadow Mode"**
   - A hidden Admin Dashboard allows the developer to run test claims against the collective intelligence. 
   - The developer tunes the prompts and RAG logic until Bramha's output matches human expert reasoning.
3. **Phase 3: Beta Release (The Junior Assistant)**
   - Bramha is exposed to users via an "Auto-Draft Assessment" button.
   - Bramha pre-fills the grid. The surveyor reviews, adjusts, and approves. 
   - Adjustments feed back into the Vector DB, creating a continuous improvement loop.

---

## 6. Development Rules

- **Folder Isolation:** All Bramha-specific code, Vector DB clients, and RAG logic must reside in a dedicated `Bramha/` folder.
- **One-Way Dependency:** Bramha can read data from SurveyOS, but SurveyOS must not depend on Bramha until Phase 3. If Bramha breaks, the core app must continue functioning normally.
