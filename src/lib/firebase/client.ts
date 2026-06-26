"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { firebaseConfig } from "./config";

/**
 * Lazily-initialized browser Firebase singletons.
 *
 * Initialization is deferred to first use (always in the browser) rather than at
 * module load. This matters because client components are still imported during
 * SSR/prerender, where the public env vars may be absent — eagerly calling
 * getAuth() there throws `auth/invalid-api-key` and breaks the build.
 */
let appRef: FirebaseApp | undefined;
let authRef: Auth | undefined;
let dbRef: Firestore | undefined;
let storageRef: FirebaseStorage | undefined;

export function getFirebaseApp(): FirebaseApp {
  return (appRef ??= getApps().length
    ? getApp()
    : initializeApp(firebaseConfig));
}

/** Client-side Firebase Auth — sign in/up happen here to obtain an ID token. */
export function getClientAuth(): Auth {
  return (authRef ??= getAuth(getFirebaseApp()));
}

/** Client-side Firestore — used by realtime onSnapshot listeners. */
export function getDb(): Firestore {
  return (dbRef ??= getFirestore(getFirebaseApp()));
}

/** Client-side Firebase Storage. */
export function getClientStorage(): FirebaseStorage {
  return (storageRef ??= getStorage(getFirebaseApp()));
}
