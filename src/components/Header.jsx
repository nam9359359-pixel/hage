import { useState, useEffect } from 'react'
import { db } from '../firebase.js'
import { collection, onSnapshot } from 'firebase/firestore'
import { ACCOUNTS } from '../constants.js'
import { timeAgo } from '../utils.js'

export default function Header({ user, navigate, onLogout, currentPage }) {
  const [presence, setPresence] = useState({})
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'presence'), snap => {
      const p = {}
      snap.docs.forEach(d => { p[d.id] = d.data() })
      setPresence(p)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'announcements'), snap => {
      const lastRead = parseInt(localStorage.getItem('lastReadAnnouncement') || '0')
      let count = 0
      snap.docs.forEach(d => {
        const ts = d.data().createdAt?.toMillis?.() || 0
        if (ts > lastRead) count++
      })
      setUnreadAnnouncements(count)
    })
    return () => unsub()
  }, [])

  const navBtn = (icon, label, page, adminOnly = false, badge = 0) => {
    if (adminOnly && user.role !== 'admin') return null
    const active = currentPage === page
    return (
      <button onClick={() => navigate(page)} title={label} style={{ position:'relative', padding:'6px 10px', background:active?'rgba(59,130,246,0.15)':'transparent', border:active?'1px solid rgba(59,130,246,0.3)':'1px solid transparent', borderRadius:8, color:active?'#93c5fd':'#94a3b8', fontSize:16, cursor:'pointer', transition:'all 0.15s' }}
        onMouseEnter={e=>{if(!active){e.currentTarget.style.color='#e2e8f0';e.currentTarget.style.background='rgba(255,255,255,0.05)'}}}
        onMouseLeave={e=>{if(!active){e.currentTarget.style.color='#94a3b8';e.currentTarget.style.background='transparent'}}}>
        {icon}
        {badge > 0 && <span style={{ position:'absolute', top:-4, right:-4, background:'#ef4444', color:'#fff', fontSize:9, fontWeight:700, borderRadius:'50%', width:16, height:16, display:'flex', alignItems:'center', justifyContent:'center' }}>{badge}</span>}
      </button>
    )
  }

  return (
    <div style={{ background:'#111d35', borderBottom:'1px solid #1e2e50', position:'sticky', top:0, zIndex:100, backdropFilter:'blur(10px)' }}>
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'0 20px', display:'flex', alignItems:'center', gap:10, height:56 }}>
        <button onClick={() => navigate('main')} style={{ display:'flex', flexDirection:'column', gap:1, background:'none', border:'none', cursor:'pointer' }}>
          <span style={{ fontSize:14, fontWeight:700, color:'#f1f5f9', letterSpacing:'-0.3px' }}>✈️ 여행하게</span>
          <span style={{ fontSize:10, color:'#475569' }}>출발은 혼자, 기억은 같이</span>
        </button>

        <div style={{ flex:1 }} />

        {/* 온라인 팀원 현황 */}
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          {ACCOUNTS.map(acc => {
            const p = presence[acc.id]
            const online = p?.online === true
            const isMe = acc.id === user.id
            return (
              <div key={acc.id} title={`${acc.name} · ${online?'온라인':timeAgo(p?.lastSeen)}`} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px', background:'rgba(255,255,255,0.04)', border:`1px solid ${isMe?'rgba(59,130,246,0.3)':'rgba(255,255,255,0.06)'}`, borderRadius:20, fontSize:11, color:isMe?'#93c5fd':'#94a3b8' }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:online?'#22c55e':'#475569', display:'inline-block', flexShrink:0 }} />
                {acc.name}
              </div>
            )
          })}
        </div>

        <div style={{ width:1, height:24, background:'#1e2e50', margin:'0 4px' }} />

        {/* 네비게이션 아이콘 */}
        {navBtn('💰', '가계부', 'accounting', true)}
        {navBtn('📣', '공지사항', 'announcements', false, unreadAnnouncements)}
        {navBtn('📊', '대시보드', 'dashboard')}
        {navBtn('📝', '내 메모', 'memo')}
        {navBtn('📅', '캘린더', 'calendar')}
        {navBtn('📋', '활동 로그', 'activity', true)}
        {navBtn('🔑', '권한 관리', 'permissions', true)}

        <div style={{ width:1, height:24, background:'#1e2e50', margin:'0 4px' }} />

        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, fontSize:12, color:'#cbd5e1', fontWeight:600 }}>
          {user.role === 'admin' ? '👑' : '👤'} {user.name}
        </div>
        <button onClick={onLogout} style={{ padding:'6px 11px', background:'transparent', border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, color:'#64748b', fontSize:12, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>로그아웃</button>
      </div>
    </div>
  )
}
