# Firebase Setup Guide

This app uses Firebase Authentication (Google Sign-In) and Firestore as its database.
Follow these steps to connect the app to your Firebase project.

---

## Step 1 — Create a Firebase Project

1. Go to [https://firebase.google.com](https://firebase.google.com) and sign in.
2. Click **Go to console** → **Add project**.
3. Enter a project name (e.g. `production-project-tracker`).
4. Disable Google Analytics if you don't need it, then click **Create project**.

---

## Step 2 — Enable Google Sign-In

1. In the Firebase console, open your project.
2. Go to **Build → Authentication → Get started**.
3. Click the **Sign-in method** tab.
4. Click **Google** → toggle **Enable** → set a support email → click **Save**.

---

## Step 3 — Enable Firestore Database

1. Go to **Build → Firestore Database → Create database**.
2. Choose **Start in test mode** (you will lock it down with rules in Step 5).
3. Select a Cloud Firestore location closest to your users → click **Enable**.

---

## Step 4 — Add Your Config to firebase-config.js

1. In the Firebase console, go to **Project settings** (gear icon, top-left).
2. Scroll to **Your apps** → click the **</>** (Web) icon to register a web app.
3. Enter a nickname (e.g. `tracker-web`) → click **Register app**.
4. Copy the `firebaseConfig` object shown.
5. Open `firebase-config.js` in this project and replace the placeholder values:

```js
export const firebaseConfig = {
  apiKey:            "AIza...",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project-id",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123",
};
```

---

## Step 5 — Set Firestore Security Rules

1. In the Firebase console, go to **Firestore Database → Rules**.
2. Replace the default rules with the following, then click **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Authenticated users can read everything
    match /{document=**} {
      allow read: if request.auth != null;
    }

    // Authenticated users can write to these collections
    match /projects/{docId} {
      allow create, update: if request.auth != null;
      allow delete: if false;
    }

    match /comments/{docId} {
      // Any authenticated user can create; only the author or a Manager can update
      allow create: if request.auth != null;
      allow update: if request.auth != null &&
        (resource.data.authorUid == request.auth.uid ||
         request.auth.token.role == "Manager");
      allow delete: if false;
    }

    match /weeklyNotes/{docId} {
      allow create, update: if request.auth != null;
      allow delete: if false;
    }

    match /weeklyTracker/{docId} {
      allow create, update: if request.auth != null;
      allow delete: if false;
    }

    // Only Managers can write team members and phase config
    match /team_members/{docId} {
      allow create, update: if request.auth != null &&
        request.auth.token.role == "Manager";
      allow delete: if false;
    }

    match /phase_config/{docId} {
      allow create, update: if request.auth != null &&
        request.auth.token.role == "Manager";
      allow delete: if false;
    }
  }
}
```

> **Note on the Manager role:** The `request.auth.token.role == "Manager"` check relies on
> a custom claim set server-side via the Firebase Admin SDK or a Cloud Function.
> Until you wire that up, Manager-restricted writes will be blocked for all users in production.
> During initial testing you can temporarily allow writes and tighten the rules later.

---

## Step 6 — Deploy to GitHub Pages

1. Push all files (including the updated `firebase-config.js`) to your `main` branch.
2. In your GitHub repo, go to **Settings → Pages**.
3. Set the source to **Deploy from a branch → main → / (root)** → click **Save**.
4. Your app will be live at `https://<your-username>.github.io/<repo-name>/`.

> **Important:** Add your GitHub Pages URL to Firebase's list of authorized domains.
> Go to **Authentication → Settings → Authorized domains** and add your Pages URL.

---

## Firestore Data Model (reference)

| Collection       | Document ID       | Purpose                          |
|------------------|-------------------|----------------------------------|
| `projects`       | auto-id           | Project records                  |
| `team_members`   | auto-id           | Team member profiles             |
| `phase_config`   | `default`         | Phase configuration array        |
| `weeklyTracker`  | `YYYY-WNN`        | Weekly tracker entries per week  |
| `weeklyNotes`    | `YYYY-WNN_userId` | Developer notes per week/member  |
| `comments`       | auto-id           | Per-project comments             |
