import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

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
