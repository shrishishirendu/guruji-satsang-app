# Satsang Seva — Setup Guide

## What's built
A full React web app with Firebase backend, matching all 10 screens from the original app:

| Screen | Route |
|--------|-------|
| Welcome / landing | `/` |
| Register | `/register` |
| Registration confirmed | `/registered` |
| Sign in | `/login` |
| Satsangs calendar | `/satsangs` |
| Day view (list of satsangs on a date) | `/satsangs/2024-03-02` |
| Create invite | `/create-invite/2024-03-21` |
| View invite details | `/invite/:id` |
| Edit invite | `/edit-invite/:id` |
| Invite Sangat (select contacts) | `/invite/:id/invite-sangat` |
| Invite sent confirmation | `/invite/:id/invited` |
| RSVP | `/invite/:id/rsvp` |
| RSVP list with totals | `/invite/:id/rsvp-list` |

---

## Step 1 — Create your Firebase project

1. Go to https://console.firebase.google.com
2. Click **Add project** → give it a name (e.g. `satsang-seva`)
3. Enable **Google Analytics** if you want (optional)

---

## Step 2 — Enable Firebase services

### Authentication
1. Firebase Console → **Authentication** → Get started
2. Enable **Email/Password** sign-in provider

### Firestore
1. Firebase Console → **Firestore Database** → Create database
2. Start in **production mode**
3. Choose a region close to Australia (e.g. `asia-southeast1`)

### Storage → handled by Cloudinary (free, no card needed)
Firebase Storage now requires the paid **Blaze** plan, so invite-photo uploads use
**Cloudinary's** free tier instead. You do **not** enable Firebase Storage.

1. Create a free account at https://cloudinary.com (no credit card)
2. Dashboard → copy your **Cloud name**
3. Settings (gear) → **Upload** → **Add upload preset**
   - Signing Mode: **Unsigned**
   - (optional) Folder: `satsang-images`
   - Save, then copy the **preset name**
4. Open `src/cloudinary/upload.js` and paste both values into
   `CLOUD_NAME` and `UPLOAD_PRESET`

Everything else (Auth, Firestore, Hosting) stays on the free **Spark** plan.

---

## Step 3 — Add your Firebase config

1. Firebase Console → **Project Settings** → **Your apps** → **Web** → Register app
2. Copy the `firebaseConfig` object
3. Open `src/firebase/config.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey:            "AIzaSy...",
  authDomain:        "satsang-seva.firebaseapp.com",
  projectId:         "satsang-seva",
  storageBucket:     "satsang-seva.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123...",
};
```

---

## Step 4 — Apply security rules

### Firestore rules
1. Firebase Console → Firestore → **Rules** tab
2. Copy the contents of `firestore.rules` and paste → **Publish**

### Storage rules
Not needed — image uploads go to Cloudinary, not Firebase Storage.
(`storage.rules` is unused and can be ignored or deleted.)

### Firestore indexes
You need a composite index for RSVP queries. Either:
- Run the app and click the link in the browser console error (easiest), OR
- Firebase Console → Firestore → **Indexes** → Add composite index:
  - Collection: `rsvps`
  - Fields: `inviteId` (Ascending), `createdAt` (Ascending)

---

## Step 5 — Run locally

```bash
cd satsang-seva
npm install
npm start
```

Opens at http://localhost:3000

---

## Step 6 — Deploy to Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # select your project, build dir = "build", SPA = yes
npm run build
firebase deploy
```

Your app will be live at `https://YOUR_PROJECT_ID.web.app`

---

## Adding Guruji's photo

In `src/pages/Welcome.js`, replace the placeholder div with:

```jsx
<img
  src="/guruji.jpg"          // place guruji.jpg in /public folder
  alt="Guruji"
  className="w-48 h-56 rounded-2xl object-cover object-top"
/>
```

---

## WhatsApp notifications (future step)

For sending WhatsApp messages to non-app users, you'll use:
- **Twilio WhatsApp API** (easy to set up, pay-per-message)
- Or **WhatsApp Business API** directly

This would be a Firebase Cloud Function that triggers when a new invitation is created.
When you're ready, just ask and I'll build that Cloud Function for you.

---

## Project structure

```
satsang-seva/
├── src/
│   ├── firebase/
│   │   └── config.js          ← PUT YOUR FIREBASE CONFIG HERE
│   ├── cloudinary/
│   │   └── upload.js          ← PUT YOUR CLOUDINARY CLOUD NAME + PRESET HERE
│   ├── context/
│   │   └── AuthContext.js     ← Auth state + register/login/logout
│   ├── components/
│   │   ├── AppShell.js        ← Orange orb header layout
│   │   └── PrivateRoute.js    ← Auth guard
│   ├── pages/
│   │   ├── Welcome.js
│   │   ├── Register.js
│   │   ├── Registered.js
│   │   ├── Login.js
│   │   ├── SatsangsCalendar.js
│   │   ├── DayView.js
│   │   ├── CreateEditInvite.js
│   │   ├── ViewInvite.js
│   │   ├── RSVPPage.js
│   │   ├── RSVPList.js
│   │   ├── InviteSangat.js
│   │   └── InviteSent.js
│   ├── App.js                 ← All routes
│   └── index.css              ← Saffron design system
├── firestore.rules
├── storage.rules
└── SETUP.md                   ← This file
```
