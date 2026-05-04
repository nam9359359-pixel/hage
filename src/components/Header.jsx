import { useState, useEffect, useRef } from 'react'
import { db } from '../firebase.js'
import { collection, onSnapshot, doc, updateDoc, writeBatch, query, where, orderBy, limit } from 'firebase/firestore'
import { ACCOUNTS } from '../constants.js'
import { timeAgo, dueDateStatus } from '../utils.js'

export default function Header({ user, navigate, onLogout, currentPage }) {
  const [presence, setPresence] = useState({})
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [showNotif, setShowNotif] = useState(false)
  const [dueSoon, setDueSoon] = useState([])
  const notifRef = useRef(null)

  useEffect(() => {
    const unsub = onSnapshot(collection(db,'presence'), snap => {
      const p = {}
      snap.docs.forEach(d => { p[d.id] = d.data() })
      setPresence(p)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db,'announcements'), snap => {
      const lastRead = parseInt(localStorage.getItem('lastReadAnnouncement')||'0')
      let count = 0
      snap.docs.forEach(d => { const ts=d.data().createdAt?.toMillis?.()??0; if(ts>lastRead) count++ })
      setUnreadAnnouncements(count)
    })
    return () => unsub()
  }, [])

  // 내 알림 구독
  useEffect(() => {
    const q = query(collection(db,'notifications'), where('toUserId','==',user.id), orderBy('createdAt','desc'), limit(30))
    const unsub = onSnapshot(q, snap => {
      setNotifications(snap.docs.map(d=>({...d.data(),id:d.id})))
    })
    return () => unsub()
  }, [user.id])

  // 마감 임박 업무 (내 담당 or 전체 for admin)
  useEffect(() => {
    const unsub = onSnapshot(collection(db,'bugtracker'), snap => {
      const today = new Date(); today.setHours(0,0,0,0)
      const items = snap.docs.map(d=>({...d.data(),id:d.id}))
        .filter(item => {
          if (!item.dueDate) return false
          if (item.status === '완료' || item.status === '검토완료') return false
          if (user.role !== 'admin' && item.assignee !== user.id) return false
          const due = new Date(item.dueDate); due.setHours(0,0,0,0)
          const diff = Math.round((due-today)/(1000*60*60*24))
          return diff <= 3
        })
        .sort((a,b)=>a.dueDate.localeCompare(b.dueDate))
      setDueSoon(items)
    })
    return () => unsub()
  }, [user.id, user.role])

  // 패널 외부 클릭 시 닫기
  useEffect(() => {
    const handler = e => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unreadCount = notifications.filter(n=>!n.read).length + dueSoon.length

  const markAllRead = async () => {
    const unread = notifications.filter(n=>!n.read)
    if (!unread.length) return
    const batch = writeBatch(db)
    unread.forEach(n => batch.update(doc(db,'notifications',n.id),{read:true}))
    await batch.commit()
  }

  const markRead = async (id) => {
    await updateDoc(doc(db,'notifications',id),{read:true})
  }

  const navBtn = (icon, label, page, adminOnly=false, badge=0) => {
    if (adminOnly && user.role!=='admin') return null
    const active = currentPage===page
    return (
      <button onClick={()=>navigate(page)} title={label} style={{ position:'relative', padding:'6px 10px', background:active?'rgba(59,130,246,0.15)':'transparent', border:active?'1px solid rgba(59,130,246,0.3)':'1px solid transparent', borderRadius:8, color:active?'#93c5fd':'#94a3b8', fontSize:16, cursor:'pointer', transition:'all 0.15s' }}
        onMouseEnter={e=>{if(!active){e.currentTarget.style.color='#e2e8f0';e.currentTarget.style.background='rgba(255,255,255,0.05)'}}}
        onMouseLeave={e=>{if(!active){e.currentTarget.style.color='#94a3b8';e.currentTarget.style.background='transparent'}}}>
        {icon}
        {badge>0 && <span style={{ position:'absolute', top:-4, right:-4, background:'#ef4444', color:'#fff', fontSize:9, fontWeight:700, borderRadius:'50%', width:16, height:16, display:'flex', alignItems:'center', justifyContent:'center' }}>{badge>9?'9+':badge}</span>}
      </button>
    )
  }

  return (
    <div style={{ background:'#111d35', borderBottom:'1px solid #1e2e50', position:'sticky', top:0, zIndex:100 }}>
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'0 20px', display:'flex', alignItems:'center', gap:10, height:56 }}>
        <button onClick={()=>navigate('main')} style={{ display:'flex', flexDirection:'column', gap:1, background:'none', border:'none', cursor:'pointer' }}>
          <span style={{ fontSize:14, fontWeight:700, color:'#f1f5f9', letterSpacing:'-0.3px' }}>✈️ 여행하게</span>
          <span style={{ fontSize:10, color:'#475569' }}>출발은 혼자, 기억은 같이</span>
        </button>
        <div style={{ flex:1 }} />

        {/* 온라인 현황 */}
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          {ACCOUNTS.map(acc => {
            const p = presence[acc.id]
            const online = p?.online===true
            const isMe = acc.id===user.id
            return (
              <div key={acc.id} title={`${acc.name} · ${online?'온라인':timeAgo(p?.lastSeen)}`} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px', background:'rgba(255,255,255,0.04)', border:`1px solid ${isMe?'rgba(59,130,246,0.3)':'rgba(255,255,255,0.06)'}`, borderRadius:20, fontSize:11, color:isMe?'#93c5fd':'#94a3b8' }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:online?'#22c55e':'#475569', display:'inline-block', flexShrink:0 }}/>
                {acc.name}
              </div>
            )
          })}
        </div>

        <div style={{ width:1, height:24, background:'#1e2e50', margin:'0 4px' }}/>

        {/* 네비게이션 */}
        {navBtn('💰','가계부','accounting',true)}
        {navBtn('📣','공지사항','announcements',false,unreadAnnouncements)}
        {navBtn('📊','대시보드','dashboard')}
        {navBtn('📝','내 메모','memo')}
        {navBtn('📅','캘린더','calendar')}
        {navBtn('📋','활동 로그','activity',true)}
        {navBtn('🔑','권한 관리','permissions',true)}

        {/* 🔔 알림센터 */}
        <div ref={notifRef} style={{ position:'relative' }}>
          <button onClick={()=>{ setShowNotif(v=>!v); if(!showNotif) markAllRead() }}
            style={{ position:'relative', padding:'6px 10px', background:showNotif?'rgba(251,191,36,0.15)':'transparent', border:showNotif?'1px solid rgba(251,191,36,0.3)':'1px solid transparent', borderRadius:8, color:showNotif?'#fcd34d':'#94a3b8', fontSize:16, cursor:'pointer' }}>
            🔔
            {unreadCount>0 && <span style={{ position:'absolute', top:-4, right:-4, background:'#ef4444', color:'#fff', fontSize:9, fontWeight:700, borderRadius:'50%', width:16, height:16, display:'flex', alignItems:'center', justifyContent:'center' }}>{unreadCount>9?'9+':unreadCount}</span>}
          </button>

          {/* 알림 패널 */}
          {showNotif && (
            <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, width:340, background:'#111d35', border:'1px solid #1e2e50', borderRadius:14, boxShadow:'0 20px 50px rgba(0,0,0,0.5)', zIndex:200, overflow:'hidden', animation:'fadein 0.15s ease' }}>
              <div style={{ padding:'14px 16px', borderBottom:'1px solid #1e2e50', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:13, fontWeight:700, color:'#f1f5f9' }}>🔔 알림</span>
                {notifications.filter(n=>!n.read).length>0 && (
                  <button onClick={markAllRead} style={{ fontSize:11, color:'#64748b', background:'none', border:'none', cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>모두 읽음</button>
                )}
              </div>

              <div style={{ maxHeight:400, overflowY:'auto' }}>
                {/* 마감 임박 업무 */}
                {dueSoon.map(item => {
                  const ds = dueDateStatus(item.dueDate)
                  return (
                    <div key={`due_${item.id}`} onClick={()=>{ navigate('item',{id:item.id}); setShowNotif(false) }}
                      style={{ padding:'12px 16px', borderBottom:'1px solid #192640', cursor:'pointer', display:'flex', alignItems:'flex-start', gap:10 }}
                      onMouseEnter={e=>e.currentTarget.style.background='#162035'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <span style={{ fontSize:16, flexShrink:0 }}>📅</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:'#e2e8f0', marginBottom:2 }}>마감 임박</div>
                        <div style={{ fontSize:12, color:'#94a3b8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.desc}</div>
                        <span style={{ fontSize:10, padding:'1px 7px', borderRadius:99, background:ds?.bg, color:ds?.color, border:`1px solid ${ds?.border}`, marginTop:4, display:'inline-block', fontWeight:600 }}>{ds?.label}</span>
                      </div>
                    </div>
                  )
                })}

                {/* 일반 알림 */}
                {notifications.length===0&&dueSoon.length===0 && (
                  <div style={{ padding:'36px 0', textAlign:'center', color:'#475569', fontSize:13 }}>새 알림이 없습니다</div>
                )}
                {notifications.map(n => {
                  const typeIcon = { assign:'👤', comment:'💬', deadline:'📅', announce:'📣' }[n.type]||'🔔'
                  return (
                    <div key={n.id} onClick={()=>{ markRead(n.id); if(n.itemId) navigate('item',{id:n.itemId}); setShowNotif(false) }}
                      style={{ padding:'12px 16px', borderBottom:'1px solid #192640', cursor:'pointer', background:n.read?'transparent':'rgba(59,130,246,0.04)', display:'flex', alignItems:'flex-start', gap:10 }}
                      onMouseEnter={e=>e.currentTarget.style.background='#162035'} onMouseLeave={e=>e.currentTarget.style.background=n.read?'transparent':'rgba(59,130,246,0.04)'}>
                      <span style={{ fontSize:15, flexShrink:0 }}>{typeIcon}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                          <span style={{ fontSize:12, fontWeight:600, color: n.read?'#94a3b8':'#e2e8f0' }}>{n.title}</span>
                          {!n.read && <span style={{ width:6, height:6, borderRadius:'50%', background:'#3b82f6', display:'inline-block', flexShrink:0 }}/>}
                        </div>
                        <div style={{ fontSize:12, color:'#64748b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.body}</div>
                        <div style={{ fontSize:10, color:'#3d4f6b', marginTop:3 }}>{timeAgo(n.createdAt)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ width:1, height:24, background:'#1e2e50', margin:'0 4px' }}/>
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, fontSize:12, color:'#cbd5e1', fontWeight:600 }}>
          {user.role==='admin'?'👑':'👤'} {user.name}
        </div>
        <button onClick={onLogout} style={{ padding:'6px 11px', background:'transparent', border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, color:'#64748b', fontSize:12, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>로그아웃</button>
      </div>
    </div>
  )
}
