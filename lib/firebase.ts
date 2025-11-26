import type { FirebaseApp } from "firebase/app"
import { getApp, getApps, initializeApp } from "firebase/app"
import type { Auth } from "firebase/auth"
import { getAuth } from "firebase/auth"
import type { Firestore } from "firebase/firestore"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const hasAllKeys = Object.values(firebaseConfig).every((value) => typeof value === "string" && value.length > 0)

let firebaseApp: FirebaseApp | undefined
let auth: Auth | undefined
let db: Firestore | undefined

if (hasAllKeys) {
  firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)
  auth = getAuth(firebaseApp)
  db = getFirestore(firebaseApp)
}

export const firebaseReady = Boolean(firebaseApp)
export { firebaseApp, auth, db }

