import { useState, useEffect } from 'react'
import { db } from '../firebase.js'
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { logActivity, formatDate } from '../utils.js'
import Header from '../components/Header.jsx'
import { Toast, PageHeader, Modal, SectionCard, Empty } from '../components/UI.jsx'

export default function AnnouncementsPage({ user, navigate, onLogout, currentPage, onRefreshUser }) {
  const [list, setList] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ title:'', content:'', pinned:false })
  const [toast, setToast] = useState('')
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),2500) }

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'announcements'), snap => {
      const data = snap.docs.map(d => ({ ...d.data(), id:d.id })).sort((a,b)=>(b.createdAt?.toMillis?.()??0)-(a.createdAt?.toMillis?.()??0))
      setList(data)
      // Mark as read
      localStorage.setItem('lastReadAnnouncement', Date.now().toString())
    })
    return () => unsub()
  }, [])

  const handleAdd = async () => {
    if (!form.title.trim() || !form.content.trim()) return
    await addDoc(collection(db, 'announcements'), { ...form, createdBy:user.id, createdByName:user.name, createdAt:serverTimestamp() })
    await logActivity({ userId:user.id, userName:user.name, action:'공지사항 등록', itemDesc:form.title })
    setForm({ title:'', content:'', pinned:false })
    setModal(false)
    showToast('📣 공지사항이 등록되었습니다')
  }

  const handleDelete = async (id, title) => {
    if (!window.confirm(`"${title}" 공지사항을 삭제할까요?`)) return
    await deleteDoc(doc(db, 'announcements', id))
    await logActivity({ userId:user.id, userName:user.name, action:'공지사항 삭제', itemDesc:title })
    showToast('🗑️ 삭제되었습니다')
  }

  const togglePin = async (id, current) => {
    await updateDoc(doc(db, 'announcements', id), { pinned: !current })
    showToast(!current ? '📌 상단 고정되었습니다' : '공지가 고정 해제되었습니다')
  }

  const pinned = list.filter(a => a.pinned)
  const normal = list.filter(a => !a.pinned)

  const iS = { width:'100%', padding:'10px 13px', background:'#0a1120', border:'1px solid #1e2e50', borderRadius:8, color:'#e2e8f0', fontSize:14, outline:'none', fontFamily:"'Noto Sans KR',sans-serif" }

  const Card = ({ item }) => (
    <div style={{ padding:'18px 20px', borderBottom:'1px solid #192640', animation:'fadein 0.3s ease' }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10 }}>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            {item.pinned && <span style={{ fontSize:11, padding:'1px 7px', background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:4, color:'#fcd34d', fontWeight:700 }}>📌 고정</span>}
            <h3 style={{ fontSize:15, fontWeight:700, color:'#f1f5f9' }}>{item.title}</h3>
          </div>
          <div style={{ fontSize:11, color:'#3d4f6b', marginBottom:10 }}>
            {item.createdByName} · {formatDate(item.createdAt)}
          </div>
          <p style={{ fontSize:13, color:'#94a3b8', lineHeight:1.8, whiteSpace:'pre-wrap' }}>{item.content}</p>
        </div>
        {user.role === 'admin' && (
          <div style={{ display:'flex', gap:6, flexShrink:0 }}>
            <button onClick={()=>togglePin(item.id, item.pinned)} title={item.pinned?'고정 해제':'상단 고정'} style={{ padding:'4px 9px', background:item.pinned?'rgba(245,158,11,0.15)':'rgba(255,255,255,0.05)', border:`1px solid ${item.pinned?'rgba(245,158,11,0.3)':'#1e2e50'}`, borderRadius:6, color:item.pinned?'#fcd34d':'#64748b', cursor:'pointer', fontSize:12 }}>
              {item.pinned?'📌':'📍'}
            </button>
            <button onClick={()=>handleDelete(item.id, item.title)} style={{ padding:'4px 9px', background:'rgba(239,68,68,0.08)', border:'none', borderRadius:6, color:'#f87171', cursor:'pointer', fontSize:12 }}>🗑️</button>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#0d1526', fontFamily:"'Noto Sans KR',sans-serif" }}>
      <Header user={user} navigate={navigate} onLogout={onLogout} currentPage={currentPage} />
      <div style={{ maxWidth:800, margin:'0 auto', padding:'28px 20px' }}>
        <PageHeader title="📣 공지사항" onBack={()=>navigate('main')}>
          {user.role === 'admin' && (
            <button onClick={()=>setModal(true)} style={{ padding:'9px 18px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:9, color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>+ 공지 작성</button>
          )}
        </PageHeader>

        {/* Pinned */}
        {pinned.length > 0 && (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#fcd34d', marginBottom:10 }}>📌 고정 공지</div>
            <SectionCard style={{ border:'1px solid rgba(245,158,11,0.2)', background:'rgba(245,158,11,0.03)' }}>
              {pinned.map(a => <Card key={a.id} item={a} />)}
            </SectionCard>
          </div>
        )}

        {/* Normal */}
        <div>
          {pinned.length > 0 && <div style={{ fontSize:13, fontWeight:700, color:'#94a3b8', marginBottom:10 }}>전체 공지</div>}
          {normal.length === 0 && pinned.length === 0 ? <Empty icon="📣" message="등록된 공지사항이 없습니다" /> : (
            normal.length > 0 && (
              <SectionCard>
                {normal.map(a => <Card key={a.id} item={a} />)}
              </SectionCard>
            )
          )}
        </div>
      </div>

      {modal && (
        <Modal onClose={()=>setModal(false)}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <h3 style={{ fontSize:17, fontWeight:700, color:'#f1f5f9' }}>📣 공지사항 작성</h3>
            <button onClick={()=>setModal(false)} style={{ background:'none', border:'none', color:'#64748b', fontSize:20, cursor:'pointer' }}>✕</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:6 }}>제목 *</label>
              <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="공지 제목" style={iS} autoFocus />
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:6 }}>내용 *</label>
              <textarea value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} placeholder="공지 내용을 입력하세요" rows={5} style={{ ...iS, resize:'vertical' }} />
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, color:'#e2e8f0' }}>
              <input type="checkbox" checked={form.pinned} onChange={e=>setForm(f=>({...f,pinned:e.target.checked}))} style={{ width:16, height:16, accentColor:'#f59e0b' }} />
              📌 상단에 고정
            </label>
            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <button onClick={()=>setModal(false)} style={{ flex:1, padding:11, border:'1px solid #334155', borderRadius:9, background:'transparent', color:'#94a3b8', fontWeight:600, fontSize:14, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>취소</button>
              <button onClick={handleAdd} style={{ flex:2, padding:11, border:'none', borderRadius:9, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>등록하기</button>
            </div>
          </div>
        </Modal>
      )}
      <Toast message={toast} onClose={()=>setToast('')} />
    </div>
  )
}
