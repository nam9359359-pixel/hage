import { useState, useEffect } from 'react'
import { db } from '../firebase.js'
import { doc, onSnapshot, setDoc, collection } from 'firebase/firestore'
import { ACCOUNTS, BIG_CATS, DEFAULT_PERMS } from '../constants.js'
import { logActivity, timeAgo } from '../utils.js'
import Header from '../components/Header.jsx'
import { Toast, PageHeader, Toggle } from '../components/UI.jsx'

const FIXED_PAGES = [
  { id:'accounting', label:'💰 가계부',       rules:{ boss:'열람+수정', jinsu:'접근 불가', pilseon:'접근 불가' } },
  { id:'activity',   label:'📋 활동 로그',     rules:{ boss:'열람 가능', jinsu:'접근 불가', pilseon:'접근 불가' } },
  { id:'permissions',label:'🔑 권한 관리',     rules:{ boss:'열람+수정', jinsu:'접근 불가', pilseon:'접근 불가' } },
  { id:'announcements',label:'📣 공지사항',    rules:{ boss:'열람+작성', jinsu:'열람만 가능', pilseon:'열람만 가능' } },
  { id:'info',       label:'🏢 앱/사업자 정보', rules:{ boss:'열람+수정', jinsu:'열람 가능*', pilseon:'열람 가능*' }, editable:true },
  { id:'calendar',   label:'📅 공유 캘린더',   rules:{ boss:'열람+수정', jinsu:'열람+본인일정', pilseon:'열람+본인일정' } },
  { id:'memo',       label:'📝 메모',          rules:{ boss:'본인만', jinsu:'본인만', pilseon:'본인만' } },
  { id:'dashboard',  label:'📊 대시보드',      rules:{ boss:'열람 가능', jinsu:'열람 가능', pilseon:'열람 가능' } },
  { id:'notifications',label:'🔔 알림센터',   rules:{ boss:'본인 알림', jinsu:'본인 알림', pilseon:'본인 알림' } },
]

const RULE_COLOR = (rule) => {
  if (rule==='접근 불가') return { color:'#f87171', bg:'rgba(239,68,68,0.08)' }
  if (rule==='열람+수정'||rule==='열람+작성'||rule==='열람+본인일정') return { color:'#4ade80', bg:'rgba(34,197,94,0.08)' }
  if (rule==='열람 가능'||rule==='열람 가능*'||rule==='열람만 가능') return { color:'#93c5fd', bg:'rgba(59,130,246,0.08)' }
  return { color:'#94a3b8', bg:'rgba(255,255,255,0.04)' }
}

