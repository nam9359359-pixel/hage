import { useState, useEffect } from 'react'
import { db } from '../firebase.js'
import { doc, onSnapshot, setDoc, collection } from 'firebase/firestore'
import { ACCOUNTS, BIG_CATS, DEFAULT_PERMS } from '../constants.js'
import { logActivity, timeAgo } from '../utils.js'
import Header from '../components/Header.jsx'
import { Toast, PageHeader, Toggle } from '../components/UI.jsx'

export default function PermissionPage({ user, navigate, onLogout, currentPage }) {
  const [perms, setPerms] = useState({})
  const [presence, setPresence] = useState({})
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),2500) }

  const members = ACCOUNTS.filter(a => a.role === 'member')

  useEffect(() => {
    const unsubs = members.map(m => {
      return onSnapshot(doc(db, 'permissions', m.id), snap => {
        setPerms(prev => ({ ...prev, [m.id]: snap.exists() ? snap.data() : DEFAULT_PERMS[m.id] }))
      })
    })
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

  const saveAll = async () => {
    setSaving(true)
    for (const m of members) {
      if (perms[m.id]) {
        await setDoc(doc(db, 'permissions', m.id), perms[m.id])
      }
    }
    await logActivity({ userId:user.id, userName:user.name, action:'권한 설정 변경', itemId:'', itemDesc:'팀원 권한 업데이트' })
    setSaving(false)
    showToast('✅ 권한이 저장되었습니다')
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0d1526', fontFamily:"'Noto Sans KR',sans-serif" }}>
      <Header user={user} navigate={navigate} onLogout={onLogout} currentPage={currentPage} />
      <div style={{ maxWidth:900, margin:'0 auto', padding:'28px 20px' }}>
        <PageHeader title="🔑 권한 관리" onBack={()=>navigate('main')}>
          <button onClick={saveAll} disabled={saving} style={{ padding:'9px 20px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:9, color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>
            {saving ? '저장 중...' : '💾 저장하기'}
          </button>
        </PageHeader>

        {/* Online status */}
        <div style={{ background:'#111d35', border:'1px solid #1e2e50', borderRadius:14, padding:'18px 20px', marginBottom:24 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#93c5fd', marginBottom:14 }}>👥 팀원 접속 현황</div>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            {ACCOUNTS.map(acc => {
              const p = presence[acc.id]
              const online = p?.online === true
              return (
                <div key={acc.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', background:'#0a1120', border:`1px solid ${online?'rgba(34,197,94,0.3)':'#1e2e50'}`, borderRadius:10 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:online?'#22c55e':'#475569', display:'inline-block', boxShadow:online?'0 0 6px #22c55e':'none' }} />
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:'#e2e8f0' }}>{acc.name} {acc.role==='admin'?'👑':''}</div>
                    <div style={{ fontSize:11, color:'#475569' }}>{online?'온라인':p?.lastSeen?`마지막 접속: ${timeAgo(p.lastSeen)}`:'오프라인'}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Permission matrix */}
        <div style={{ background:'#111d35', border:'1px solid #1e2e50', borderRadius:14, overflow:'hidden' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid #1e2e50', fontSize:13, fontWeight:700, color:'#fcd34d' }}>📋 카테고리별 권한 설정</div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#0a1120' }}>
                  <th style={{ padding:'12px 20px', textAlign:'left', color:'#64748b', fontWeight:600, fontSize:12, whiteSpace:'nowrap' }}>팀원</th>
                  {BIG_CATS.map(bc => (
                    <th key={bc.id} colSpan={2} style={{ padding:'12px 16px', textAlign:'center', color:bc.color, fontWeight:700, fontSize:12, whiteSpace:'nowrap', borderLeft:'1px solid #1e2e50' }}>
                      {bc.icon} {bc.label}
                    </th>
                  ))}
                </tr>
                <tr style={{ background:'#0d1526' }}>
                  <th style={{ padding:'8px 20px' }} />
                  {BIG_CATS.map(bc => (
                    <>
                      <th key={`${bc.id}-view`} style={{ padding:'8px 12px', textAlign:'center', color:'#475569', fontWeight:600, fontSize:11, borderLeft:'1px solid #1e2e50' }}>열람</th>
                      <th key={`${bc.id}-edit`} style={{ padding:'8px 12px', textAlign:'center', color:'#475569', fontWeight:600, fontSize:11 }}>수정</th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id} style={{ borderTop:'1px solid #192640' }}>
                    <td style={{ padding:'14px 20px', fontWeight:600, color:'#e2e8f0', fontSize:13, whiteSpace:'nowrap' }}>{m.name}</td>
                    {BIG_CATS.map(bc => (
                      <>
                        <td key={`${bc.id}-view`} style={{ padding:'14px 12px', textAlign:'center', borderLeft:'1px solid #1e2e50' }}>
                          <Toggle value={perms[m.id]?.[bc.id]?.view || false} onChange={v => toggle(m.id, bc.id, 'view')} />
                        </td>
                        <td key={`${bc.id}-edit`} style={{ padding:'14px 12px', textAlign:'center' }}>
                          <Toggle value={perms[m.id]?.[bc.id]?.edit || false} onChange={v => toggle(m.id, bc.id, 'edit')} />
                        </td>
                      </>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding:'12px 20px', borderTop:'1px solid #1e2e50', fontSize:12, color:'#475569' }}>
            💡 열람 권한이 없으면 해당 탭 자체가 보이지 않습니다. 수정 권한이 없으면 요청 등록 및 수정이 불가합니다.
          </div>
        </div>
      </div>
      <Toast message={toast} onClose={()=>setToast('')} />
    </div>
  )
}
