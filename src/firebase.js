import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyAFs9xmFfguysn_Eu73fcEp4wxdVRghzdk",
  authDomain: "bugtracker-e32c0.firebaseapp.com",
  projectId: "bugtracker-e32c0",
  storageBucket: "bugtracker-e32c0.firebasestorage.app",
  messagingSenderId: "811623073823",
  appId: "1:811623073823:web:62654903bde916a7f62d2a"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const auth = getAuth(app)

// 익명 로그인 - 앱 비밀번호 인증 후 호출
export async function firebaseSignIn() {
  try {
    const current = auth.currentUser
    if (current) return current
    const result = await signInAnonymously(auth)
    return result.user
  } catch (e) {
    console.error('Firebase sign in error:', e)
    return null
  }
}

export function firebaseSignOut() {
  return auth.signOut()
}

export { onAuthStateChanged }
