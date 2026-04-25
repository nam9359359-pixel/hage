import { useState, useEffect } from 'react'
import { db } from '../firebase.js'
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore'
import { ACCOUNTS } from '../constants.js'
import { formatDate } from '../utils.js'
import Header from '../components/Header.jsx'
import { PageHeader, SectionCard, Empty } from '../components/UI.jsx'

const ACTION_ICON = {
  '항목 추가': '➕', '항목 추가(요청)': '📝', '항목 수정': '✏️', '항목 삭제': '🗑️',
  '상태 변경': '🔄', '댓글 작성': '💬', '권한 설정 변경': '🔑',
}
function getIcon(action) {
  return Object.entries(ACTION_ICON).find(([k]) => action.startsWith(k))?.[1] || '📋'
}

export default function ActivityLogPage({ user, navigate, onLogout, currentPage }) {
  const [logs, setLogs] = useState([])
  const [filterUser, setFilterUser] = useState('전체')
  const [filterAction, setFilterAction] = useState('전체')

  useEffect(() => {
    const q = query(collection(db, 'activityLog'), orderBy('timestamp', 'desc'), limit(200))
    const unsub = onSnapshot(q, snap => {
      setLogs(snap.docs.map(d => ({ ...d.data(), id:d.id })))
    })
    return () => unsub()
  }, [])

  const filtered = logs.filter(l => {
    if (filterUser !== '전체' && l.userId !== filterUser) return false
    if (filterAction !== '전체' && !l.action.startsWith(filterAction)) return false
    return true
  })

  const actionTypes = ['전체', '항목 추가', '항목 수정', '항목 삭제', '상태 변경', '댓글 작성', '권한 설정 변경']

  return (
    <div style={{ minHeight:'100vh', background:'#0d1526', fontFamily:"'Noto Sans KR',sans-serif" }}>
      <Header user={user} navigate={navigate} onLogout={onLogout} currentPage={currentPage} />
      <div style={{ maxWidth:900, margin:'0 auto', padding:'28px 20px' }}>
        <PageHeader title="📋 활동 로그" onBack={()=>navigate('main')}>
          <span style={{ fontSize:12, color:'#475569' }}>최근 200건 표시 · 대표 전용</span>
        </PageHeader>

        {/* Filters */}
        <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
          <select value={filterUser} onChange={e=>setFilterUser(e.target.value)} style={{ padding:'8px 12px', background:'#111d35', border:'1px solid #1e2e50', borderRadius:8, color:'#e2e8f0', fontSize:13, outline:'none', fontFamily:"'Noto Sans KR',sans-serif" }}>
            <option value="전체">전체 팀원</option>
            {ACCOUNTS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={filterAction} onChange={e=>setFilterAction(e.target.value)} style={{ padding:'8px 12px', background:'#111d35', border:'1px solid #1e2e50', borderRadius:8, color:'#e2e8f0', fontSize:13, outline:'none', fontFamily:"'Noto Sans KR',sans-serif" }}>
            {actionTypes.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <span style={{ display:'flex', alignItems:'center', fontSize:12, color:'#475569' }}>총 {filtered.length}건</span>
        </div>

        {filtered.length === 0 ? <Empty icon="📋" message="활동 로그가 없습니다" /> : (
          <SectionCard>
            {filtered.map((log, idx) => {
              const acc = ACCOUNTS.find(a => a.id === log.userId)
              const icon = getIcon(log.action)
              const isLast = idx === filtered.length - 1
              return (
                <div key={log.id} style={{ display:'flex', gap:14, padding:'14px 18px', borderBottom:isLast?'none':'1px solid #192640', alignItems:'flex-start' }}>
                  <div style={{ width:32, height:32, borderRadius:'50%', background:'rgba(255,255,255,0.05)', border:'1px solid #1e2e50', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0, marginTop:2 }}>{icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:4 }}>
                      <span style={{ fontSize:13, fontWeight:700, color:'#e2e8f0' }}>{acc?.name || log.userName}</span>
                      <span style={{ fontSize:12, color:'#64748b' }}>·</span>
                      <span style={{ fontSize:12, color:'#93c5fd', fontWeight:500 }}>{log.action}</span>
                    </div>
                    {log.itemDesc && <div style={{ fontSize:13, color:'#94a3b8', lineHeight:1.5 }}>{log.itemDesc.slice(0,80)}{log.itemDesc.length>80?'...':''}</div>}
                    {log.extra && <div style={{ fontSize:12, color:'#475569', marginTop:2 }}>{log.extra}</div>}
                  </div>
                  <span style={{ fontSize:11, color:'#3d4f6b', whiteSpace:'nowrap', flexShrink:0 }}>{log.timestamp ? formatDate(log.timestamp) : ''}</span>
                </div>
              )
            })}
          </SectionCard>
        )}
      </div>
    </div>
  )
}
