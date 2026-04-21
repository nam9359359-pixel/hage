import { useState, useEffect, useRef } from 'react'
import { db } from '../firebase.js'
import { doc, onSnapshot, collection, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { ACCOUNTS, STATUS_STYLE, STATUS_LIST } from '../constants.js'
import { logActivity, formatDate } from '../utils.js'
import Header from '../components/Header.jsx'
import { Toast, PageHeader, SectionCard } from '../components/UI.jsx'

export default function ItemDetailPage({ user, navigate, onLogout, currentPage, itemId }) {
  const [item, setItem] = useState(null)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [toast, setToast] = useState('')
  const bottomRef = useRef(null)
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),2500) }

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'bugtracker', itemId), snap => {
      if (snap.exists()) setItem({ ...snap.data(), id: snap.id })
    })
    return () => unsub()
  }, [itemId])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'bugtracker', itemId, 'comments'), snap => {
      const data = snap.docs.map(d => ({ ...d.data(), id:d.id })).sort((a,b)=>(a.createdAt?.toMillis?.()??0)-(b.createdAt?.toMillis?.()??0))
      setComments(data)
    })
    return () => unsub()
  }, [itemId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [comments])

  const sendComment = async () => {
    if (!newComment.trim()) return
    await addDoc(collection(db, 'bugtracker', itemId, 'comments'), {
      text: newComment.trim(), userId: user.id, userName: user.name, createdAt: serverTimestamp()
    })
    await logActivity({ userId:user.id, userName:user.name, action:'댓글 작성', itemId, itemDesc:item?.desc||'' })
    setNewComment('')
    showToast('💬 댓글이 등록되었습니다')
  }

  if (!item) return <div style={{ minHeight:'100vh', background:'#0d1526', display:'flex', alignItems:'center', justifyContent:'center', color:'#64748b', fontFamily:"'Noto Sans KR',sans-serif" }}>불러오는 중...</div>

  const sc = STATUS_STYLE[item.status] || STATUS_STYLE['대기']
  const assignee = ACCOUNTS.find(a => a.id === item.assignee)?.name || ''

  return (
    <div style={{ minHeight:'100vh', background:'#0d1526', fontFamily:"'Noto Sans KR',sans-serif" }}>
      <Header user={user} navigate={navigate} onLogout={onLogout} currentPage={currentPage} />
      <div style={{ maxWidth:760, margin:'0 auto', padding:'28px 20px' }}>
        <PageHeader title="항목 상세" onBack={()=>navigate('main')} />

        {/* Item card */}
        <SectionCard style={{ marginBottom:24, padding:'24px 22px' }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:12, flexWrap:'wrap', marginBottom:16 }}>
            {item.urgent && <span style={{ fontSize:12, padding:'2px 10px', background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:50, color:'#f87171', fontWeight:700 }}>🚨 긴급</span>}
            <span style={{ fontSize:12, padding:'2px 10px', background:sc.bg, border:`1px solid ${sc.border}`, borderRadius:50, color:sc.color, fontWeight:700 }}>● {item.status}</span>
            {assignee && <span style={{ fontSize:12, padding:'2px 10px', background:'rgba(167,139,250,0.12)', border:'1px solid rgba(167,139,250,0.25)', borderRadius:50, color:'#a78bfa', fontWeight:600 }}>담당: {assignee}</span>}
          </div>
          {item.page && <div style={{ fontSize:12, color:'#93c5fd', fontWeight:600, background:'rgba(59,130,246,0.12)', display:'inline-block', borderRadius:6, padding:'2px 9px', marginBottom:10 }}>{item.page}</div>}
          <h2 style={{ fontSize:18, fontWeight:700, color:'#f1f5f9', lineHeight:1.5, marginBottom:10 }}>{item.desc}</h2>
          {item.detail && <div style={{ fontSize:13, color:'#94a3b8', background:'#0a1120', borderRadius:8, padding:'8px 12px', marginBottom:10 }}>💡 {item.detail}</div>}
          {item.imageUrl && <img src={item.imageUrl} alt="" style={{ maxWidth:'100%', borderRadius:10, border:'1px solid #1e2e50', marginTop:8, cursor:'pointer' }} onClick={()=>window.open(item.imageUrl,'_blank')} />}
          <div style={{ marginTop:14, fontSize:11, color:'#3d4f6b' }}>
            {item.createdAt && `등록일: ${formatDate(item.createdAt)}`}
            {item.createdBy && ` · ${ACCOUNTS.find(a=>a.id===item.createdBy)?.name||''}`}
          </div>
        </SectionCard>

        {/* Comments */}
        <div style={{ marginBottom:16, fontSize:14, fontWeight:700, color:'#cbd5e1' }}>💬 댓글 {comments.length}개</div>
        <SectionCard style={{ marginBottom:16 }}>
          {comments.length === 0 && <div style={{ padding:'30px', textAlign:'center', color:'#475569', fontSize:13 }}>첫 번째 댓글을 남겨보세요</div>}
          {comments.map((c, idx) => {
            const isMe = c.userId === user.id
            return (
              <div key={c.id} style={{ padding:'14px 18px', borderBottom:idx<comments.length-1?'1px solid #192640':'none' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:isMe?'rgba(59,130,246,0.2)':'rgba(255,255,255,0.06)', border:`1px solid ${isMe?'rgba(59,130,246,0.3)':'rgba(255,255,255,0.08)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:isMe?'#93c5fd':'#94a3b8', flexShrink:0 }}>{c.userName[0]}</div>
                  <span style={{ fontSize:13, fontWeight:700, color:isMe?'#93c5fd':'#e2e8f0' }}>{c.userName}</span>
                  <span style={{ fontSize:11, color:'#3d4f6b' }}>{formatDate(c.createdAt)}</span>
                </div>
                <div style={{ fontSize:14, color:'#cbd5e1', lineHeight:1.7, paddingLeft:36 }}>{c.text}</div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </SectionCard>

        {/* Comment input */}
        <div style={{ display:'flex', gap:10 }}>
          <input value={newComment} onChange={e=>setNewComment(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendComment()} placeholder="댓글 입력 후 Enter..." style={{ flex:1, padding:'11px 14px', background:'#111d35', border:'1px solid #1e2e50', borderRadius:10, color:'#e2e8f0', fontSize:14, outline:'none', fontFamily:"'Noto Sans KR',sans-serif" }} />
          <button onClick={sendComment} style={{ padding:'11px 20px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>등록</button>
        </div>
      </div>
      <Toast message={toast} onClose={()=>setToast('')} />
    </div>
  )
}
