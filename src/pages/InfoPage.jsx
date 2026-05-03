import { useState, useEffect } from 'react'
import { db } from '../firebase.js'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { Toast } from '../components/UI.jsx'

const iS = { width:'100%', padding:'7px 10px', background:'#0a1120', border:'1px solid #1e2e50', borderRadius:7, color:'#e2e8f0', fontSize:12, outline:'none', fontFamily:"'Noto Sans KR',sans-serif" }

function uid() { return 'id'+Date.now()+Math.random().toString(36).slice(2,6) }

// ── 사업자/앱 정보 (커스텀 섹션) ─────────────────────────────────────────────
function SectionsPanel({ canEdit }) {
  const [sections, setSections] = useState([])
  const [editField, setEditField] = useState(null)
  const [editSec, setEditSec] = useState(null)
  const [expandAdd, setExpandAdd] = useState({})
  const [newSecMode, setNewSecMode] = useState(false)
  const [newSecName, setNewSecName] = useState('')
  const [toast, setToast] = useState('')
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),2000) }

  useEffect(() => {
    const unsub = onSnapshot(doc(db,'app_info','sections'), snap => {
      if (snap.exists()) setSections(snap.data().data||[])
      else setSections(DEFAULT_SECTIONS)
    })
    return () => unsub()
  }, [])

  const save = async (updated) => {
    setSections(updated)
    await setDoc(doc(db,'app_info','sections'), { data: updated }, { merge: false })
  }

  const addSection = async () => {
    if (!newSecName.trim()) return
    await save([...sections, { id:uid(), title:newSecName.trim(), fields:[] }])
    setNewSecName(''); setNewSecMode(false); showToast('✅ 섹션이 추가되었습니다')
  }
  const updateSecTitle = async (sId, title) => {
    await save(sections.map(s => s.id===sId ? {...s,title} : s))
    setEditSec(null)
  }
  const deleteSection = async (sId) => {
    const sec = sections.find(s=>s.id===sId)
    if (!window.confirm(`"${sec?.title}" 섹션을 삭제할까요?`)) return
    await save(sections.filter(s=>s.id!==sId)); showToast('🗑️ 삭제되었습니다')
  }
  const addField = async (sId, label, value) => {
    if (!label.trim()) return
    await save(sections.map(s => s.id===sId ? {...s, fields:[...s.fields, {id:uid(),label:label.trim(),value:value.trim(),secret:false}]} : s))
  }
  const saveField = async (sId, fId, label, value, secret) => {
    if (!label.trim()) return
    await save(sections.map(s => s.id===sId ? {...s, fields:s.fields.map(f => f.id===fId ? {...f,label,value,secret} : f)} : s))
    setEditField(null)
  }
  const deleteField = async (sId, fId) => {
    await save(sections.map(s => s.id===sId ? {...s, fields:s.fields.filter(f=>f.id!==fId)} : s))
    if (editField?.fId===fId) setEditField(null)
    showToast('🗑️ 삭제되었습니다')
  }

  const [pwShow, setPwShow] = useState({})

  return (
    <div>
      {canEdit && (
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}>
          <button onClick={()=>setNewSecMode(true)} style={{ padding:'7px 16px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:8, color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>+ 섹션 추가</button>
        </div>
      )}

      {newSecMode && canEdit && (
        <div style={{ background:'#111d35', border:'1px solid rgba(59,130,246,0.3)', borderRadius:12, padding:'14px 16px', marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#93c5fd', marginBottom:10 }}>새 섹션 이름</div>
          <div style={{ display:'flex', gap:8 }}>
            <input value={newSecName} onChange={e=>setNewSecName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addSection()} placeholder="예: 투자 정보, 법무 정보" style={{ ...iS, flex:1 }} autoFocus />
            <button onClick={addSection} style={{ padding:'7px 14px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:7, color:'#fff', fontSize:12, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>추가</button>
            <button onClick={()=>{setNewSecMode(false);setNewSecName('')}} style={{ padding:'7px 12px', background:'transparent', border:'1px solid #1e2e50', borderRadius:7, color:'#64748b', fontSize:12, cursor:'pointer' }}>취소</button>
          </div>
        </div>
      )}

      {sections.map(sec => (
        <div key={sec.id} style={{ marginBottom:20 }}>
          {/* Section header */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            {editSec===sec.id && canEdit
              ? <input defaultValue={sec.title} id={`st-${sec.id}`} style={{ ...iS, flex:1, fontSize:13, fontWeight:600 }} autoFocus
                  onKeyDown={e=>{ if(e.key==='Enter') updateSecTitle(sec.id, e.target.value.trim()); if(e.key==='Escape') setEditSec(null) }}/>
              : <span style={{ fontSize:13, fontWeight:700, color:'#cbd5e1' }}>{sec.title}</span>
            }
            <span style={{ fontSize:11, color:'#475569', background:'#111d35', border:'1px solid #1e2e50', borderRadius:99, padding:'1px 8px' }}>{sec.fields.length}개</span>
            {canEdit && editSec!==sec.id && (
              <div style={{ display:'flex', gap:5, marginLeft:'auto' }}>
                <button onClick={()=>setEditSec(sec.id)} style={{ padding:'3px 8px', fontSize:11, border:'1px solid #1e2e50', borderRadius:6, background:'transparent', color:'#64748b', cursor:'pointer' }}>수정</button>
                <button onClick={()=>deleteSection(sec.id)} style={{ padding:'3px 8px', fontSize:11, border:'none', borderRadius:6, background:'rgba(239,68,68,0.08)', color:'#f87171', cursor:'pointer' }}>삭제</button>
              </div>
            )}
            {canEdit && editSec===sec.id && (
              <div style={{ display:'flex', gap:5, marginLeft:'auto' }}>
                <button onClick={()=>{ const el=document.getElementById(`st-${sec.id}`); if(el) updateSecTitle(sec.id, el.value.trim()) }} style={{ padding:'3px 8px', fontSize:11, border:'1px solid rgba(34,197,94,0.3)', borderRadius:6, background:'rgba(34,197,94,0.1)', color:'#4ade80', cursor:'pointer' }}>저장</button>
                <button onClick={()=>setEditSec(null)} style={{ padding:'3px 8px', fontSize:11, border:'1px solid #1e2e50', borderRadius:6, background:'transparent', color:'#64748b', cursor:'pointer' }}>취소</button>
              </div>
            )}
          </div>

          {/* Fields */}
          <div style={{ background:'#111d35', border:'1px solid #1e2e50', borderRadius:12, overflow:'hidden' }}>
            {sec.fields.map((field, idx) => {
              const isEdit = editField?.sId===sec.id && editField?.fId===field.id
              const showPw = pwShow[field.id]
              const displayVal = field.secret && !showPw ? (field.value?'••••••••':'') : field.value
              return (
                <div key={field.id} style={{ borderBottom: idx<sec.fields.length-1?'1px solid #192640':'none' }}>
                  {isEdit && canEdit ? (
                    <div style={{ display:'flex', alignItems:'center', gap:0, background:'#0d1a2e' }}>
                      <input id={`el-${field.id}`} defaultValue={field.label} placeholder="항목명" style={{ ...iS, width:150, borderRadius:0, border:'none', borderRight:'1px solid #1e2e50', flexShrink:0 }}/>
                      <input id={`ev-${field.id}`} defaultValue={field.value} placeholder="값" type={field.secret?'password':'text'} style={{ ...iS, flex:1, borderRadius:0, border:'none', borderRight:'1px solid #1e2e50' }}/>
                      <label style={{ display:'flex', alignItems:'center', gap:4, padding:'0 12px', fontSize:11, color:'#64748b', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, borderRight:'1px solid #1e2e50' }}>
                        <input type="checkbox" defaultChecked={field.secret} id={`es-${field.id}`} style={{ cursor:'pointer' }}/> 비밀값
                      </label>
                      <div style={{ display:'flex', gap:5, padding:'0 10px', flexShrink:0 }}>
                        <button onClick={()=>{ const l=document.getElementById(`el-${field.id}`)?.value.trim(); const v=document.getElementById(`ev-${field.id}`)?.value.trim(); const s=document.getElementById(`es-${field.id}`)?.checked; if(l) saveField(sec.id,field.id,l,v||'',!!s) }} style={{ padding:'4px 9px', fontSize:11, border:'1px solid rgba(34,197,94,0.3)', borderRadius:6, background:'rgba(34,197,94,0.1)', color:'#4ade80', cursor:'pointer' }}>저장</button>
                        <button onClick={()=>setEditField(null)} style={{ padding:'4px 8px', fontSize:11, border:'1px solid #1e2e50', borderRadius:6, background:'transparent', color:'#64748b', cursor:'pointer' }}>취소</button>
                        <button onClick={()=>deleteField(sec.id,field.id)} style={{ padding:'4px 8px', fontSize:11, border:'none', borderRadius:6, background:'rgba(239,68,68,0.08)', color:'#f87171', cursor:'pointer' }}>삭제</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display:'flex', alignItems:'center', gap:0 }}>
                      <div style={{ width:150, padding:'10px 14px', borderRight:'1px solid #192640', flexShrink:0 }}>
                        <span style={{ fontSize:12, color:'#64748b' }}>{field.label}</span>
                      </div>
                      <div style={{ flex:1, padding:'10px 14px' }}>
                        <span style={{ fontSize:13, color:field.value?'#e2e8f0':'#3d4f6b', fontStyle:field.value?'normal':'italic', letterSpacing:field.secret&&!showPw&&field.value?'3px':'normal' }}>
                          {displayVal||'미입력'}
                        </span>
                        {field.secret && field.value && (
                          <button onClick={()=>setPwShow(p=>({...p,[field.id]:!p[field.id]}))} style={{ marginLeft:8, fontSize:10, color:'#60a5fa', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>{showPw?'숨기기':'보기'}</button>
                        )}
                      </div>
                      {canEdit && (
                        <div style={{ display:'flex', gap:4, padding:'0 10px', flexShrink:0 }}>
                          <button onClick={()=>setEditField({sId:sec.id,fId:field.id})} style={{ padding:'3px 8px', fontSize:11, border:'1px solid #1e2e50', borderRadius:6, background:'transparent', color:'#64748b', cursor:'pointer' }}>수정</button>
                          <button onClick={()=>deleteField(sec.id,field.id)} style={{ padding:'3px 8px', fontSize:11, border:'none', borderRadius:6, background:'rgba(239,68,68,0.08)', color:'#f87171', cursor:'pointer' }}>삭제</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {sec.fields.length===0 && (
              <div style={{ padding:'20px', textAlign:'center', color:'#3d4f6b', fontSize:12 }}>항목이 없습니다{canEdit?' — 아래에서 추가해주세요':''}</div>
            )}

            {/* Add field */}
            {canEdit && (
              expandAdd[sec.id]
                ? <AddFieldRow key={`add-${sec.id}`} secId={sec.id} onAdd={async(l,v,s)=>{ await addField(sec.id,l,v); setExpandAdd(p=>({...p,[sec.id]:false})) }} onCancel={()=>setExpandAdd(p=>({...p,[sec.id]:false}))} />
                : <button onClick={()=>setExpandAdd(p=>({...p,[sec.id]:true}))} style={{ width:'100%', padding:'9px', background:'#0a1120', border:'none', borderTop:'1px solid #192640', color:'#475569', fontSize:12, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>+ 항목 추가</button>
            )}
          </div>
        </div>
      ))}

      {sections.length===0 && (
        <div style={{ textAlign:'center', padding:'40px 0', color:'#475569', fontSize:13 }}>
          {canEdit ? '섹션을 추가해서 정보를 관리해보세요' : '등록된 정보가 없습니다'}
        </div>
      )}

      <Toast message={toast} onClose={()=>setToast('')}/>
    </div>
  )
}

function AddFieldRow({ onAdd, onCancel }) {
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')
  return (
    <div style={{ display:'flex', gap:8, padding:'10px 14px', background:'#0a1120', borderTop:'1px solid #192640' }}>
      <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="항목명 (예: 사업자등록번호)" style={{ ...iS, flex:'0 0 180px' }} autoFocus onKeyDown={e=>e.key==='Enter'&&onAdd(label,value,false)}/>
      <input value={value} onChange={e=>setValue(e.target.value)} placeholder="값 (나중에 입력 가능)" style={{ ...iS, flex:1 }} onKeyDown={e=>e.key==='Enter'&&onAdd(label,value,false)}/>
      <button onClick={()=>onAdd(label,value,false)} style={{ padding:'7px 12px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:7, color:'#fff', fontSize:12, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif", whiteSpace:'nowrap' }}>추가</button>
      <button onClick={onCancel} style={{ padding:'7px 10px', background:'transparent', border:'1px solid #1e2e50', borderRadius:7, color:'#64748b', fontSize:12, cursor:'pointer' }}>취소</button>
    </div>
  )
}

// 기본 섹션
const DEFAULT_SECTIONS = [
  { id:'ds1', title:'기본 사업자 정보', fields:[
    {id:'df1',label:'상호명',value:'',secret:false},
    {id:'df2',label:'사업자등록번호',value:'',secret:false},
    {id:'df3',label:'대표자명',value:'',secret:false},
    {id:'df4',label:'업태 / 업종',value:'',secret:false},
    {id:'df5',label:'사업장 주소',value:'',secret:false},
    {id:'df6',label:'대표 전화번호',value:'',secret:false},
    {id:'df7',label:'대표 이메일',value:'',secret:false},
  ]},
  { id:'ds2', title:'세무 / 회계 정보', fields:[
    {id:'df8',label:'세무사 사무소',value:'',secret:false},
    {id:'df9',label:'담당 세무사',value:'',secret:false},
    {id:'df10',label:'세무사 연락처',value:'',secret:false},
    {id:'df11',label:'부가세 신고 유형',value:'일반과세자',secret:false},
  ]},
  { id:'ds3', title:'앱 기본 정보', fields:[
    {id:'df12',label:'앱 이름',value:'여행하게',secret:false},
    {id:'df13',label:'슬로건',value:'출발은 혼자, 기억은 같이',secret:false},
    {id:'df14',label:'현재 버전',value:'',secret:false},
    {id:'df15',label:'출시일',value:'',secret:false},
    {id:'df16',label:'고객센터 이메일',value:'',secret:false},
    {id:'df17',label:'개인정보처리방침 URL',value:'',secret:false},
  ]},
]

// ── 앱 계정 관리 ──────────────────────────────────────────────────────────────
const DEFAULT_ACCOUNTS = [
  { id:'ac1', name:'Firebase', icon:'🔥', desc:'백엔드 · 데이터베이스', fields:[
    {id:'af1',label:'프로젝트 ID',value:'bugtracker-e32c0',secret:false},
    {id:'af2',label:'플랜',value:'Spark (무료)',secret:false},
    {id:'af3',label:'로그인 이메일',value:'',secret:false},
    {id:'af4',label:'콘솔 URL',value:'console.firebase.google.com',secret:false},
  ]},
  { id:'ac2', name:'Vercel', icon:'▲', desc:'배포 · 호스팅', fields:[
    {id:'af5',label:'프로젝트명',value:'hage-e8kx',secret:false},
    {id:'af6',label:'플랜',value:'Hobby (무료)',secret:false},
    {id:'af7',label:'배포 URL',value:'hage-e8kx.vercel.app',secret:false},
    {id:'af8',label:'GitHub 레포',value:'nam9359359-pixel/hage',secret:false},
  ]},
  { id:'ac3', name:'Apple Developer', icon:'🍎', desc:'App Store · iOS 배포', fields:[
    {id:'af9',label:'Apple ID',value:'',secret:false},
    {id:'af10',label:'Team ID',value:'',secret:false},
    {id:'af11',label:'번들 ID',value:'',secret:false},
    {id:'af12',label:'연간 갱신일',value:'',secret:false},
  ]},
  { id:'ac4', name:'Google Play Console', icon:'▶', desc:'Play Store · Android 배포', fields:[
    {id:'af13',label:'계정 이메일',value:'',secret:false},
    {id:'af14',label:'패키지명',value:'',secret:false},
  ]},
]

function AccountsPanel({ canEdit }) {
  const [accounts, setAccounts] = useState([])
  const [editField, setEditField] = useState(null)
  const [expandAdd, setExpandAdd] = useState({})
  const [newCardMode, setNewCardMode] = useState(false)
  const [newCard, setNewCard] = useState({ name:'', icon:'', desc:'' })
  const [pwShow, setPwShow] = useState({})
  const [toast, setToast] = useState('')
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),2000) }

  useEffect(() => {
    const unsub = onSnapshot(doc(db,'app_info','accounts'), snap => {
      if (snap.exists()) setAccounts(snap.data().data||[])
      else setAccounts(DEFAULT_ACCOUNTS)
    })
    return () => unsub()
  }, [])

  const save = async (updated) => {
    setAccounts(updated)
    await setDoc(doc(db,'app_info','accounts'), { data: updated }, { merge: false })
  }

  const addCard = async () => {
    if (!newCard.name.trim()) return
    await save([...accounts, { id:uid(), name:newCard.name.trim(), icon:newCard.icon||'🔗', desc:newCard.desc.trim()||'계정 정보', fields:[] }])
    setNewCard({ name:'', icon:'', desc:'' }); setNewCardMode(false); showToast('✅ 계정이 추가되었습니다')
  }
  const deleteCard = async (cId) => {
    const card = accounts.find(c=>c.id===cId)
    if (!window.confirm(`"${card?.name}" 카드를 삭제할까요?`)) return
    await save(accounts.filter(c=>c.id!==cId)); showToast('🗑️ 삭제되었습니다')
  }
  const addField = async (cId, label, value, secret) => {
    if (!label.trim()) return
    await save(accounts.map(c => c.id===cId ? {...c, fields:[...c.fields, {id:uid(),label:label.trim(),value:value.trim(),secret:!!secret}]} : c))
  }
  const saveField = async (cId, fId, label, value, secret) => {
    if (!label.trim()) return
    await save(accounts.map(c => c.id===cId ? {...c, fields:c.fields.map(f => f.id===fId ? {...f,label,value,secret} : f)} : c))
    setEditField(null)
  }
  const deleteField = async (cId, fId) => {
    await save(accounts.map(c => c.id===cId ? {...c, fields:c.fields.filter(f=>f.id!==fId)} : c))
    if (editField?.fId===fId) setEditField(null)
    showToast('🗑️ 삭제되었습니다')
  }

  return (
    <div>
      {canEdit && (
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}>
          <button onClick={()=>setNewCardMode(true)} style={{ padding:'7px 16px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:8, color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>+ 계정 추가</button>
        </div>
      )}

      {newCardMode && canEdit && (
        <div style={{ background:'#111d35', border:'1px solid rgba(59,130,246,0.3)', borderRadius:12, padding:'16px', marginBottom:14 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#93c5fd', marginBottom:12 }}>새 계정 카드</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 1fr', gap:8, marginBottom:10 }}>
            <div><div style={{ fontSize:11, color:'#64748b', marginBottom:4 }}>서비스명 *</div><input value={newCard.name} onChange={e=>setNewCard(n=>({...n,name:e.target.value}))} placeholder="예: AWS, GitHub" style={iS} autoFocus/></div>
            <div><div style={{ fontSize:11, color:'#64748b', marginBottom:4 }}>아이콘</div><input value={newCard.icon} onChange={e=>setNewCard(n=>({...n,icon:e.target.value}))} placeholder="🔗" maxLength={4} style={{...iS,textAlign:'center'}}/></div>
            <div><div style={{ fontSize:11, color:'#64748b', marginBottom:4 }}>설명 (역할/용도)</div><input value={newCard.desc} onChange={e=>setNewCard(n=>({...n,desc:e.target.value}))} placeholder="예: 클라우드 스토리지" style={iS}/></div>
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button onClick={()=>{setNewCardMode(false);setNewCard({name:'',icon:'',desc:''})}} style={{ padding:'7px 14px', background:'transparent', border:'1px solid #1e2e50', borderRadius:7, color:'#64748b', fontSize:12, cursor:'pointer' }}>취소</button>
            <button onClick={addCard} style={{ padding:'7px 16px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:7, color:'#fff', fontSize:12, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>추가하기</button>
          </div>
        </div>
      )}

      {accounts.map(card => {
        const hasValue = card.fields.some(f=>f.value)
        return (
          <div key={card.id} style={{ background:'#111d35', border:'1px solid #1e2e50', borderRadius:14, marginBottom:12, overflow:'hidden' }}>
            {/* Card header */}
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'13px 16px', borderBottom:'1px solid #1e2e50' }}>
              <div style={{ width:34, height:34, borderRadius:8, background:'#0a1120', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{card.icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600, color:'#e2e8f0' }}>{card.name}</div>
                <div style={{ fontSize:11, color:'#64748b' }}>{card.desc}</div>
              </div>
              <span style={{ fontSize:10, padding:'2px 8px', borderRadius:99, border:'1px solid', background:hasValue?'rgba(34,197,94,0.1)':'rgba(255,255,255,0.04)', color:hasValue?'#4ade80':'#64748b', borderColor:hasValue?'rgba(34,197,94,0.25)':'#1e2e50' }}>{hasValue?'입력됨':'미입력'}</span>
              {canEdit && (
                <div style={{ display:'flex', gap:5 }}>
                  <button onClick={()=>setExpandAdd(p=>({...p,[card.id]:!p[card.id]}))} style={{ padding:'4px 10px', fontSize:11, border:'1px solid #1e2e50', borderRadius:6, background:'transparent', color:'#64748b', cursor:'pointer' }}>{expandAdd[card.id]?'▲':'+ 항목 추가'}</button>
                  <button onClick={()=>deleteCard(card.id)} style={{ padding:'4px 8px', fontSize:11, border:'none', borderRadius:6, background:'rgba(239,68,68,0.08)', color:'#f87171', cursor:'pointer' }}>삭제</button>
                </div>
              )}
            </div>

            {/* Fields */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
              {card.fields.map((field, idx) => {
                const isEdit = editField?.cId===card.id && editField?.fId===field.id
                const showPw = pwShow[field.id]
                const displayVal = field.secret && !showPw ? (field.value?'••••••••':'') : field.value
                const isLastOdd = card.fields.length%2!==0 && idx===card.fields.length-1
                if (isEdit && canEdit) {
                  return (
                    <div key={field.id} style={{ gridColumn:'1/-1', display:'flex', alignItems:'center', background:'#0d1a2e', borderBottom: idx<card.fields.length-1?'1px solid #192640':'none' }}>
                      <input id={`el-${field.id}`} defaultValue={field.label} placeholder="항목명" style={{ ...iS, width:140, borderRadius:0, border:'none', borderRight:'1px solid #1e2e50', flexShrink:0 }}/>
                      <input id={`ev-${field.id}`} defaultValue={field.value} placeholder="값" type={field.secret?'password':'text'} style={{ ...iS, flex:1, borderRadius:0, border:'none', borderRight:'1px solid #1e2e50' }}/>
                      <label style={{ display:'flex', alignItems:'center', gap:4, padding:'0 10px', fontSize:11, color:'#64748b', cursor:'pointer', whiteSpace:'nowrap', borderRight:'1px solid #1e2e50', flexShrink:0 }}>
                        <input type="checkbox" id={`es-${field.id}`} defaultChecked={field.secret} style={{ cursor:'pointer' }}/> 비밀
                      </label>
                      <div style={{ display:'flex', gap:4, padding:'0 8px', flexShrink:0 }}>
                        <button onClick={()=>{ const l=document.getElementById(`el-${field.id}`)?.value.trim(); const v=document.getElementById(`ev-${field.id}`)?.value.trim(); const s=document.getElementById(`es-${field.id}`)?.checked; if(l) saveField(card.id,field.id,l,v||'',!!s) }} style={{ padding:'3px 8px', fontSize:11, border:'1px solid rgba(34,197,94,0.3)', borderRadius:5, background:'rgba(34,197,94,0.1)', color:'#4ade80', cursor:'pointer' }}>저장</button>
                        <button onClick={()=>setEditField(null)} style={{ padding:'3px 7px', fontSize:11, border:'1px solid #1e2e50', borderRadius:5, background:'transparent', color:'#64748b', cursor:'pointer' }}>취소</button>
                        <button onClick={()=>deleteField(card.id,field.id)} style={{ padding:'3px 7px', fontSize:11, border:'none', borderRadius:5, background:'rgba(239,68,68,0.08)', color:'#f87171', cursor:'pointer' }}>삭제</button>
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={field.id} style={{ padding:'10px 14px', borderBottom:'1px solid #192640', borderRight:(idx%2===0&&!isLastOdd)?'1px solid #192640':'none', gridColumn:isLastOdd?'1/-1':'auto' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                      <span style={{ fontSize:11, color:'#64748b' }}>{field.label}</span>
                      <div style={{ display:'flex', gap:4 }}>
                        {field.secret && field.value && <button onClick={()=>setPwShow(p=>({...p,[field.id]:!p[field.id]}))} style={{ fontSize:10, color:'#60a5fa', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>{showPw?'숨기기':'보기'}</button>}
                        {canEdit && <>
                          <button onClick={()=>setEditField({cId:card.id,fId:field.id})} style={{ padding:'1px 6px', fontSize:10, border:'1px solid #1e2e50', borderRadius:4, background:'transparent', color:'#64748b', cursor:'pointer' }}>수정</button>
                          <button onClick={()=>deleteField(card.id,field.id)} style={{ padding:'1px 6px', fontSize:10, border:'none', borderRadius:4, background:'rgba(239,68,68,0.08)', color:'#f87171', cursor:'pointer' }}>삭제</button>
                        </>}
                      </div>
                    </div>
                    <div style={{ fontSize:12, color:field.value?'#e2e8f0':'#3d4f6b', fontStyle:field.value?'normal':'italic', letterSpacing:field.secret&&!showPw&&field.value?'3px':'normal' }}>
                      {displayVal||'미입력'}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Add field row */}
            {canEdit && expandAdd[card.id] && (
              <div style={{ display:'flex', gap:8, padding:'10px 14px', background:'#0a1120', borderTop:'1px solid #192640' }}>
                <input id={`af-l-${card.id}`} placeholder="항목명" style={{ ...iS, flex:'0 0 160px' }} autoFocus onKeyDown={e=>{ if(e.key==='Enter'){ const l=document.getElementById(`af-l-${card.id}`)?.value.trim(); const v=document.getElementById(`af-v-${card.id}`)?.value.trim(); if(l){ addField(card.id,l,v,false); document.getElementById(`af-l-${card.id}`).value=''; document.getElementById(`af-v-${card.id}`).value=''; } } }}/>
                <input id={`af-v-${card.id}`} placeholder="값 (나중에 입력 가능)" style={{ ...iS, flex:1 }}/>
                <button onClick={()=>{ const l=document.getElementById(`af-l-${card.id}`)?.value.trim(); const v=document.getElementById(`af-v-${card.id}`)?.value.trim(); if(l){ addField(card.id,l,v,false); document.getElementById(`af-l-${card.id}`).value=''; document.getElementById(`af-v-${card.id}`).value=''; } else document.getElementById(`af-l-${card.id}`)?.focus() }} style={{ padding:'7px 12px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:7, color:'#fff', fontSize:12, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif", whiteSpace:'nowrap' }}>추가</button>
              </div>
            )}

            {card.fields.length===0 && (
              <div style={{ padding:'16px', textAlign:'center', color:'#3d4f6b', fontSize:12 }}>{canEdit?'항목을 추가해주세요':'등록된 항목이 없습니다'}</div>
            )}
          </div>
        )
      })}

      {accounts.length===0 && (
        <div style={{ textAlign:'center', padding:'40px 0', color:'#475569', fontSize:13 }}>{canEdit?'계정 카드를 추가해보세요':'등록된 계정 정보가 없습니다'}</div>
      )}
      <Toast message={toast} onClose={()=>setToast('')}/>
    </div>
  )
}

// ── 메인 InfoPage 컴포넌트 ────────────────────────────────────────────────────
export default function InfoPage({ user }) {
  const [tab, setTab] = useState('sections')
  const canEdit = user.role === 'admin'
  const canView = user.role === 'admin' || user.permissions?.info?.view !== false

  if (!canView) return (
    <div style={{ textAlign:'center', padding:'60px 0', color:'#475569' }}>
      <div style={{ fontSize:40, marginBottom:12 }}>🔒</div>
      <p style={{ fontSize:14 }}>접근 권한이 없습니다</p>
    </div>
  )

  return (
    <div>
      {/* 읽기 전용 배너 (멤버) */}
      {!canEdit && (
        <div style={{ background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.15)', borderRadius:10, padding:'9px 14px', marginBottom:16, fontSize:12, color:'#64748b' }}>
          🔒 열람 전용 — 수정은 찬(대표)만 가능합니다
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid #1e2e50', marginBottom:20 }}>
        {[['sections','사업자 / 앱 정보'],['accounts','앱 계정 관리']].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{ padding:'8px 18px', border:'none', background:'transparent', fontSize:13, fontWeight:600, cursor:'pointer', color:tab===t?'#93c5fd':'#4a5568', borderBottom:`2px solid ${tab===t?'#3b82f6':'transparent'}`, marginBottom:-1, fontFamily:"'Noto Sans KR',sans-serif" }}>{l}</button>
        ))}
      </div>

      {tab==='sections' && <SectionsPanel canEdit={canEdit}/>}
      {tab==='accounts' && <AccountsPanel canEdit={canEdit}/>}
    </div>
  )
}
