import { useState, useEffect } from 'react'
import { db } from '../firebase.js'
import { collection, onSnapshot } from 'firebase/firestore'
import { ACCOUNTS, BIG_CATS, STATUS_STYLE } from '../constants.js'
import Header from '../components/Header.jsx'
import { PageHeader, SectionCard } from '../components/UI.jsx'

export default function DashboardPage({ user, navigate, onLogout, currentPage }) {
  const [items, setItems] = useState([])
  const [presence, setPresence] = useState({})

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'bugtracker'), snap => {
      setItems(snap.docs.map(d => ({ ...d.data(), id:d.id })))
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'presence'), snap => {
      const p = {}
      snap.docs.forEach(d => { p[d.id] = d.data() })
      setPresence(p)
    })
    return () => unsub()
  }, [])

  const total = items.length
  const done = items.filter(i => i.status==='완료').length
  const progress = items.filter(i => i.status==='진행').length
  const waiting = items.filter(i => i.status==='대기').length
  const urgent = items.filter(i => i.urgent && i.status!=='완료').length
  const pct = total ? Math.round((done/total)*100) : 0

  // Per big category stats
  const catStats = BIG_CATS.map(bc => {
    const its = items.filter(i => i.bigCat === bc.id)
    const d = its.filter(i => i.status==='완료').length
    const p = its.filter(i => i.status==='진행').length
    const w = its.filter(i => i.status==='대기').length
    const pct = its.length ? Math.round((d/its.length)*100) : 0
    return { ...bc, total:its.length, done:d, progress:p, waiting:w, pct }
  })

  // Per member stats
  const memberStats = ACCOUNTS.map(acc => {
    const mine = items.filter(i => i.assignee === acc.id)
    const d = mine.filter(i => i.status==='완료').length
    const p = mine.filter(i => i.status==='진행').length
    const w = mine.filter(i => i.status==='대기').length
    const online = presence[acc.id]?.online === true
    return { ...acc, total:mine.length, done:d, progress:p, waiting:w, online }
  })

  // Recent items
  const recentUrgent = items.filter(i => i.urgent && i.status!=='완료').slice(0,5)

  const StatBox = ({ label, value, color, bg, border }) => (
    <div style={{ background:bg, border:`1px solid ${border}`, borderRadius:12, padding:'14px 20px', display:'flex', flexDirection:'column', gap:4, flex:1, minWidth:100 }}>
      <span style={{ fontSize:11, fontWeight:700, color, opacity:0.8, textTransform:'uppercase', letterSpacing:'0.5px' }}>{label}</span>
      <span style={{ fontSize:28, fontWeight:800, color }}>{value}</span>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#0d1526', fontFamily:"'Noto Sans KR',sans-serif" }}>
      <Header user={user} navigate={navigate} onLogout={onLogout} currentPage={currentPage} />
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'28px 20px' }}>
        <PageHeader title="📊 전체 현황 대시보드" onBack={()=>navigate('main')} />

        {/* Top stats */}
        <div style={{ display:'flex', gap:10, marginBottom:24, flexWrap:'wrap' }}>
          <StatBox label="전체" value={total} color="#94a3b8" bg="#111d35" border="#1e2e50" />
          <StatBox label="대기" value={waiting} color="#60a5fa" bg="#0d1f3c" border="rgba(59,130,246,0.25)" />
          <StatBox label="진행" value={progress} color="#4ade80" bg="#052918" border="rgba(34,197,94,0.25)" />
          <StatBox label="완료" value={done} color="#a5b4fc" bg="#1a1740" border="rgba(129,140,248,0.25)" />
          <StatBox label="🚨 긴급" value={urgent} color="#f87171" bg="rgba(239,68,68,0.08)" border="rgba(239,68,68,0.2)" />
          <div style={{ background:'#111d35', border:'1px solid #1e2e50', borderRadius:12, padding:'14px 20px', flex:2, minWidth:200, display:'flex', flexDirection:'column', justifyContent:'center', gap:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:12, color:'#64748b', fontWeight:600 }}>전체 완료율</span>
              <span style={{ fontSize:14, color:'#a5b4fc', fontWeight:700 }}>{pct}%</span>
            </div>
            <div style={{ background:'#1e2e50', borderRadius:99, height:8 }}>
              <div style={{ background:'linear-gradient(90deg,#6366f1,#818cf8)', borderRadius:99, height:8, width:`${pct}%`, transition:'width 0.6s' }} />
            </div>
            <span style={{ fontSize:11, color:'#475569' }}>{done}/{total}건 완료</span>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:24 }}>
          {/* Category breakdown */}
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#cbd5e1', marginBottom:12 }}>📂 카테고리별 현황</div>
            <SectionCard>
              {catStats.map((bc, idx) => (
                <div key={bc.id} style={{ padding:'14px 18px', borderBottom:idx<catStats.length-1?'1px solid #192640':'none' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <span style={{ fontSize:14 }}>{bc.icon}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:bc.color }}>{bc.label}</span>
                    <span style={{ marginLeft:'auto', fontSize:12, color:'#64748b' }}>{bc.total}건</span>
                    <span style={{ fontSize:12, color:'#a5b4fc', fontWeight:600 }}>{bc.pct}%</span>
                  </div>
                  <div style={{ background:'#1e2e50', borderRadius:99, height:5, marginBottom:6 }}>
                    <div style={{ background:bc.color, borderRadius:99, height:5, width:`${bc.pct}%`, transition:'width 0.5s' }} />
                  </div>
                  <div style={{ display:'flex', gap:12, fontSize:11 }}>
                    <span style={{ color:'#60a5fa' }}>대기 {bc.waiting}</span>
                    <span style={{ color:'#4ade80' }}>진행 {bc.progress}</span>
                    <span style={{ color:'#a5b4fc' }}>완료 {bc.done}</span>
                  </div>
                </div>
              ))}
            </SectionCard>
          </div>

          {/* Member breakdown */}
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#cbd5e1', marginBottom:12 }}>👥 팀원별 담당 현황</div>
            <SectionCard>
              {memberStats.map((m, idx) => (
                <div key={m.id} style={{ padding:'14px 18px', borderBottom:idx<memberStats.length-1?'1px solid #192640':'none' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <span style={{ width:7, height:7, borderRadius:'50%', background:m.online?'#22c55e':'#475569', display:'inline-block', boxShadow:m.online?'0 0 5px #22c55e':'none', flexShrink:0 }} />
                    <span style={{ fontSize:13, fontWeight:700, color:'#e2e8f0' }}>{m.name}</span>
                    {m.role==='admin' && <span style={{ fontSize:10, color:'#fcd34d', background:'rgba(252,211,77,0.1)', border:'1px solid rgba(252,211,77,0.2)', borderRadius:4, padding:'1px 6px' }}>대표</span>}
                    <span style={{ marginLeft:'auto', fontSize:12, color:'#64748b' }}>{m.total}건</span>
                  </div>
                  {m.total > 0 ? (
                    <>
                      <div style={{ background:'#1e2e50', borderRadius:99, height:5, marginBottom:6 }}>
                        <div style={{ background:'linear-gradient(90deg,#6366f1,#818cf8)', borderRadius:99, height:5, width:`${m.total?Math.round((m.done/m.total)*100):0}%`, transition:'width 0.5s' }} />
                      </div>
                      <div style={{ display:'flex', gap:12, fontSize:11 }}>
                        <span style={{ color:'#60a5fa' }}>대기 {m.waiting}</span>
                        <span style={{ color:'#4ade80' }}>진행 {m.progress}</span>
                        <span style={{ color:'#a5b4fc' }}>완료 {m.done}</span>
                      </div>
                    </>
                  ) : <div style={{ fontSize:12, color:'#3d4f6b' }}>담당 항목 없음</div>}
                </div>
              ))}
            </SectionCard>
          </div>
        </div>

        {/* Urgent items */}
        {recentUrgent.length > 0 && (
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#fca5a5', marginBottom:12 }}>🚨 미완료 긴급 항목</div>
            <SectionCard style={{ border:'1px solid rgba(239,68,68,0.2)' }}>
              {recentUrgent.map((item, idx) => {
                const sc = STATUS_STYLE[item.status] || STATUS_STYLE['대기']
                const assignee = ACCOUNTS.find(a=>a.id===item.assignee)?.name||''
                const cat = BIG_CATS.find(b=>b.id===item.bigCat)
                return (
                  <div key={item.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 18px', borderBottom:idx<recentUrgent.length-1?'1px solid #192640':'none', cursor:'pointer' }} onClick={()=>navigate('item',{id:item.id})}
                    onMouseEnter={e=>e.currentTarget.style.background='#162035'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <span style={{ fontSize:11, padding:'2px 7px', background:cat?`${cat.color}20`:'transparent', color:cat?.color||'#94a3b8', border:`1px solid ${cat?.color||'#334155'}33`, borderRadius:4, fontWeight:600, flexShrink:0 }}>{cat?.icon} {cat?.label}</span>
                    <span style={{ flex:1, fontSize:13, color:'#e2e8f0', fontWeight:500 }}>{item.desc}</span>
                    {assignee && <span style={{ fontSize:11, color:'#a78bfa' }}>{assignee}</span>}
                    <span style={{ fontSize:11, padding:'2px 8px', background:sc.bg, border:`1px solid ${sc.border}`, borderRadius:50, color:sc.color, fontWeight:700 }}>{item.status}</span>
                  </div>
                )
              })}
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  )
}
