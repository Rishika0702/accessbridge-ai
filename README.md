# AccessBridge AI

AccessBridge AI helps people understand dense text, images, and PDFs through plain-language explanations, translation, and read-aloud output. Built for the **Sustainability & Social Impact** challenge track of AI Builder Cup 2026. The [official theme](https://aibuildercup.com/themes.html) explicitly includes increasing accessibility as a social-impact direction.

## What works

- Simplify text and documents with Gemini multimodal input.
- Describe images with key visible details, including text.
- Translate and explain in English, Hindi, Tamil, Telugu, Bengali, or Spanish.
- Read answers aloud with the browser speech engine.
- Save recent answers to Firestore when anonymous authentication and Firestore are enabled.

The app uses Firebase AI Logic with the Gemini Developer API. The Gemini credential is kept behind Firebase's proxy and is never placed in app source. Firebase web configuration values are public project identifiers, not a Gemini API secret. Firebase App Check must be configured and enforced before public release.

## Free-tier architecture

```text
Browser → Firebase Hosting (Spark)
        → Firebase AI Logic + App Check → Gemini Developer API free tier
        → Firebase Anonymous Auth → Firestore (user-owned history)
        → Browser speechSynthesis (read-aloud)
```

Cloud Run is deliberately omitted because a billing-enabled project is required. The submission form currently allows a prototype link deployed on GCP or Cloud Run; Firebase Hosting is a Google Cloud platform service. Verify final challenge interpretation before submitting.

## Local setup

1. Create a Firebase project on the **Spark** plan and register a Web app.
2. Enable **Firebase AI Logic** with the **Gemini Developer API** provider. Do not choose Vertex AI/Agent Platform if strict no-billing is required.
3. Configure **App Check** with reCAPTCHA v3 for the registered web app, and enforce it for AI Logic. Add localhost debug token for local testing as described in Firebase docs.
4. Enable **Anonymous** sign-in in Firebase Authentication.
5. Create a Firestore database in an available no-cost region, and deploy `firestore.rules` (or apply those rules in the console).
6. Copy `.env.example` to `.env.local` and fill the Firebase web app config and reCAPTCHA v3 site key. Do **not** put the Gemini API key in this file.
7. Run `npm install` and `npm run dev`.

## Deployment

Run `npm run build`, then deploy `dist` with Firebase Hosting. From a signed-in environment:

```sh
npx firebase-tools login
npx firebase-tools use <your-project-id>
npx firebase-tools deploy --only hosting,firestore:rules
```

Check the deployment URL in a signed-out browser and test text, image, translation, and read-aloud functionality. Free-tier quotas apply; keep the app within the Spark plan.

## Safety and privacy

Input is sent to Gemini only after the user presses Generate. Files are sent to Firebase AI Logic for processing and are not stored in Firestore. History contains only the generated response, under the anonymous user's ID. The app warns that AI can make mistakes. Avoid personal or sensitive data in hackathon demos.

## Submission status

A public URL, performance numbers, and video link must only be inserted after live verification. This repository contains no secrets. Rotate credentials that were pasted into chats before relying on them.

## Sources

- [Firebase AI Logic overview](https://firebase.google.com/docs/ai-logic)
- [Firebase AI Logic web quickstart](https://firebase.google.com/docs/ai-logic/get-started?platform=web)
- [Firebase AI Logic multimodal input](https://firebase.google.com/docs/ai-logic/generate-text)
- [Firebase Hosting quotas](https://firebase.google.com/docs/hosting/usage-quotas-pricing)
