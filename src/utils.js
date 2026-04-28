import { db } from './firebase.js'
import { collection, addDoc, serverTimestamp, doc, setDoc, getDoc } from 'firebase/firestore'

// SHA-256 password hashing
export async function hashPassword(password) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
}

// Activity logger
export async function logActivity({ userId, userName, action, itemId = '', itemDesc = '', extra = '' }) {
  try {
    await addDoc(collection(db, 'activityLog'), {
      userId, userName, action, itemId, itemDesc, extra,
      timestamp: serverTimestamp(),
    })
  } catch (e) { console.warn('Log error:', e) }
}

// Presence: update online status in Firestore
export async function setOnline(userId) {
  try {
    await setDoc(doc(db, 'presence', userId), {
      online: true,
      lastSeen: serverTimestamp(),
    }, { merge: true })
  } catch (e) { console.warn(e) }
}

export async function setOffline(userId) {
  try {
    await setDoc(doc(db, 'presence', userId), {
      online: false,
      lastSeen: serverTimestamp(),
    }, { merge: true })
  } catch (e) { console.warn(e) }
}

// Format relative time
export function timeAgo(ts) {
  if (!ts) return '알 수 없음'
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return '방금 전'
  if (diff < 3600) return `${Math.floor(diff/60)}분 전`
  if (diff < 86400) return `${Math.floor(diff/3600)}시간 전`
  return `${Math.floor(diff/86400)}일 전`
}

export function formatDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

export function formatDateOnly(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`
}

export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

export function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}
