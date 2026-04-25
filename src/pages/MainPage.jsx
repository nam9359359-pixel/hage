import { useState, useEffect } from 'react'
import { db, storage } from '../firebase.js'
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { BIG_CATS, SUB_CATS, CAT_ICONS, STATUS_LIST, STATUS_STYLE, ACCOUNTS } from '../constants.js'
import { logActivity, formatDate } from '../utils.js'
import Header from '../components/Header.jsx'
import { Toast, Modal, ConfirmDialog, SectionCard, Empty } from '../components/UI.jsx'

const iS = { width:'100%', padding:'9px 11px', background:'#0a1120', border:'1px solid #1e2e50', borderRadius:8, color:'#e2e8f0', fontSize:13, outline:'none', fontFamily:"'Noto Sans KR',sans-serif" }

function ItemForm({ initial, onSave, onClose }) {
  const bigCatId = initial?.bigCat || 'dev'
  const [form, setForm] = useState({ bigCat:bigCatId, category:initial?.category||(SUB_CATS[bigCatId]?.[0]||''), page:initial?.page||'', desc:initial?.desc||'', detail:initial?.detail||'', status:initial?.status||'대기', assignee:initial?.assignee||'', urgent:initial?.urgent||false, id:initial?.id })
  const [imgFile, setImgFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const hasSub = form.bigCat==='dev'||form.bigCat==='design'
  const subs = SUB_CATS[form.bigCat]||[]

  const handleSave = async () => {
    if (!form.desc.trim()) return
    let imageUrl = initial?.imageUrl||''
    if (imgFile) {
      setUploading(true)
      try {
        const sr = ref(storage, `items/${Date.now()}_${imgFile.name}`)
        await uploadBytes(sr, imgFile)
        imageUrl = await getDownloadURL(sr)
      } catch(e) { console.warn(e) }
      setUploading(false)
    }
    await onSave({ ...form, imageUrl })
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
        <h3 style={{ fontSize:17, fontWeight:700, color:'#f1f5f9' }}>{initial?.id?'✏️ 업무 수정':'➕ 업무 요청'}</h3>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'#64748b', fontSize:20, cursor:'pointer' }}>✕</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div><label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:5 }}>대분류</label>
          <select value={form.bigCat} onChange={e=>{const v=e.target.value;set('bigCat',v);set('category',SUB_CATS[v]?.[0]||'')}} style={iS}>
            {BIG_CATS.map(b=><option key={b.id} value={b.id} style={{background:'#111d35'}}>{b.icon} {b.label}</option>)}
          </select>
        </div>
        {hasSub
          ? <div><label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:5}}>소카테고리</label>
              <select value={form.category} onChange={e=>set('category',e.target.value)} style={iS}>
                {subs.map(s=><option key={s} value={s} style={{background:'#111d35'}}>{s}</option>)}
              </select></div>
          : <div><label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:5}}>항목명</label>
              <input value={form.category} onChange={e=>set('category',e.target.value)} placeholder="항목명" style={iS}/></div>
        }
      </div>
      {hasSub && <div><label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:5}}>페이지명</label><input value={form.page} onChange={e=>set('page',e.target.value)} placeholder="예: 회원가입 P" style={iS}/></div>}
      <div><label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:5}}>업무 내용 *</label>
        <textarea value={form.desc} onChange={e=>set('desc',e.target.value)} placeholder="업무 내용을 입력하세요" rows={3} style={{...iS,resize:'vertical'}}/>
      </div>
      <div><label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:5}}>상세 설명 (선택)</label>
        <input value={form.detail} onChange={e=>set('detail',e.target.value)} placeholder="추가 설명" style={iS}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:5}}>담당자</label>
          <select value={form.assignee} onChange={e=>set('assignee',e.target.value)} style={iS}>
            <option value="" style={{background:'#111d35'}}>미지정</option>
            {ACCOUNTS.map(a=><option key={a.id} value={a.id} style={{background:'#111d35'}}>{a.name}</option>)}
          </select>
        </div>
        <div><label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:5}}>상태</label>
          <select value={form.status} onChange={e=>set('status',e.target.value)} style={iS}>
            {STATUS_LIST.map(s=><option key={s} value={s} style={{background:'#111d35'}}>{s}</option>)}
          </select>
        </div>
      </div>
      <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,color:'#e2e8f0'}}>
        <input type="checkbox" checked={form.urgent} onChange={e=>set('urgent',e.target.checked)} style={{width:16,height:16,accentColor:'#ef4444'}}/>
        🚨 긴급 항목으로 표시
      </label>
      <div><label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:5}}>이미지 첨부 (선택)</label>
        <input type="file" accept="image/*" onChange={e=>setImgFile(e.target.files[0])} style={{...iS,padding:'6px 11px'}}/>
      </div>
      <div style={{display:'flex',gap:10,marginTop:4}}>
        <button onClick={onClose} style={{flex:1,padding:11,border:'1px solid #334155',borderRadius:9,background:'transparent',color:'#94a3b8',fontWeight:600,fontSize:14,cursor:'pointer',fontFamily:"'Noto Sans KR',sans-serif"}}>취소</button>
        <button onClick={handleSave} disabled={uploading} style={{flex:2,padding:11,border:'none',borderRadius:9,background:'linear-gradient(135deg,#2563eb,#1d4ed8)',color:'#fff',fontWeight:700,fontSize:14,cursor:uploading?'not-allowed':'pointer',fontFamily:"'Noto Sans KR',sans-serif"}}>
          {uploading?'업로드 중...':'저장하기'}
        </button>
      </div>
    </div>
  )
}

