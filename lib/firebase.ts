'use client'

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

// 環境変数のバリデーション
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 環境変数がすべて設定されているかチェック
const isConfigValid = 
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.storageBucket &&
  firebaseConfig.messagingSenderId &&
  firebaseConfig.appId;

// Initialize Firebase (クライアントサイドのみ)
let app: FirebaseApp | undefined;

if (typeof window !== "undefined" && isConfigValid) {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
} else if (typeof window !== "undefined" && !isConfigValid) {
  console.error(
    'Firebase configuration is missing. Please check your .env.local file.'
  );
  console.error('Required environment variables:', {
    apiKey: !!firebaseConfig.apiKey,
    authDomain: !!firebaseConfig.authDomain,
    projectId: !!firebaseConfig.projectId,
    storageBucket: !!firebaseConfig.storageBucket,
    messagingSenderId: !!firebaseConfig.messagingSenderId,
    appId: !!firebaseConfig.appId,
  });
}

// Initialize Firebase Authentication (クライアントサイドのみ)
export const auth: Auth | null = typeof window !== "undefined" && app ? getAuth(app) : null;

// Initialize Firestore (クライアントサイドのみ)
export const db: Firestore | null = typeof window !== "undefined" && app ? getFirestore(app) : null;

export default app;

