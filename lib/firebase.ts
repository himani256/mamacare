import type { Analytics } from "firebase/analytics"
import { getAnalytics, isSupported } from "firebase/analytics"
import type { FirebaseApp } from "firebase/app"
import { getApp, getApps, initializeApp } from "firebase/app"
import type { Auth } from "firebase/auth"
import { GoogleAuthProvider, getAuth } from "firebase/auth"
import type { Firestore } from "firebase/firestore"
import { getFirestore } from "firebase/firestore"

const fallbackConfig = {
  apiKey: "AIzaSyBvKSN8KR5czo8SMXQPTTy1At5Jj4Y4kic",
  authDomain: "mamacare-c6b3f.firebaseapp.com",
  projectId: "mamacare-c6b3f",
  storageBucket: "mamacare-c6b3f.firebasestorage.app",
  messagingSenderId: "249345354506",
  appId: "1:249345354506:web:b07a7dcfe20c79981f68f3",
  measurementId: "G-7KXHT0CJCY",
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? fallbackConfig.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? fallbackConfig.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? fallbackConfig.projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? fallbackConfig.storageBucket,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? fallbackConfig.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? fallbackConfig.appId,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? fallbackConfig.measurementId,
}

const requiredKeys = (({ apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId }) => ({
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
}))(firebaseConfig)

const hasAllKeys = Object.values(requiredKeys).every((value) => typeof value === "string" && value.length > 0)

let firebaseApp: FirebaseApp | undefined
let auth: Auth | undefined
let db: Firestore | undefined
let analyticsPromise: Promise<Analytics | null> | undefined

if (hasAllKeys) {
  firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)
  auth = getAuth(firebaseApp)
  db = getFirestore(firebaseApp)

  if (typeof window !== "undefined") {
    analyticsPromise = isSupported()
      .then((supported) => (supported && firebaseApp ? getAnalytics(firebaseApp) : null))
      .catch(() => null)
  }
}

const googleAuthProvider = new GoogleAuthProvider()
googleAuthProvider.setCustomParameters({ prompt: "select_account" })

export const firebaseReady = Boolean(firebaseApp)
export { firebaseApp, auth, db, analyticsPromise, googleAuthProvider }