function ItemRow({ item, user, canEdit, onStatus, onEdit, onDelete, onDetail, assigneeName, comments, onDeleteComment }) {
  const sc = STATUS_STYLE[item.status]||STATUS_STYLE['대기']
  const assignee = assigneeName(item.assignee)
  const preview = (comments||[]).slice(0,3)
  const extra = (comments||[]).length - 3

  return (
    <div style={{borderBottom:'1px solid #192640'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'13px 16px',transition:'background 0.1s'}}
        onMouseEnter={e=>e.currentTarget.style.background='#162035'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
        <span style={{fontSize:11,color:'#3d4f6b',minWidth:16,fontWeight:600}}>{item.id}</span>
        <div style={{flex:1,minWidth:0}}>
          {item.page && <div style={{fontSize:11,color:'#93c5fd',fontWeight:600,background:'rgba(59,130,246,0.12)',display:'inline-block',borderRadius:5,padding:'1px 7px',marginBottom:4}}>{item.page}</div>}
          <div style={{fontSize:13,fontWeight:500,color:'#e2e8f0',lineHeight:1.5}}>{item.desc}</div>
          {item.detail && <div style={{marginTop:3,fontSize:11,color:'#64748b',background:'#0a1120',display:'inline-block',borderRadius:5,padding:'2px 8px'}}>💡 {item.detail}</div>}
          {item.imageUrl && <div style={{marginTop:6}}><img src={item.imageUrl} alt="" style={{maxHeight:70,borderRadius:6,border:'1px solid #1e2e50',cursor:'pointer'}} onClick={()=>window.open(item.imageUrl,'_blank')}/></div>}
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:5,flexShrink:0}}>
          {assignee && <span style={{fontSize:11,padding:'2px 9px',background:'rgba(167,139,250,0.12)',border:'1px solid rgba(167,139,250,0.25)',borderRadius:50,color:'#a78bfa',fontWeight:600}}>{assignee}</span>}
          <select value={item.status} onChange={e=>onStatus(item,e.target.value)} style={{background:sc.bg,border:`1px solid ${sc.border}`,borderRadius:18,color:sc.color,fontWeight:700,fontSize:11,padding:'3px 8px',cursor:'pointer',outline:'none',fontFamily:"'Noto Sans KR',sans-serif"}}>
            {STATUS_LIST.map(s=><option key={s} value={s} style={{background:'#111d35',color:'#e2e8f0'}}>{s}</option>)}
          </select>
        </div>
        {/* 수정/삭제 | 댓글 분리 */}
        <div style={{display:'flex',flexDirection:'column',gap:5,flexShrink:0,paddingLeft:10,borderLeft:'1px solid #1e2e50'}}>
          {canEdit && (
            <div style={{display:'flex',gap:4}}>
              <button onClick={onEdit} style={{padding:'4px 10px',background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.2)',borderRadius:6,color:'#93c5fd',fontSize:11,cursor:'pointer',fontFamily:"'Noto Sans KR',sans-serif"}}>✏️ 수정</button>
              {user.role==='admin' && <button onClick={onDelete} style={{padding:'4px 8px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.15)',borderRadius:6,color:'#f87171',fontSize:11,cursor:'pointer'}}>🗑️</button>}
            </div>
          )}
          <button onClick={onDetail} style={{padding:'4px 10px',background:'rgba(100,116,139,0.08)',border:'1px solid rgba(100,116,139,0.15)',borderRadius:6,color:'#94a3b8',fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',gap:4,justifyContent:'center',fontFamily:"'Noto Sans KR',sans-serif"}}>
            💬 {(comments||[]).length>0?`댓글 ${(comments||[]).length}`:'댓글'}
          </button>
        </div>
      </div>

      {/* 댓글 미리보기 */}
      {preview.length>0 && (
        <div style={{padding:'0 16px 12px 46px',display:'flex',flexDirection:'column',gap:5}}>
          {preview.map(c=>{
            const isMe = c.userId===user.id
            return (
              <div key={c.id} style={{display:'flex',alignItems:'flex-start',gap:7,padding:'6px 10px',background:'rgba(255,255,255,0.02)',border:'1px solid #192640',borderRadius:8}}>
                <div style={{width:20,height:20,borderRadius:'50%',background:isMe?'rgba(59,130,246,0.2)':'rgba(255,255,255,0.06)',border:`1px solid ${isMe?'rgba(59,130,246,0.3)':'rgba(255,255,255,0.08)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:isMe?'#93c5fd':'#94a3b8',flexShrink:0}}>{c.userName[0]}</div>
                <div style={{flex:1,minWidth:0}}>
                  <span style={{fontSize:11,fontWeight:700,color:isMe?'#93c5fd':'#94a3b8',marginRight:5}}>{c.userName}</span>
                  <span style={{fontSize:12,color:'#cbd5e1',lineHeight:1.5}}>{c.text}</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:5,flexShrink:0}}>
                  <span style={{fontSize:10,color:'#3d4f6b',whiteSpace:'nowrap'}}>{formatDate(c.createdAt)}</span>
                  {isMe && <button onClick={()=>onDeleteComment(item.id,c.id)} style={{padding:'1px 5px',background:'rgba(239,68,68,0.08)',border:'none',borderRadius:4,color:'#f87171',fontSize:10,cursor:'pointer'}}>✕</button>}
                </div>
              </div>
            )
          })}
          {extra>0 && (
            <button onClick={onDetail} style={{alignSelf:'flex-start',fontSize:12,color:'#60a5fa',background:'none',border:'none',cursor:'pointer',padding:'2px 0',fontFamily:"'Noto Sans KR',sans-serif"}}>
              댓글 {extra}개 더보기 →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function MainPage({ user, navigate, onLogout, currentPage }) {
  const [items, setItems] = useState([])
  const [allComments, setAllComments] = useState({})
  const [pinnedAnnouncements, setPinnedAnnouncements] = useState([])
  const [activeBigCat, setActiveBigCat] = useState('dev')
  const [filterStatus, setFilterStatus] = useState('전체')
  const [filterSubCat, setFilterSubCat] = useState('전체')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [toast, setToast] = useState('')
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),2500) }
  const canEdit = user.role==='admin' || user.permissions?.[activeBigCat]?.edit

  useEffect(() => {
    const unsub = onSnapshot(collection(db,'bugtracker'), snap => {
      const data = snap.docs.map(d=>({...d.data(),id:d.id}))
      data.sort((a,b)=>parseInt(a.id)-parseInt(b.id))
      setItems(data)
    })
    return ()=>unsub()
  },[])

  useEffect(() => {
    if (!items.length) return
    const unsubs = items.map(item => {
      const q = query(collection(db,'bugtracker',item.id,'comments'), orderBy('createdAt','asc'))
      return onSnapshot(q, snap => {
        const comments = snap.docs.map(d=>({...d.data(),id:d.id}))
        setAllComments(prev=>({...prev,[item.id]:comments}))
      })
    })
    return ()=>unsubs.forEach(u=>u())
  },[items.length])

  useEffect(() => {
    const unsub = onSnapshot(collection(db,'announcements'), snap => {
      const data = snap.docs.map(d=>({...d.data(),id:d.id}))
        .filter(a=>a.pinned)
        .sort((a,b)=>(b.createdAt?.toMillis?.()??0)-(a.createdAt?.toMillis?.()??0))
      setPinnedAnnouncements(data.slice(0,3))
    })
    return ()=>unsub()
  },[])

  const handleSave = async (form) => {
    const isNew = !form.id
    const maxId = Math.max(0,...items.map(i=>parseInt(i.id)||0))
    const id = isNew ? String(maxId+1) : form.id
    const data = { bigCat:form.bigCat, category:form.category||'', page:form.page||'', desc:form.desc, detail:form.detail||'', status:form.status||'대기', assignee:form.assignee||'', urgent:form.urgent||false, imageUrl:form.imageUrl||'' }
    if (isNew) { data.createdAt = serverTimestamp(); data.createdBy = user.id }
    await setDoc(doc(db,'bugtracker',id), data, { merge:true })
    await logActivity({ userId:user.id, userName:user.name, action:isNew?'업무 추가':'업무 수정', itemId:id, itemDesc:form.desc })
    showToast(isNew?'✅ 업무가 추가되었습니다':'✅ 업무가 수정되었습니다')
    setModal(null)
  }

  const handleStatusChange = async (item, newStatus) => {
    await updateDoc(doc(db,'bugtracker',item.id), { status:newStatus })
    await logActivity({ userId:user.id, userName:user.name, action:`상태 변경: ${item.status} → ${newStatus}`, itemId:item.id, itemDesc:item.desc })
    showToast('🔄 상태가 변경되었습니다')
  }

  const handleDelete = async (item) => {
    await deleteDoc(doc(db,'bugtracker',item.id))
    await logActivity({ userId:user.id, userName:user.name, action:'업무 삭제', itemId:item.id, itemDesc:item.desc })
    setConfirmDel(null)
    showToast('🗑️ 항목이 삭제되었습니다')
  }

  const handleDeleteComment = async (itemId, commentId) => {
    await deleteDoc(doc(db,'bugtracker',itemId,'comments',commentId))
    showToast('💬 댓글이 삭제되었습니다')
  }

  const canView = user.role==='admin' || user.permissions?.[activeBigCat]?.view
  const cat = BIG_CATS.find(b=>b.id===activeBigCat)
  const hasSub = activeBigCat==='dev'||activeBigCat==='design'
  const subCats = SUB_CATS[activeBigCat]||[]
  const assigneeName = id => ACCOUNTS.find(a=>a.id===id)?.name||''

  const filtered = items.filter(item => {
    if (item.bigCat!==activeBigCat) return false
    if (filterStatus==='전체') { if (item.status==='검토완료') return false }
    else { if (item.status!==filterStatus) return false }
    if (filterSubCat!=='전체' && item.category!==filterSubCat) return false
    if (search && !item.desc.includes(search) && !item.page?.includes(search) && !item.category?.includes(search)) return false
    return true
  })

  const urgentItems = filtered.filter(i=>i.urgent)
  const normalItems = filtered.filter(i=>!i.urgent)
  const grouped = [...(hasSub?subCats:[]), ...new Set(normalItems.map(i=>i.category).filter(c=>!subCats.includes(c)))].reduce((acc,catName)=>{
    const its = normalItems.filter(i=>i.category===catName)
    if (its.length>0) acc[catName]=its
    return acc
  },{})

  const catAll = items.filter(i=>i.bigCat===activeBigCat&&i.status!=='검토완료')
  const waiting = catAll.filter(i=>i.status==='대기').length
  const inProgress = catAll.filter(i=>i.status==='진행').length
  const done = catAll.filter(i=>i.status==='완료').length
  const reviewed = items.filter(i=>i.bigCat===activeBigCat&&i.status==='검토완료').length
  const pct = catAll.length ? Math.round((done/catAll.length)*100) : 0

  return (
    <div style={{minHeight:'100vh',background:'#0d1526'}}>
      <Header user={user} navigate={navigate} onLogout={onLogout} currentPage={currentPage}/>

      {/* Big category tabs */}
      <div style={{background:'#0d1526',borderBottom:'1px solid #1e2e50',display:'flex',padding:'0 20px',overflowX:'auto'}}>
        {BIG_CATS.map(bc=>{
          const canViewTab = user.role==='admin'||user.permissions?.[bc.id]?.view
          if (!canViewTab) return null
          const cnt = items.filter(i=>i.bigCat===bc.id&&i.status!=='검토완료').length
          const active = activeBigCat===bc.id
          return (
            <button key={bc.id} onClick={()=>{setActiveBigCat(bc.id);setFilterSubCat('전체');setFilterStatus('전체')}}
              style={{display:'flex',alignItems:'center',gap:7,padding:'13px 22px',border:'none',background:'transparent',fontSize:13,fontWeight:600,cursor:'pointer',borderBottom:`2px solid ${active?bc.color:'transparent'}`,marginBottom:-1,whiteSpace:'nowrap',color:active?bc.color:'#4a5568',fontFamily:"'Noto Sans KR',sans-serif",transition:'all 0.15s'}}>
              {bc.icon} {bc.label}
              <span style={{fontSize:10,borderRadius:9,padding:'1px 7px',fontWeight:700,background:active?`${bc.color}25`:'rgba(255,255,255,0.05)',color:active?bc.color:'#4a5568'}}>{cnt}</span>
            </button>
          )
        })}
      </div>

      <div style={{maxWidth:1100,margin:'0 auto',padding:'22px 20px'}}>
        {!canView ? (
          <div style={{textAlign:'center',padding:'80px 0',color:'#475569'}}>
            <div style={{fontSize:48,marginBottom:14}}>🔒</div>
            <p style={{fontSize:16,color:'#64748b'}}>이 카테고리에 대한 접근 권한이 없습니다</p>
          </div>
        ) : (
          <>
            {/* 공지사항 패널 */}
            {pinnedAnnouncements.length>0 && (
              <div style={{background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:14,padding:'16px 20px',marginBottom:22}}>
                <div style={{fontSize:12,fontWeight:700,color:'#fcd34d',marginBottom:12,display:'flex',alignItems:'center',gap:6}}>
                  📣 공지사항
                  <button onClick={()=>navigate('announcements')} style={{marginLeft:'auto',fontSize:11,color:'#b45309',background:'none',border:'none',cursor:'pointer',fontFamily:"'Noto Sans KR',sans-serif"}}>전체 보기 →</button>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {pinnedAnnouncements.map(a=>(
                    <div key={a.id} onClick={()=>navigate('announcements')} style={{cursor:'pointer',padding:'10px 14px',background:'rgba(245,158,11,0.04)',border:'1px solid rgba(245,158,11,0.12)',borderRadius:9}}>
                      <div style={{fontSize:13,fontWeight:600,color:'#fde68a',marginBottom:3}}>📌 {a.title}</div>
                      <div style={{fontSize:12,color:'#92400e',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            <div style={{display:'flex',gap:10,marginBottom:18,flexWrap:'wrap',alignItems:'center'}}>
              {[
                {l:'전체',v:catAll.length,c:'#94a3b8',bg:'#111d35',bd:'#1e2e50'},
                {l:'대기',v:waiting,c:'#60a5fa',bg:'#0d1f3c',bd:'rgba(59,130,246,0.25)'},
                {l:'진행',v:inProgress,c:'#4ade80',bg:'#052918',bd:'rgba(34,197,94,0.25)'},
                {l:'완료',v:done,c:'#a5b4fc',bg:'#1a1740',bd:'rgba(129,140,248,0.25)'},
                {l:'검토완료',v:reviewed,c:'#94a3b8',bg:'rgba(148,163,184,0.06)',bd:'rgba(148,163,184,0.2)'},
              ].map(s=>(
                <div key={s.l} style={{background:s.bg,border:`1px solid ${s.bd}`,borderRadius:11,padding:'10px 16px',display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</span>
                  <span style={{fontSize:11,fontWeight:700,color:s.c}}>{s.l}</span>
                </div>
              ))}
              <div style={{flex:1,minWidth:200,background:'#111d35',border:'1px solid #1e2e50',borderRadius:11,padding:'10px 16px'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                  <span style={{fontSize:11,color:'#64748b',fontWeight:600}}>완료율</span>
                  <span style={{fontSize:11,color:'#a5b4fc',fontWeight:700}}>{pct}%</span>
                </div>
                <div style={{background:'#1e2e50',borderRadius:99,height:6}}>
                  <div style={{background:'linear-gradient(90deg,#6366f1,#818cf8)',borderRadius:99,height:6,width:`${pct}%`,transition:'width 0.5s'}}/>
                </div>
              </div>
              {canEdit && (
                <button onClick={()=>setModal('add')} style={{padding:'10px 16px',background:'linear-gradient(135deg,#2563eb,#1d4ed8)',border:'none',borderRadius:9,color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:"'Noto Sans KR',sans-serif",whiteSpace:'nowrap'}}>+ 업무 요청</button>
              )}
            </div>

            {/* Status filter */}
            <div style={{display:'flex',gap:6,marginBottom:8,flexWrap:'wrap',alignItems:'center'}}>
              {['전체','대기','진행','완료','검토완료'].map(s=>{
                const sc = STATUS_STYLE[s]
                const on = filterStatus===s
                return <button key={s} onClick={()=>setFilterStatus(s)} style={{padding:'4px 13px',borderRadius:20,border:`1px solid ${on?(sc?.border||cat?.color+'44'):'#1e2e50'}`,background:on?(sc?.bg||cat?.color+'15'):'transparent',color:on?(sc?.color||cat?.color):'#4a5568',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'Noto Sans KR',sans-serif",transition:'all .12s'}}>{s==='전체'?'전체 상태':`● ${s}`}</button>
              })}
              <div style={{marginLeft:'auto',display:'flex',gap:6,alignItems:'center',background:'#0a1120',border:'1px solid #1e2e50',borderRadius:8,padding:'5px 11px'}}>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="검색..." style={{border:'none',outline:'none',background:'transparent',color:'#e2e8f0',fontSize:12,width:110,fontFamily:"'Noto Sans KR',sans-serif"}}/>
                <span style={{color:'#3d4f6b',fontSize:13}}>🔍</span>
              </div>
            </div>

            {/* Subcategory filter */}
            {hasSub && (
              <div style={{display:'flex',gap:6,marginBottom:22,flexWrap:'wrap'}}>
                <button onClick={()=>setFilterSubCat('전체')} style={{padding:'4px 13px',borderRadius:20,border:`1px solid ${filterSubCat==='전체'?cat?.color+'44':'#1e2e50'}`,background:filterSubCat==='전체'?cat?.color+'15':'transparent',color:filterSubCat==='전체'?cat?.color:'#4a5568',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'Noto Sans KR',sans-serif"}}>전체</button>
                {subCats.map(s=><button key={s} onClick={()=>setFilterSubCat(s)} style={{padding:'4px 11px',borderRadius:20,border:`1px solid ${filterSubCat===s?cat?.color+'44':'#1e2e50'}`,background:filterSubCat===s?cat?.color+'15':'transparent',color:filterSubCat===s?cat?.color:'#4a5568',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:"'Noto Sans KR',sans-serif",transition:'all .12s'}}>{CAT_ICONS[s]||'📌'} {s}</button>)}
              </div>
            )}

            {/* Urgent */}
            {urgentItems.length>0 && (
              <div style={{marginBottom:22}}>
                <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:9,paddingLeft:2}}>
                  <span style={{fontSize:16}}>🚨</span>
                  <span style={{fontSize:14,fontWeight:700,color:'#fca5a5'}}>긴급</span>
                  <span style={{fontSize:11,color:'#64748b',background:'#111d35',border:'1px solid #1e2e50',borderRadius:9,padding:'1px 8px',fontWeight:600}}>{urgentItems.length}건</span>
                </div>
                <SectionCard style={{border:'1px solid rgba(239,68,68,0.3)'}}>
                  {urgentItems.map(item=><ItemRow key={item.id} item={item} user={user} canEdit={canEdit} onStatus={handleStatusChange} onEdit={()=>setModal(item)} onDelete={()=>setConfirmDel(item)} onDetail={()=>navigate('item',{id:item.id})} assigneeName={assigneeName} comments={allComments[item.id]||[]} onDeleteComment={handleDeleteComment}/>)}
                </SectionCard>
              </div>
            )}

            {Object.entries(grouped).length===0&&urgentItems.length===0&&(
              <Empty icon={filterStatus==='검토완료'?'✅':'🔍'} message={filterStatus==='검토완료'?'검토 완료된 항목이 없습니다':'해당하는 항목이 없습니다'}/>
            )}

            {Object.entries(grouped).map(([catName,its])=>(
              <div key={catName} style={{marginBottom:20,animation:'fadein 0.3s ease'}}>
                <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:9,paddingLeft:2}}>
                  <span style={{fontSize:15}}>{CAT_ICONS[catName]||'📌'}</span>
                  <span style={{fontSize:14,fontWeight:700,color:'#cbd5e1'}}>{catName}</span>
                  <span style={{fontSize:11,color:'#64748b',background:'#111d35',border:'1px solid #1e2e50',borderRadius:9,padding:'1px 8px',fontWeight:600}}>{its.length}건</span>
                </div>
                <SectionCard>
                  {its.map(item=><ItemRow key={item.id} item={item} user={user} canEdit={canEdit} onStatus={handleStatusChange} onEdit={()=>setModal(item)} onDelete={()=>setConfirmDel(item)} onDetail={()=>navigate('item',{id:item.id})} assigneeName={assigneeName} comments={allComments[item.id]||[]} onDeleteComment={handleDeleteComment}/>)}
                </SectionCard>
              </div>
            ))}
          </>
        )}
      </div>

      {modal&&<Modal onClose={()=>setModal(null)}><ItemForm initial={modal==='add'?null:modal} onSave={handleSave} onClose={()=>setModal(null)}/></Modal>}
      {confirmDel&&<ConfirmDialog message={`"${confirmDel.desc.slice(0,30)}..." 항목을 삭제할까요?`} onConfirm={()=>handleDelete(confirmDel)} onCancel={()=>setConfirmDel(null)}/>}
      <Toast message={toast} onClose={()=>setToast('')}/>
    </div>
  )
}
