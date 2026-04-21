import { useState, useEffect } from 'react'
import { db } from '../firebase.js'
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { getDaysInMonth, getFirstDayOfMonth, logActivity } from '../utils.js'
import Header from '../components/Header.jsx'
import { Toast, PageHeader, Modal } from '../components/UI.jsx'

const WEEKDAYS = ['일','월','화','수','목','금','토']
const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

export default function CalendarPage({ user, navigate, onLogout, currentPage }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [schedules, setSchedules] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ title:'', desc:'' })
  const [toast, setToast] = useState('')
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),2500) }

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'schedule'), snap => {
      setSchedules(snap.docs.map(d => ({ ...d.data(), id:d.id })))
    })
    return () => unsub()
  }, [])

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const getDateStr = day => `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  const getDaySchedules = day => schedules.filter(s => s.date === getDateStr(day))

  const prevMonth = () => { if (month===0){setMonth(11);setYear(y=>y-1)}else setMonth(m=>m-1) }
  const nextMonth = () => { if (month===11){setMonth(0);setYear(y=>y+1)}else setMonth(m=>m+1) }

  const openAdd = (day) => { setSelectedDate(day); setForm({ title:'', desc:'' }); setModal(true) }

  const handleAdd = async () => {
    if (!form.title.trim()) return
    const dateStr = getDateStr(selectedDate)
    await addDoc(collection(db, 'schedule'), { title:form.title, desc:form.desc, date:dateStr, createdBy:user.id, createdAt:serverTimestamp() })
    await logActivity({ userId:user.id, userName:user.name, action:'일정 추가', itemDesc:form.title, extra:dateStr })
    setModal(false)
    showToast('📅 일정이 추가되었습니다')
  }

  const handleDelete = async (id, title) => {
    await deleteDoc(doc(db, 'schedule', id))
    await logActivity({ userId:user.id, userName:user.name, action:'일정 삭제', itemDesc:title })
    showToast('🗑️ 일정이 삭제되었습니다')
  }

  const isToday = day => day && year===today.getFullYear() && month===today.getMonth() && day===today.getDate()

  const iS = { width:'100%', padding:'10px 13px', background:'#0a1120', border:'1px solid #1e2e50', borderRadius:8, color:'#e2e8f0', fontSize:14, outline:'none', fontFamily:"'Noto Sans KR',sans-serif" }

  return (
    <div style={{ minHeight:'100vh', background:'#0d1526', fontFamily:"'Noto Sans KR',sans-serif" }}>
      <Header user={user} navigate={navigate} onLogout={onLogout} currentPage={currentPage} />
      <div style={{ maxWidth:960, margin:'0 auto', padding:'28px 20px' }}>
        <PageHeader title="📅 캘린더 / 일정 관리" onBack={()=>navigate('main')}>
          <span style={{ fontSize:12, color:'#475569' }}>대표 전용</span>
        </PageHeader>

        {/* Month nav */}
        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20, justifyContent:'center' }}>
          <button onClick={prevMonth} style={{ padding:'7px 14px', background:'#111d35', border:'1px solid #1e2e50', borderRadius:8, color:'#94a3b8', cursor:'pointer', fontSize:16 }}>‹</button>
          <h2 style={{ fontSize:20, fontWeight:700, color:'#f1f5f9', minWidth:120, textAlign:'center' }}>{year}년 {MONTHS[month]}</h2>
          <button onClick={nextMonth} style={{ padding:'7px 14px', background:'#111d35', border:'1px solid #1e2e50', borderRadius:8, color:'#94a3b8', cursor:'pointer', fontSize:16 }}>›</button>
        </div>

        {/* Calendar grid */}
        <div style={{ background:'#111d35', border:'1px solid #1e2e50', borderRadius:16, overflow:'hidden' }}>
          {/* Weekday headers */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid #1e2e50' }}>
            {WEEKDAYS.map((w,i) => (
              <div key={w} style={{ padding:'10px', textAlign:'center', fontSize:12, fontWeight:700, color:i===0?'#f87171':i===6?'#60a5fa':'#64748b', borderRight:i<6?'1px solid #1e2e50':'none' }}>{w}</div>
            ))}
          </div>
          {/* Days */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
            {cells.map((day, idx) => {
              const daySchedules = day ? getDaySchedules(day) : []
              const today_ = isToday(day)
              const colIdx = idx % 7
              return (
                <div key={idx} onClick={() => day && openAdd(day)} style={{ minHeight:90, padding:8, borderRight:colIdx<6?'1px solid #192640':'none', borderBottom:Math.floor(idx/7)<Math.floor((cells.length-1)/7)?'1px solid #192640':'none', background:today_?'rgba(59,130,246,0.08)':'transparent', cursor:day?'pointer':'default', transition:'background 0.12s' }}
                  onMouseEnter={e=>day&&(e.currentTarget.style.background=today_?'rgba(59,130,246,0.12)':'rgba(255,255,255,0.02)')}
                  onMouseLeave={e=>e.currentTarget.style.background=today_?'rgba(59,130,246,0.08)':'transparent'}>
                  {day && <div style={{ fontSize:13, fontWeight:today_?700:500, color:today_?'#60a5fa':colIdx===0?'#f87171':colIdx===6?'#60a5fa':'#94a3b8', marginBottom:4 }}>{day}</div>}
                  {daySchedules.slice(0,3).map(s => (
                    <div key={s.id} style={{ fontSize:11, padding:'2px 6px', background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.25)', borderRadius:4, color:'#93c5fd', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor:'pointer' }}
                      onClick={e => { e.stopPropagation(); if(window.confirm(`"${s.title}" 일정을 삭제할까요?`)) handleDelete(s.id, s.title) }}>
                      {s.title}
                    </div>
                  ))}
                  {daySchedules.length > 3 && <div style={{ fontSize:10, color:'#475569' }}>+{daySchedules.length-3}개</div>}
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ marginTop:12, fontSize:12, color:'#475569', textAlign:'center' }}>날짜 클릭 → 일정 추가 · 일정 클릭 → 삭제</div>

        {/* Upcoming schedules */}
        <div style={{ marginTop:28 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#cbd5e1', marginBottom:12 }}>📌 이번 달 일정 목록</div>
          {schedules.filter(s => s.date?.startsWith(`${year}-${String(month+1).padStart(2,'0')}`)).sort((a,b)=>a.date.localeCompare(b.date)).map(s => (
            <div key={s.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 16px', background:'#111d35', border:'1px solid #1e2e50', borderRadius:10, marginBottom:8 }}>
              <span style={{ fontSize:12, color:'#60a5fa', fontWeight:700, minWidth:48 }}>{s.date?.slice(8)+'일'}</span>
              <span style={{ fontSize:13, color:'#e2e8f0', flex:1 }}>{s.title}</span>
              {s.desc && <span style={{ fontSize:12, color:'#64748b' }}>{s.desc}</span>}
              <button onClick={()=>handleDelete(s.id,s.title)} style={{ padding:'3px 8px', background:'rgba(239,68,68,0.08)', border:'none', borderRadius:5, color:'#f87171', cursor:'pointer', fontSize:11 }}>삭제</button>
            </div>
          ))}
          {!schedules.some(s => s.date?.startsWith(`${year}-${String(month+1).padStart(2,'0')}`)) && (
            <div style={{ textAlign:'center', padding:'30px 0', color:'#475569', fontSize:13 }}>이번 달 일정이 없습니다</div>
          )}
        </div>
      </div>

      {modal && (
        <Modal onClose={()=>setModal(false)}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <h3 style={{ fontSize:16, fontWeight:700, color:'#f1f5f9' }}>📅 {year}.{String(month+1).padStart(2,'0')}.{String(selectedDate).padStart(2,'0')} 일정 추가</h3>
            <button onClick={()=>setModal(false)} style={{ background:'none', border:'none', color:'#64748b', fontSize:20, cursor:'pointer' }}>✕</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:6 }}>일정 제목 *</label>
              <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="예: 팀 미팅, 배포 예정일" style={iS} onKeyDown={e=>e.key==='Enter'&&handleAdd()} autoFocus /></div>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:6 }}>메모 (선택)</label>
              <input value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))} placeholder="추가 메모" style={iS} /></div>
            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <button onClick={()=>setModal(false)} style={{ flex:1, padding:11, border:'1px solid #334155', borderRadius:9, background:'transparent', color:'#94a3b8', fontWeight:600, fontSize:14, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>취소</button>
              <button onClick={handleAdd} style={{ flex:2, padding:11, border:'none', borderRadius:9, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>추가하기</button>
            </div>
          </div>
        </Modal>
      )}
      <Toast message={toast} onClose={()=>setToast('')} />
    </div>
  )
}
