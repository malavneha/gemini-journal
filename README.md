# Personal Gemini Journal

A clean, mobile-friendly journaling application built with React, Vite, Express, Firebase Authentication (Google Sign-In), Cloud Firestore, and the Google Gemini API (`@google/genai`).

---

## 🛡️ Security & Threat Model Implementation

1. **User Isolation**: All journal reflections are stored strictly under `/users/{userId}/interactions/{interactionId}`.
2. **Firestore Security Rules**: The application utilizes owner-bound path checking (`request.auth.uid == userId`) to prevent cross-user data exposure.
3. **Server-Side API Key Protection**: The Gemini API key is never exposed to the frontend browser bundle. All reflection requests are handled by the server proxy at `/api/journal/reflect`.
4. **Resilient AI Fallback Ladder**: The backend automatically falls back across `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.1-flash-lite`, and `gemini-flash-latest` upon transient errors or quota spikes.
5. **Undefined-Stripped Payloads**: Payloads are sanitized before Firestore persistence.

---

## 📋 Firestore Security Rules

Deploy these rules to your Firebase Firestore database:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 🔐 Google Cloud Secret Manager Setup

Store your Gemini API key in Secret Manager and authorize Cloud Run:

```bash
# 1. Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 2. Grant the Cloud Run runtime service account permission to access the secret
export PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 🚀 Cloud Run Deployment

```bash
# 1. Build and deploy container to Cloud Run
gcloud run deploy personal-gemini-journal \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets=GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --update-labels=dev-tutorial=cloud-run-ai-challenge
```

### Required Challenge Label Verification:
```bash
gcloud run services update personal-gemini-journal \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region us-central1
```

---

## 🧪 Functional Walkthrough & Test Guide

1. **Google Sign-In Test**:
   - Navigate to the application.
   - Verify the landing view displays the Google Sign-In prompt.
   - Click "Continue with Google".
   - Confirm sign-in transitions into the authenticated Journal view with avatar and email.

2. **Journal Submission & Gemini Reflection Test**:
   - In the "Today's Reflection" text box, enter: *"I finished my project milestone today and felt a sense of relief."*
   - Click **Save & Reflect** (or press `Ctrl+Enter`).
   - Verify loading spinner shows *"Reflecting with Gemini..."*.
   - Verify the newly created card appears with the user's thought and Gemini's formatted markdown reflection.

3. **Reflection to Action Plan Test**:
   - On the generated reflection card, tap the prominent **"Turn Reflection into Action Plan"** button.
   - Verify the loading state displays *"Analyzing reflection and creating your 4-step action plan with Gemini..."*.
   - Confirm that the structured **Action Plan** card renders directly below the reflection containing:
     1. **Key Insight**
     2. **Practical Next Step**
     3. **Micro-Action for Today** (< 10 mins)
     4. **Goal to Revisit Later**
   - Click **"Save Action Plan to Firestore"** (or verify auto-sync) and confirm the green checkmark state.
   - Test the **"Copy"** and **"Regenerate"** buttons on the action plan card.

4. **Firestore User Isolation Test**:
   - Verify the card and action plan are saved under `/users/{userId}/interactions/{interactionId}`.
   - Click the "Refresh" icon to ensure data reloads correctly from storage.

5. **Copy & Delete Interaction Test**:
   - Click the **Copy** button on a card to verify clipboard copy.
   - Click the **Delete** (Trash) icon on a card and confirm deletion.
   - Verify the card is removed from the list.

6. **Sign Out Test**:
   - Click the Sign Out icon in the top navigation bar.
   - Verify that the protected journal feed is cleared and returns to the Sign-In screen.
