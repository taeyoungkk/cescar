"use client"

import { initializeApp, getApps, getApp } from "firebase/app"
import { getMessaging, isSupported, type Messaging } from "firebase/messaging"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
}

const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean)

export function getFirebaseApp() {
  if (!hasFirebaseConfig) return null
  if (!getApps().length) {
    return initializeApp(firebaseConfig)
  }
  return getApp()
}

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (!(await isSupported())) return null
  const app = getFirebaseApp()
  if (!app) return null
  return getMessaging(app)
}
