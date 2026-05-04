import { useState, useEffect, useCallback } from 'react'
import { db } from './firebase.js'
import { doc, getDoc, setDoc, collection, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore'
import { ACCOUNTS, PASSWORD_HASHES, DEFAULT_PERMS, ADMIN_PERMS, INITIAL_ITEMS } from './constants.js'
import { setOnline, setOffline } from './utils.js'
import { firebaseSignIn, firebaseSignOut } from './firebase.js'

import LoginPage from './pages/LoginPage.jsx'
import MainPage from './pages/MainPage.jsx'
import ItemDetailPage from './pages/ItemDetailPage.jsx'
import PermissionPage from './pages/PermissionPage.jsx'
import MemoPage from './pages/MemoPage.jsx'
import ActivityLogPage from './pages/ActivityLogPage.jsx'
import CalendarPage from './pages/CalendarPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import AnnouncementsPage from './pages/AnnouncementsPage.jsx'
import AccountingPage from './pages/AccountingPage.jsx'

async function initFirestore() {
  // Init accounts (always update passwordHash to keep in sync)
  for (const acc of ACCOUNTS) {
    const ref = doc(db, 'accounts', acc.id)
    await setDoc(ref, { id: acc.id, name: acc.name, role: acc.role, passwordHash: PASSWORD_HASHES[acc.id] }, { merge: true })
  }
  // Init permissions
  for (const [uid, perms] of Object.entries(DEFAULT_PERMS)) {
    const ref = doc(db, 'permissions', uid)
    const snap = await getDoc(ref)
    if (!snap.exists()) await setDoc(ref, perms)
  }
  // Init items (only if collection is empty)
  const itemsSnap = await getDocs(collection(db, 'bugtracker'))
  if (itemsSnap.empty) {
    const batch = writeBatch(db)
    INITIAL_ITEMS.forEach(item => {
      batch.set(doc(db, 'bugtracker', item.id), { ...item, createdAt: serverTimestamp(), createdBy: 'boss' })
    })
    await batch.commit()
  } else {
    // Migrate existing items: add missing fields
    const batch = writeBatch(db)
    let needsWrite = false
    itemsSnap.docs.forEach(d => {
      const data = d.data()
      const updates = {}
      if (!data.bigCat) updates.bigCat = 'dev'
      if (data.assignee === undefined) updates.assignee = ''
      if (data.urgent === undefined) updates.urgent = false
      if (Object.keys(updates).length > 0) {
        batch.update(doc(db, 'bugtracker', d.id), updates)
        needsWrite = true
      }
    })
    if (needsWrite) await batch.commit()
  }
}

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('tt_user')) } catch { return null }
  })
  const [route, setRoute] = useState({ page: 'main', params: {} })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    initFirestore().then(() => setReady(true)).catch(console.error)
  }, [])

  // 세션 복원 시 Firebase 익명 인증도 복원
  useEffect(() => {
    if (user) {
      firebaseSignIn().catch(console.error)
    }
  }, [user?.id])

  const navigate = useCallback((page, params = {}) => {
    setRoute({ page, params })
    window.scrollTo(0, 0)
  }, [])

  const handleLogin = useCallback(async (u) => {
    // Firebase 익명 인증 먼저
    await firebaseSignIn()
    // Load permissions
    let permissions = ADMIN_PERMS
    if (u.role === 'member') {
      const snap = await getDoc(doc(db, 'permissions', u.id))
      permissions = snap.exists() ? snap.data() : DEFAULT_PERMS[u.id] || {}
    }
    const fullUser = { ...u, permissions }
    setUser(fullUser)
    sessionStorage.setItem('tt_user', JSON.stringify(fullUser))
    await setOnline(u.id)
    navigate('main')
  }, [navigate])

  const handleLogout = useCallback(async () => {
    if (user) await setOffline(user.id)
    await firebaseSignOut()
    setUser(null)
    sessionStorage.removeItem('tt_user')
    navigate('login')
  }, [user, navigate])

  // Heartbeat presence
  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => setOnline(user.id), 30000)
    const handleUnload = () => setOffline(user.id)
    window.addEventListener('beforeunload', handleUnload)
    return () => { clearInterval(interval); window.removeEventListener('beforeunload', handleUnload) }
  }, [user])

  // Refresh permissions on navigate
  const refreshUser = useCallback(async () => {
    if (!user || user.role === 'admin') return
    const snap = await getDoc(doc(db, 'permissions', user.id))
    if (snap.exists()) {
      const updated = { ...user, permissions: snap.data() }
      setUser(updated)
      sessionStorage.setItem('tt_user', JSON.stringify(updated))
    }
  }, [user])

  if (!ready) return (
    <div style={{ minHeight:'100vh', background:'#0d1526', display:'flex', alignItems:'center', justifyContent:'center', color:'#64748b', fontFamily:"'Noto Sans KR',sans-serif" }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:12, animation:'fadein 1s infinite alternate' }}>🛠️</div>
        <p>초기화 중...</p>
      </div>
    </div>
  )

  if (!user) return <LoginPage onLogin={handleLogin} />

  const props = { user, navigate, onLogout: handleLogout, currentPage: route.page }

  switch (route.page) {
    case 'main':         return <MainPage {...props} />
    case 'item':         return <ItemDetailPage {...props} itemId={route.params.id} />
    case 'permissions':  return user.role==='admin' ? <PermissionPage {...props} /> : <MainPage {...props} />
    case 'memo':         return <MemoPage {...props} />
    case 'activity':     return user.role==='admin' ? <ActivityLogPage {...props} /> : <MainPage {...props} />
    case 'calendar':     return <CalendarPage {...props} />
    case 'dashboard':    return <DashboardPage {...props} />
    case 'announcements':return <AnnouncementsPage {...props} onRefreshUser={refreshUser} />
    case 'accounting':   return user.role==='admin' ? <AccountingPage {...props} /> : <MainPage {...props} />
    default:             return <MainPage {...props} />
  }
}
