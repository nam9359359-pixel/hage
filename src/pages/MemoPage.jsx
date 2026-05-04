import { useState, useEffect, useRef } from 'react'
import { db } from '../firebase.js'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { formatDate } from '../utils.js'
import Header from '../components/Header.jsx'
import { Toast, PageHeader } from '../components/UI.jsx'

export default function MemoPage({ user, navigate, onLogout, currentPage }) {
  const [content, setContent] = useState('')
  const [updatedAt, setUpdatedAt] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const autoSaveRef = useRef(null)
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),2000) }

  // Load memo (only current user's)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'memos', user.id), snap => {
      if (snap.exists()) {
        setContent(snap.data().content || '')
        setUpdatedAt(snap.data().updatedAt)
      }
    })
    return () => unsub()
  }, [user.id])

  // Auto-save after 1.5s of inactivity
  const handleChange = (val) => {
    setContent(val)
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    autoSaveRef.current = setTimeout(() => save(val), 1500)
  }

  const save = async (text = content) => {
    setSaving(true)
    try {
      await setDoc(doc(db, 'memos', user.id), { content: text, updatedAt: serverTimestamp(), userId: user.id }, { merge: true })
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const handleSaveBtn = async () => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    await save()
    showToast('📝 메모가 저장되었습니다')
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0d1526', fontFamily:"'Noto Sans KR',sans-serif" }}>
      <Header user={user} navigate={navigate} onLogout={onLogout} currentPage={currentPage} />
      <div style={{ maxWidth:800, margin:'0 auto', padding:'28px 20px' }}>
        <PageHeader title={`📝 ${user.name}님의 메모`} onBack={()=>navigate('main')}>
          <div style={{ fontSize:12, color:'#475569' }}>
            {saving ? '저장 중...' : updatedAt ? `마지막 저장: ${formatDate(updatedAt)}` : '아직 저장된 메모가 없습니다'}
          </div>
          <button onClick={handleSaveBtn} style={{ padding:'8px 18px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:9, color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>💾 저장</button>
        </PageHeader>

        <div style={{ background:'#111d35', border:'1px solid #1e2e50', borderRadius:16, overflow:'hidden' }}>
          <div style={{ padding:'12px 18px', borderBottom:'1px solid #1e2e50', display:'flex', alignItems:'center', gap:8, fontSize:12, color:'#64748b' }}>
            <span>🔒 이 메모는 {user.name}님만 볼 수 있습니다</span>
            <span style={{ marginLeft:'auto' }}>{content.length}자</span>
          </div>
          <textarea
            value={content}
            onChange={e => handleChange(e.target.value)}
            placeholder={`${user.name}님만의 개인 메모 공간입니다.\n아이디어, 할 일, 기억해야 할 것들을 자유롭게 적어보세요.\n\n자동으로 저장됩니다 ✨`}
            style={{ width:'100%', minHeight:'60vh', padding:'20px 22px', background:'transparent', border:'none', outline:'none', color:'#e2e8f0', fontSize:15, lineHeight:1.8, resize:'vertical', fontFamily:"'Noto Sans KR',sans-serif" }}
          />
        </div>

        <div style={{ marginTop:14, padding:'12px 16px', background:'rgba(59,130,246,0.05)', border:'1px solid rgba(59,130,246,0.1)', borderRadius:10, fontSize:12, color:'#475569', lineHeight:1.7 }}>
          💡 입력 후 1.5초가 지나면 자동 저장됩니다. 다른 기기에서 로그인해도 동일한 메모가 표시됩니다.
        </div>
      </div>
      <Toast message={toast} onClose={()=>setToast('')} />
    </div>
  )
}
