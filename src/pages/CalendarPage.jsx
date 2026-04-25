import { useState, useEffect } from 'react'
import { db } from '../firebase.js'
import { collection, onSnapshot, addDoc, deleteDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { getDaysInMonth, getFirstDayOfMonth, logActivity } from '../utils.js'
import { ACCOUNTS } from '../constants.js'
import Header from '../components/Header.jsx'
import { Toast, PageHeader, Modal } from '../components/UI.jsx'

const WEEKDAYS = ['일','월','화','수','목','금','토']
const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
const MEMBER_COLORS = { boss:'#60a5fa', jinsu:'#4ade80', pilseon:'#f472b6' }

export default function CalendarPage({ user, navigate, onLogout, currentPage }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [schedules, setSchedules] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [modal, setModal] = useState(null) // null | 'add' | scheduleObj
  const [form, setForm] = useState({ title:'', desc:'' })
  const [toast, setToast] = useState('')
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),2500) }

  useEffect(() => {
    const unsub = onSnapshot(collection(db,'schedule'), snap => {
      setSchedules(snap.docs.map(d=>({...d.data(),id:d.id})))
    })
    return ()=>unsub()
  },[])

  const daysInMonth = getDaysInMonth(year,month)
  const firstDay = getFirstDayOfMonth(year,month)
  const cells = []
  for (let i=0;i<firstDay;i++) cells.push(null)
  for (let d=1;d<=daysInMonth;d++) cells.push(d)
  while (cells.length%7!==0) cells.push(null)

  const getDateStr = day => `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  const getDaySchedules = day => schedules.filter(s=>s.date===getDateStr(day))
  const isToday = day => day&&year===today.getFullYear()&&month===today.getMonth()&&day===today.getDate()
  const prevMonth = () => { if(month===0){setMonth(11);setYear(y=>y-1)}else setMonth(m=>m-1) }
  const nextMonth = () => { if(month===11){setMonth(0);setYear(y=>y+1)}else setMonth(m=>m+1) }
  const authorName = id => ACCOUNTS.find(a=>a.id===id)?.name||'알 수 없음'
  const authorColor = id => MEMBER_COLORS[id]||'#94a3b8'
  const isMySchedule = s => s.createdBy===user.id

  const openAdd = day => { setSelectedDate(day); setForm({title:'',desc:''}); setModal('add') }
  const openEdit = (e,s) => { e.stopPropagation(); setForm({title:s.title,desc:s.desc||''}); setModal(s) }

  const handleAdd = async () => {
    if (!form.title.trim()) return
    const dateStr = getDateStr(selectedDate)
    await addDoc(collection(db,'schedule'), { title:form.title, desc:form.desc, date:dateStr, createdBy:user.id, createdByName:user.name, createdAt:serverTimestamp() })
    await logActivity({ userId:user.id, userName:user.name, action:'일정 추가', itemDesc:form.title, extra:dateStr })
    setModal(null)
    showToast('📅 일정이 추가되었습니다')
  }

  const handleEdit = async () => {
    if (!form.title.trim()||typeof modal==='string') return
    await updateDoc(doc(db,'schedule',modal.id), { title:form.title, desc:form.desc })
    await logActivity({ userId:user.id, userName:user.name, action:'일정 수정', itemDesc:form.title })
    setModal(null)
    showToast('✅ 일정이 수정되었습니다')
  }

  const handleDelete = async (e,s) => {
    e.stopPropagation()
    if (!window.confirm(`"${s.title}" 일정을 삭제할까요?`)) return
    await deleteDoc(doc(db,'schedule',s.id))
    await logActivity({ userId:user.id, userName:user.name, action:'일정 삭제', itemDesc:s.title })
    showToast('🗑️ 일정이 삭제되었습니다')
  }

  const iS = { width:'100%', padding:'10px 13px', background:'#0a1120', border:'1px solid #1e2e50', borderRadius:8, color:'#e2e8f0', fontSize:14, outline:'none', fontFamily:"'Noto Sans KR',sans-serif" }
  const isEditMode = modal && typeof modal !== 'string'
  const selectedDateStr = selectedDate ? getDateStr(selectedDate) : ''
  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`
  const thisMonthSchedules = schedules.filter(s=>s.date?.startsWith(monthStr)).sort((a,b)=>a.date.localeCompare(b.date))

  return (
    <div style={{minHeight:'100vh',background:'#0d1526',fontFamily:"'Noto Sans KR',sans-serif"}}>
      <Header user={user} navigate={navigate} onLogout={onLogout} currentPage={currentPage}/>
      <div style={{maxWidth:1000,margin:'0 auto',padding:'28px 20px'}}>
        <PageHeader title="📅 공유 캘린더" onBack={()=>navigate('main')}>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {ACCOUNTS.map(acc=>(
              <div key={acc.id} style={{display:'flex',alignItems:'center',gap:4,fontSize:12,color:'#64748b'}}>
                <span style={{width:8,height:8,borderRadius:'50%',background:authorColor(acc.id),display:'inline-block'}}/>
                {acc.name}
              </div>
            ))}
          </div>
        </PageHeader>

        {/* Month nav */}
        <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:20,justifyContent:'center'}}>
          <button onClick={prevMonth} style={{padding:'7px 14px',background:'#111d35',border:'1px solid #1e2e50',borderRadius:8,color:'#94a3b8',cursor:'pointer',fontSize:16}}>‹</button>
          <h2 style={{fontSize:20,fontWeight:700,color:'#f1f5f9',minWidth:120,textAlign:'center'}}>{year}년 {MONTHS[month]}</h2>
          <button onClick={nextMonth} style={{padding:'7px 14px',background:'#111d35',border:'1px solid #1e2e50',borderRadius:8,color:'#94a3b8',cursor:'pointer',fontSize:16}}>›</button>
        </div>

        {/* Calendar grid */}
        <div style={{background:'#111d35',border:'1px solid #1e2e50',borderRadius:16,overflow:'hidden',marginBottom:24}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',borderBottom:'1px solid #1e2e50'}}>
            {WEEKDAYS.map((w,i)=>(
              <div key={w} style={{padding:'10px',textAlign:'center',fontSize:12,fontWeight:700,color:i===0?'#f87171':i===6?'#60a5fa':'#64748b',borderRight:i<6?'1px solid #1e2e50':'none'}}>{w}</div>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)'}}>
            {cells.map((day,idx)=>{
              const ds = day?getDaySchedules(day):[]
              const todayFlag = isToday(day)
              const col = idx%7
              const isLastRow = Math.floor(idx/7)===Math.floor((cells.length-1)/7)
              return (
                <div key={idx} onClick={()=>day&&openAdd(day)}
                  style={{minHeight:88,padding:6,borderRight:col<6?'1px solid #192640':'none',borderBottom:!isLastRow?'1px solid #192640':'none',background:todayFlag?'rgba(59,130,246,0.08)':'transparent',cursor:day?'pointer':'default',transition:'background 0.12s'}}
                  onMouseEnter={e=>{if(day)e.currentTarget.style.background=todayFlag?'rgba(59,130,246,0.12)':'rgba(255,255,255,0.02)'}}
                  onMouseLeave={e=>{e.currentTarget.style.background=todayFlag?'rgba(59,130,246,0.08)':'transparent'}}>
                  {day&&<div style={{fontSize:12,fontWeight:todayFlag?700:500,color:todayFlag?'#60a5fa':col===0?'#f87171':col===6?'#60a5fa':'#94a3b8',marginBottom:3,display:'flex',alignItems:'center',gap:4}}>
                    {day}
                    {todayFlag&&<span style={{fontSize:9,background:'#3b82f6',color:'#fff',borderRadius:3,padding:'0 4px',fontWeight:700}}>오늘</span>}
                  </div>}
                  <div style={{display:'flex',flexDirection:'column',gap:2}}>
                    {ds.slice(0,2).map(s=>{
                      const mine = isMySchedule(s)
                      return (
                        <div key={s.id} style={{fontSize:10,padding:'2px 5px',background:`${authorColor(s.createdBy)}20`,border:`1px solid ${authorColor(s.createdBy)}40`,borderRadius:4,color:authorColor(s.createdBy),overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:3}}
                          onClick={e=>{e.stopPropagation();mine&&openEdit(e,s)}}>
                          <span style={{width:5,height:5,borderRadius:'50%',background:authorColor(s.createdBy),flexShrink:0}}/>
                          {s.title}
                          {mine&&<span style={{marginLeft:'auto',flexShrink:0}}>✏️</span>}
                        </div>
                      )
                    })}
                    {ds.length>2&&<div style={{fontSize:9,color:'#475569'}}>+{ds.length-2}개</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Legend + tip */}
        <div style={{fontSize:11,color:'#475569',textAlign:'center',marginBottom:24}}>
          날짜 클릭 → 일정 추가 · 내 일정 클릭 → 수정 · 목록에서 삭제 가능
        </div>

        {/* This month list */}
        <div style={{fontSize:14,fontWeight:700,color:'#cbd5e1',marginBottom:12}}>📌 {MONTHS[month]} 일정 목록</div>
        {thisMonthSchedules.length===0
          ? <div style={{textAlign:'center',padding:'30px 0',color:'#475569',fontSize:13}}>이번 달 일정이 없습니다</div>
          : thisMonthSchedules.map(s=>{
              const mine = isMySchedule(s)
              return (
                <div key={s.id} style={{display:'flex',alignItems:'center',gap:12,padding:'11px 16px',background:'#111d35',border:'1px solid #1e2e50',borderRadius:10,marginBottom:8}}>
                  <span style={{width:8,height:8,borderRadius:'50%',background:authorColor(s.createdBy),flexShrink:0}}/>
                  <span style={{fontSize:12,color:authorColor(s.createdBy),fontWeight:700,minWidth:36}}>{s.date?.slice(8)}일</span>
                  <div style={{flex:1}}>
                    <span style={{fontSize:13,color:'#e2e8f0',fontWeight:500}}>{s.title}</span>
                    {s.desc&&<span style={{fontSize:12,color:'#64748b',marginLeft:8}}>{s.desc}</span>}
                  </div>
                  <span style={{fontSize:11,padding:'2px 8px',background:`${authorColor(s.createdBy)}15`,border:`1px solid ${authorColor(s.createdBy)}30`,borderRadius:50,color:authorColor(s.createdBy),fontWeight:600,flexShrink:0}}>{s.createdByName||authorName(s.createdBy)}</span>
                  {mine&&(
                    <div style={{display:'flex',gap:5}}>
                      <button onClick={e=>openEdit(e,s)} style={{padding:'3px 8px',background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.2)',borderRadius:5,color:'#93c5fd',cursor:'pointer',fontSize:11,fontFamily:"'Noto Sans KR',sans-serif"}}>수정</button>
                      <button onClick={e=>handleDelete(e,s)} style={{padding:'3px 8px',background:'rgba(239,68,68,0.08)',border:'none',borderRadius:5,color:'#f87171',cursor:'pointer',fontSize:11}}>삭제</button>
                    </div>
                  )}
                </div>
              )
            })
        }
      </div>

      {/* Add / Edit Modal */}
      {modal&&(
        <Modal onClose={()=>setModal(null)}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
            <h3 style={{fontSize:16,fontWeight:700,color:'#f1f5f9'}}>
              {isEditMode ? '✏️ 일정 수정' : `📅 ${selectedDateStr} 일정 추가`}
            </h3>
            <button onClick={()=>setModal(null)} style={{background:'none',border:'none',color:'#64748b',fontSize:20,cursor:'pointer'}}>✕</button>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div><label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:6}}>일정 제목 *</label>
              <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="예: 팀 미팅, 배포 예정일" style={iS} autoFocus onKeyDown={e=>e.key==='Enter'&&(isEditMode?handleEdit():handleAdd())}/>
            </div>
            <div><label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:6}}>메모 (선택)</label>
              <input value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))} placeholder="추가 메모" style={iS}/>
            </div>
            <div style={{display:'flex',gap:10,marginTop:4}}>
              <button onClick={()=>setModal(null)} style={{flex:1,padding:11,border:'1px solid #334155',borderRadius:9,background:'transparent',color:'#94a3b8',fontWeight:600,fontSize:14,cursor:'pointer',fontFamily:"'Noto Sans KR',sans-serif"}}>취소</button>
              <button onClick={isEditMode?handleEdit:handleAdd} style={{flex:2,padding:11,border:'none',borderRadius:9,background:'linear-gradient(135deg,#2563eb,#1d4ed8)',color:'#fff',fontWeight:700,fontSize:14,cursor:'pointer',fontFamily:"'Noto Sans KR',sans-serif"}}>
                {isEditMode?'수정하기':'추가하기'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      <Toast message={toast} onClose={()=>setToast('')}/>
    </div>
  )
}
