# Consolidate Cloud Functions into V2 Repo — Design

## Problem

The Bramha Cloud Functions (`callAI` and `onClaimArchived`) live in `SurveyOS-Prime/functions/` which has no GitHub remote. If the laptop is lost, this code is gone. The SurveyOS-Prime-V2 repo on GitHub is missing the server-side half of the project.

## Solution

Move the functions source files into `SurveyOS-Prime-V2/functions/` so the entire project — client app + Cloud Functions + Firestore rules + knowledge base — lives in one GitHub repo.

## Changes

### 1. Copy source files into V2
Copy from `SurveyOS-Prime/functions/` → `SurveyOS-Prime-V2/functions/`:
- `index.js` — callAI gateway function
- `bramha.js` — onClaimArchived Bramha trigger
- `package.json` — Node 20 deps (firebase-admin, firebase-functions, node-fetch)

### 2. Update `SurveyOS-Prime-V2/firebase.json`
Add functions config block:
```json
"functions": [
  {
    "source": "functions",
    "codebase": "default",
    "ignore": ["node_modules", ".git"]
  }
]
```

### 3. Add `.env.example`
Create `SurveyOS-Prime-V2/.env.example` with placeholder keys so anyone cloning from GitHub knows what to create:
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 4. Verify `.gitignore`
Ensure `functions/node_modules/` is already ignored (it is — confirmed in existing .gitignore).

### 5. Commit and push to GitHub

## After This Change

**To run the project from a fresh clone:**
```bash
git clone https://github.com/pniraj1/antigravity-surveyos-prime-v2.git
cd antigravity-surveyos-prime-v2
cp .env.example .env.local   # fill in real values
npm install
npm run build
# For functions:
cd functions && npm install
```

**To deploy everything:**
```bash
firebase deploy --only hosting   # from SurveyOS-Prime-V2/
firebase deploy --only functions  # from SurveyOS-Prime-V2/
```

## What Does NOT Change
- The live website stays running — no redeployment needed
- The Cloud Functions stay running — no redeployment needed
- This is purely a source code organisation change