export default function PermissionPage({ user, navigate, onLogout, currentPage }) {
  const [perms, setPerms] = useState({})
  const [presence, setPresence] = useState({})
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),2500) }
  const members = ACCOUNTS.filter(a => a.role === 'member')

  useEffect(() => {
    const unsubs = members.map(m =>
      onSnapshot(doc(db, 'permissions', m.id), snap => {
        setPerms(prev => ({ ...prev, [m.id]: snap.exists() ? snap.data() : DEFAULT_PERMS[m.id] }))
      })
    )
    return () => unsubs.forEach(u => u())
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'presence'), snap => {
      const p = {}
      snap.docs.forEach(d => { p[d.id] = d.data() })
      setPresence(p)
    })
    return () => unsub()
  }, [])

  const toggle = (userId, catId, type) => {
    setPerms(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [catId]: { ...(prev[userId]?.[catId]||{}), [type]: !(prev[userId]?.[catId]?.[type]) }
      }
    }))
  }

  const toggleInfoView = (userId) => {
    setPerms(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        info: { view: !(prev[userId]?.info?.view ?? true) }
      }
    }))
  }

  const saveAll = async () => {
    setSaving(true)
    for (const m of members) {
      if (perms[m.id]) await setDoc(doc(db, 'permissions', m.id), perms[m.id])
    }
    await logActivity({ userId:user.id, userName:user.name, action:'권한 설정 변경', itemId:'', itemDesc:'팀원 권한 업데이트' })
    setSaving(false)
    showToast('✅ 권한이 저장되었습니다')
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0d1526', fontFamily:"'Noto Sans KR',sans-serif" }}>
      <Header user={user} navigate={navigate} onLogout={onLogout} currentPage={currentPage}/>
      <div style={{ maxWidth:960, margin:'0 auto', padding:'28px 20px' }}>
        <PageHeader title="🔑 권한 관리" onBack={()=>navigate('main')}>
          <button onClick={saveAll} disabled={saving} style={{ padding:'9px 20px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:9, color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>
            {saving?'저장 중...':'💾 저장하기'}
          </button>
        </PageHeader>

        {/* 온라인 현황 */}
        <div style={{ background:'#111d35', border:'1px solid #1e2e50', borderRadius:14, padding:'16px 20px', marginBottom:24 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#93c5fd', marginBottom:14 }}>👥 팀원 접속 현황</div>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            {ACCOUNTS.map(acc => {
              const p = presence[acc.id]
              const online = p?.online===true
              return (
                <div key={acc.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', background:'#0a1120', border:`1px solid ${online?'rgba(34,197,94,0.3)':'#1e2e50'}`, borderRadius:10 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:online?'#22c55e':'#475569', display:'inline-block', boxShadow:online?'0 0 6px #22c55e':'none' }}/>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:'#e2e8f0' }}>{acc.name} {acc.role==='admin'?'👑':''}</div>
                    <div style={{ fontSize:11, color:'#475569' }}>{online?'🟢 온라인':p?.lastSeen?`마지막: ${timeAgo(p.lastSeen)}`:'⚫ 오프라인'}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── 업무 카테고리 권한 (수정 가능) ── */}
        <div style={{ background:'#111d35', border:'1px solid #1e2e50', borderRadius:14, overflow:'hidden', marginBottom:20 }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid #1e2e50', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#fcd34d' }}>📋 업무 카테고리 접근 권한</div>
              <div style={{ fontSize:11, color:'#475569', marginTop:3 }}>열람 OFF → 해당 탭 자체가 보이지 않음 / 수정 OFF → 업무 요청 및 수정 불가</div>
            </div>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#0a1120' }}>
                  <th style={{ padding:'10px 20px', textAlign:'left', color:'#64748b', fontWeight:600, fontSize:12, whiteSpace:'nowrap' }}>팀원</th>
                  {BIG_CATS.map(bc=>(
                    <th key={bc.id} colSpan={2} style={{ padding:'10px 16px', textAlign:'center', color:bc.color, fontWeight:700, fontSize:12, whiteSpace:'nowrap', borderLeft:'1px solid #1e2e50' }}>
                      {bc.icon} {bc.label}
                    </th>
                  ))}
                </tr>
                <tr style={{ background:'#0d1526' }}>
                  <th style={{ padding:'6px 20px' }}/>
                  {BIG_CATS.map(bc=>(
                    <> 
                      <th key={`${bc.id}-v`} style={{ padding:'6px 12px', textAlign:'center', color:'#475569', fontWeight:600, fontSize:11, borderLeft:'1px solid #1e2e50' }}>열람</th>
                      <th key={`${bc.id}-e`} style={{ padding:'6px 12px', textAlign:'center', color:'#475569', fontWeight:600, fontSize:11 }}>수정</th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map(m=>(
                  <tr key={m.id} style={{ borderTop:'1px solid #192640' }}>
                    <td style={{ padding:'12px 20px', fontWeight:600, color:'#e2e8f0', fontSize:13 }}>{m.name}</td>
                    {BIG_CATS.map(bc=>(
                      <>
                        <td key={`${bc.id}-v`} style={{ padding:'12px', textAlign:'center', borderLeft:'1px solid #1e2e50' }}>
                          <Toggle value={perms[m.id]?.[bc.id]?.view||false} onChange={()=>toggle(m.id,bc.id,'view')}/>
                        </td>
                        <td key={`${bc.id}-e`} style={{ padding:'12px', textAlign:'center' }}>
                          <Toggle value={perms[m.id]?.[bc.id]?.edit||false} onChange={()=>toggle(m.id,bc.id,'edit')}/>
                        </td>
                      </>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── 앱/사업자 정보 열람 권한 (수정 가능) ── */}
        <div style={{ background:'#111d35', border:'1px solid #1e2e50', borderRadius:14, overflow:'hidden', marginBottom:20 }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid #1e2e50' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#fcd34d' }}>🏢 앱 / 사업자 정보 열람 권한</div>
            <div style={{ fontSize:11, color:'#475569', marginTop:3 }}>열람 OFF → 공지사항 페이지에서 해당 탭이 보이지 않음 / 수정은 항상 찬(대표)만 가능</div>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <tbody>
              {members.map(m=>(
                <tr key={m.id} style={{ borderBottom:'1px solid #192640' }}>
                  <td style={{ padding:'12px 20px', fontWeight:600, color:'#e2e8f0', fontSize:13, width:160 }}>{m.name}</td>
                  <td style={{ padding:'12px 20px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <Toggle value={perms[m.id]?.info?.view!==false} onChange={()=>toggleInfoView(m.id)}/>
                      <span style={{ fontSize:12, color:'#64748b' }}>{perms[m.id]?.info?.view!==false ? '열람 가능' : '열람 불가'}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── 전체 페이지 권한 현황 (고정 안내) ── */}
        <div style={{ background:'#111d35', border:'1px solid #1e2e50', borderRadius:14, overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid #1e2e50' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#94a3b8' }}>📌 전체 페이지 권한 현황</div>
            <div style={{ fontSize:11, color:'#475569', marginTop:3 }}>* 표시 항목은 위에서 변경 가능 / 나머지는 고정 규칙</div>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'#0a1120' }}>
                  <th style={{ padding:'10px 20px', textAlign:'left', color:'#64748b', fontWeight:600, whiteSpace:'nowrap' }}>페이지</th>
                  {ACCOUNTS.map(acc=>(
                    <th key={acc.id} style={{ padding:'10px 16px', textAlign:'center', color:acc.role==='admin'?'#fcd34d':'#64748b', fontWeight:600, borderLeft:'1px solid #1e2e50', whiteSpace:'nowrap' }}>
                      {acc.role==='admin'?'👑':''} {acc.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FIXED_PAGES.map((page, idx)=>(
                  <tr key={page.id} style={{ borderTop:'1px solid #192640' }}>
                    <td style={{ padding:'10px 20px', color:'#cbd5e1', fontSize:12, fontWeight:500 }}>
                      {page.label}
                      {page.editable && <span style={{ marginLeft:6, fontSize:10, color:'#fcd34d' }}>*</span>}
                    </td>
                    {ACCOUNTS.map(acc=>{
                      const rule = page.rules[acc.id]
                      // 앱/사업자 정보는 멤버의 실제 권한 반영
                      let displayRule = rule
                      if (page.id==='info' && acc.role!=='admin') {
                        const canView = perms[acc.id]?.info?.view !== false
                        displayRule = canView ? '열람 가능' : '접근 불가'
                      }
                      const rc = RULE_COLOR(displayRule)
                      return (
                        <td key={acc.id} style={{ padding:'8px 16px', textAlign:'center', borderLeft:'1px solid #1e2e50' }}>
                          <span style={{ fontSize:11, padding:'2px 8px', borderRadius:99, background:rc.bg, color:rc.color, whiteSpace:'nowrap' }}>{displayRule}</span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding:'12px 20px', borderTop:'1px solid #1e2e50', fontSize:11, color:'#3d4f6b', lineHeight:1.7 }}>
            💡 업무 카테고리 권한은 상단 표에서 변경 / 가계부·활동로그·권한관리는 대표(찬) 전용으로 고정
          </div>
        </div>
      </div>
      <Toast message={toast} onClose={()=>setToast('')}/>
    </div>
  )
}
