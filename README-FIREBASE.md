# Firebase Setup Guide

This app uses Firebase Authentication (Google Sign-In) and Firestore as its database.
Follow these steps to connect the app to your Firebase project.

> **Current credentials:** `firebase-config.js` already contains the real project credentials
> for `production-project-tracker`. The steps below are for reference / re-setup if needed.

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
    match /team_members/{doc} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/team_members/$(request.auth.uid)).data.role == 'Manager';
    }
    match /phase_config/{doc} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/team_members/$(request.auth.uid)).data.role == 'Manager';
    }
    match /projects/{doc} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null;
      allow delete: if false;
    }
    match /projects/{doc}/comments/{comment} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null &&
        (resource.data.authorUid == request.auth.uid ||
        get(/databases/$(database)/documents/team_members/$(request.auth.uid)).data.role == 'Manager');
    }
    match /projects/{doc}/activity_log/{entry} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if false;
    }
    match /weekly_tracker/{doc} {
      allow read, write: if request.auth != null;
    }
    match /weekly_dev_notes/{doc} {
      allow read, write: if request.auth != null;
    }
    match /notifications/{doc} {
      allow read, write: if request.auth != null &&
        resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
  }
}
```

> **Note on Manager role checks:** The security rules check
> `get(/databases/.../team_members/$(request.auth.uid)).data.role == 'Manager'`.
> This reads the Firestore `team_members` document where the document ID matches the
> user's Firebase UID. Make sure each team member's Firestore document has their UID
> set as the document ID (the app handles this automatically on first login via `updateMemberUID`).

---

## Step 6 — Authorize Your Domain

1. In the Firebase console, go to **Authentication → Settings → Authorized domains**.
2. Add your GitHub Pages URL: `https://<your-username>.github.io`.

---

## Step 7 — Deploy to GitHub Pages

1. Push all files (including the updated `firebase-config.js`) to your `main` branch.
2. In your GitHub repo, go to **Settings → Pages**.
3. Set the source to **Deploy from a branch → main → / (root)** → click **Save**.
4. Your app will be live at `https://<your-username>.github.io/<repo-name>/`.

---

## Firestore Data Model (reference)

| Collection          | Document ID              | Purpose                                     |
|---------------------|--------------------------|---------------------------------------------|
| `projects`          | auto-id                  | Project records (archived flag on document) |
| `projects/{id}/comments`    | auto-id          | Per-project comments (subcollection)        |
| `projects/{id}/activity_log`| auto-id          | Phase change history (subcollection)        |
| `team_members`      | Firebase UID             | Team member profiles                        |
| `phase_config`      | `default`                | Phase configuration array                   |
| `weekly_tracker`    | `YYYY-WNN`               | Weekly tracker entries per week             |
| `weekly_dev_notes`  | `YYYY-WNN_memberId`      | Developer notes per week/member             |
| `notifications`     | deterministic or auto-id | Per-user notification documents             |

---

## localStorage Policy

After the Firestore migration, only **one** key remains in localStorage:

| Key        | Purpose                      |
|------------|------------------------------|
| `pt_theme` | Dark/light mode preference   |

All other `pt_*` keys (team members, projects, weekly tracker, etc.) were one-time
migration sources and are removed after migration runs. The app does not write them back.
