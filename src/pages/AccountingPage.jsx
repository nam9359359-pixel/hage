import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { db } from '../firebase.js'
import { collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { logActivity } from '../utils.js'
import Header from '../components/Header.jsx'
import { Toast, Modal } from '../components/UI.jsx'

const fmt = n => '₩' + Math.round(n).toLocaleString('ko-KR')
const DEFAULT_INC_CATS = ['매출','용역수입','이자수입','기타수입']
const DEFAULT_EXP_CATS = ['식비/접대','교통','인건비','마케팅','장비/소모품','임대료','통신비','세금/공과금','기타']
const SUB_CATS = ['업무도구','마케팅','인프라','디자인','커뮤니케이션','보안','기타']
const CAT_COLORS = {'매출':'#1D9E75','용역수입':'#5DCAA5','이자수입':'#9FE1CB','기타수입':'#085041','식비/접대':'#D85A30','교통':'#378ADD','인건비':'#7F77DD','마케팅':'#D4537E','장비/소모품':'#BA7517','임대료':'#E24B4A','통신비':'#639922','세금/공과금':'#888780','기타':'#B4B2A9','구독 서비스':'#534AB7','업무도구':'#378ADD','인프라':'#639922','디자인':'#D4537E','커뮤니케이션':'#1D9E75','보안':'#7F77DD'}
const COLOR_POOL = ['#1D9E75','#378ADD','#7F77DD','#D4537E','#BA7517','#E24B4A','#639922','#D85A30','#534AB7','#5DCAA5']

const calcVAT = (amount, tax) => {
  if (tax === 'taxable') return Math.round(amount * 0.1)
  if (tax === 'inclusive') return Math.round(amount - amount / 1.1)
  return 0
}
const supplyAmt = (amount, tax) => tax === 'inclusive' ? Math.round(amount / 1.1) : amount
const TAX_LABELS = { taxable:'과세', exempt:'면세', inclusive:'부가세포함' }
const TAX_COLORS = { taxable:{ bg:'rgba(59,130,246,0.15)', color:'#93c5fd' }, exempt:{ bg:'rgba(255,255,255,0.06)', color:'#64748b' }, inclusive:{ bg:'rgba(167,139,250,0.15)', color:'#a78bfa' } }

const iS = { width:'100%', padding:'9px 11px', background:'#0a1120', border:'1px solid #1e2e50', borderRadius:8, color:'#e2e8f0', fontSize:13, outline:'none', fontFamily:"'Noto Sans KR',sans-serif" }
const lbl = { fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }
const cardS = { background:'#111d35', border:'1px solid #1e2e50', borderRadius:14, padding:'16px 18px', marginBottom:16 }

function StatCard({ label, value, color, sub }) {
  return (
    <div style={{ background:'#111d35', border:'1px solid #1e2e50', borderRadius:11, padding:'12px 16px' }}>
      <div style={{ fontSize:11, fontWeight:600, color:'#64748b', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:19, fontWeight:700, color:color||'#e2e8f0' }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'#475569', marginTop:3 }}>{sub}</div>}
    </div>
  )
}

function BarBg({ pct, color }) {
  return (
    <div style={{ background:'#1e2e50', borderRadius:99, height:7, margin:'6px 0 5px' }}>
      <div style={{ height:7, borderRadius:99, width:`${Math.min(pct,100)}%`, background:color||'#1D9E75', transition:'width 0.4s' }} />
    </div>
  )
}

function CatBar({ items }) {
  const total = items.reduce((s,i)=>s+(i.amount||0),0)
  if (!total) return <div style={{ fontSize:12, color:'#475569', textAlign:'center', padding:'16px 0' }}>내역 없음</div>
  return items.sort((a,b)=>(b.amount||0)-(a.amount||0)).map((item,i)=>{
    const pct = Math.round((item.amount||0)/total*100)
    const color = CAT_COLORS[item.cat||item.name] || COLOR_POOL[i%COLOR_POOL.length]
    return (
      <div key={i} style={{ marginBottom:8 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
          <span style={{ fontSize:12, color:'#94a3b8' }}>{item.cat||item.name}</span>
          <div style={{ display:'flex', gap:8 }}>
            <span style={{ fontSize:12, fontWeight:600, color:'#e2e8f0' }}>{fmt(item.amount||0)}</span>
            <span style={{ fontSize:11, color:'#475569', minWidth:28, textAlign:'right' }}>{pct}%</span>
          </div>
        </div>
        <div style={{ background:'#1e2e50', borderRadius:99, height:5 }}>
          <div style={{ height:5, borderRadius:99, width:`${pct}%`, background:color }} />
        </div>
      </div>
    )
  })
}

function MiniChart({ months, revData, expData }) {
  const max = Math.max(...revData, ...expData, 1)
  return (
    <div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:100 }}>
        {months.map((m,i) => (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
            <div style={{ width:'100%', display:'flex', gap:1, alignItems:'flex-end' }}>
              <div style={{ flex:1, background:'#1D9E75', borderRadius:'2px 2px 0 0', height:`${Math.round(revData[i]/max*88)}px`, minHeight:2 }} />
              <div style={{ flex:1, background:'#D85A30', borderRadius:'2px 2px 0 0', height:`${Math.round(expData[i]/max*88)}px`, minHeight:2 }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:4, marginTop:4 }}>
        {months.map((m,i) => <div key={i} style={{ flex:1, textAlign:'center', fontSize:10, color:'#475569' }}>{m}</div>)}
      </div>
    </div>
  )
}

// 갱신일까지 남은 일수
function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(dateStr); target.setHours(0,0,0,0)
  return Math.round((target - today) / (1000*60*60*24))
}

function RenewalBadge({ dateStr }) {
  if (!dateStr) return null
  const days = daysUntil(dateStr)
  if (days === null) return null
  const color = days < 0 ? '#f87171' : days <= 7 ? '#fbbf24' : days <= 30 ? '#93c5fd' : '#475569'
  const bg = days < 0 ? 'rgba(239,68,68,0.1)' : days <= 7 ? 'rgba(251,191,36,0.1)' : days <= 30 ? 'rgba(59,130,246,0.08)' : 'transparent'
  const label = days < 0 ? `${Math.abs(days)}일 초과` : days === 0 ? '오늘 갱신' : `${days}일 후 갱신`
  return <span style={{ fontSize:10, padding:'1px 7px', borderRadius:99, background:bg, color, border:`1px solid ${color}44`, flexShrink:0 }}>{label}</span>
}

function EntryForm({ initial, incCats, expCats, onSave, onClose }) {
  const [type, setType] = useState(initial?.type || 'expense')
  const [form, setForm] = useState({
    date: initial?.date || new Date().toISOString().slice(0,10),
    cat: initial?.cat || '',
    client: initial?.client || '',
    tax: initial?.tax || 'taxable',
    amount: initial?.amount?.toString() || '',
    biz: initial?.biz || 'biz',
    memo: initial?.memo || '',
    isSubscription: initial?.isSubscription || false,
    subPeriod: initial?.subPeriod || 'monthly',
  })
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const curCats = type === 'income' ? incCats : expCats
  const amt = parseFloat(form.amount) || 0
  const vat = calcVAT(amt, form.tax)
  const supply = supplyAmt(amt, form.tax)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
        <h3 style={{ fontSize:16, fontWeight:700, color:'#f1f5f9' }}>{initial?.id ? '✏️ 내역 수정' : '➕ 내역 추가'}</h3>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'#64748b', fontSize:20, cursor:'pointer' }}>✕</button>
      </div>
      <div style={{ display:'flex', background:'#0a1120', border:'1px solid #1e2e50', borderRadius:9, padding:3 }}>
        {[['expense','지출'],['income','수입']].map(([t,l])=>(
          <button key={t} onClick={()=>setType(t)} style={{ flex:1, padding:'8px', border:'none', borderRadius:7, background:type===t?(t==='expense'?'rgba(239,68,68,0.2)':'rgba(34,197,94,0.2)'):'transparent', color:type===t?(t==='expense'?'#f87171':'#4ade80'):'#64748b', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>{l}</button>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div><label style={lbl}>날짜</label><input type="date" value={form.date} onChange={e=>set('date',e.target.value)} style={iS}/></div>
        <div><label style={lbl}>카테고리</label>
          <select value={form.cat} onChange={e=>set('cat',e.target.value)} style={iS}>
            <option value="">선택</option>
            {curCats.map(c=><option key={c} value={c} style={{background:'#111d35'}}>{c}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div><label style={lbl}>거래처 (선택)</label><input value={form.client} onChange={e=>set('client',e.target.value)} placeholder="예: (주)ABC" style={iS}/></div>
        <div><label style={lbl}>과세 여부</label>
          <select value={form.tax} onChange={e=>set('tax',e.target.value)} style={iS}>
            <option value="taxable" style={{background:'#111d35'}}>과세 (공급가액 기준)</option>
            <option value="exempt" style={{background:'#111d35'}}>면세</option>
            <option value="inclusive" style={{background:'#111d35'}}>부가세포함 (총액 기준)</option>
          </select>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div><label style={lbl}>금액 (원)</label><input type="number" value={form.amount} onChange={e=>set('amount',e.target.value)} placeholder="0" style={iS}/></div>
        <div><label style={lbl}>업무 구분</label>
          <select value={form.biz} onChange={e=>set('biz',e.target.value)} style={iS}>
            <option value="biz" style={{background:'#111d35'}}>업무용</option>
            <option value="personal" style={{background:'#111d35'}}>개인용</option>
          </select>
        </div>
      </div>
      <div><label style={lbl}>메모</label><input value={form.memo} onChange={e=>set('memo',e.target.value)} placeholder="선택 사항" style={iS}/></div>

      {/* 구독 여부 */}
      <div style={{ padding:'12px 14px', background:'rgba(83,74,183,0.08)', border:'1px solid rgba(83,74,183,0.2)', borderRadius:9 }}>
        <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', marginBottom: form.isSubscription ? 10 : 0 }}>
          <input type="checkbox" checked={form.isSubscription} onChange={e=>set('isSubscription',e.target.checked)} style={{ width:15, height:15, accentColor:'#7c3aed' }}/>
          <span style={{ fontSize:13, fontWeight:600, color:'#a78bfa' }}>구독 서비스</span>
          <span style={{ fontSize:11, color:'#64748b' }}>체크 시 구독 현황에 표시됩니다</span>
        </label>
        {form.isSubscription && (
          <div style={{ display:'flex', gap:8 }}>
            {[['monthly','월 구독'],['yearly','연 구독']].map(([v,l])=>(
              <button key={v} onClick={()=>set('subPeriod',v)} style={{ flex:1, padding:'7px', border:`1px solid ${form.subPeriod===v?'rgba(124,58,237,0.5)':'#1e2e50'}`, borderRadius:8, background:form.subPeriod===v?'rgba(124,58,237,0.2)':'transparent', color:form.subPeriod===v?'#a78bfa':'#64748b', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>{l}</button>
            ))}
          </div>
        )}
      </div>

      {amt > 0 && form.tax !== 'exempt' && (
        <div style={{ background:'#0a1120', borderRadius:8, padding:'10px 12px', fontSize:12, color:'#64748b', lineHeight:1.8 }}>
          {form.tax === 'taxable' && <>공급가액 <span style={{ color:'#e2e8f0' }}>{fmt(amt)}</span> + 부가세 <span style={{ color:'#a78bfa' }}>{fmt(vat)}</span> = 합계 <span style={{ color:'#4ade80' }}>{fmt(amt+vat)}</span></>}
          {form.tax === 'inclusive' && <>총액 <span style={{ color:'#e2e8f0' }}>{fmt(amt)}</span> → 공급가액 <span style={{ color:'#93c5fd' }}>{fmt(supply)}</span> + 부가세 <span style={{ color:'#a78bfa' }}>{fmt(vat)}</span></>}
        </div>
      )}
      <div style={{ display:'flex', gap:10, marginTop:4 }}>
        <button onClick={onClose} style={{ flex:1, padding:11, border:'1px solid #334155', borderRadius:9, background:'transparent', color:'#94a3b8', fontWeight:600, fontSize:14, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>취소</button>
        <button onClick={()=>onSave({ ...form, type, amount:parseFloat(form.amount)||0 })} style={{ flex:2, padding:11, border:'none', borderRadius:9, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>저장하기</button>
      </div>
    </div>
  )
}

// 구독 추가 폼
function SubForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    amount: initial?.amount?.toString() || '',
    period: initial?.period || 'monthly',
    subCat: initial?.subCat || '업무도구',
    renewalDate: initial?.renewalDate || '',
    active: initial?.active !== false,
    memo: initial?.memo || '',
  })
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const amt = parseFloat(form.amount)||0
  const monthly = form.period==='monthly' ? amt : Math.round(amt/12)
  const yearly = form.period==='yearly' ? amt : amt*12

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
        <h3 style={{ fontSize:16, fontWeight:700, color:'#f1f5f9' }}>{initial?.id ? '✏️ 구독 수정' : '➕ 구독 추가'}</h3>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'#64748b', fontSize:20, cursor:'pointer' }}>✕</button>
      </div>
      {/* Period toggle */}
      <div style={{ display:'flex', background:'#0a1120', border:'1px solid #1e2e50', borderRadius:9, padding:3 }}>
        {[['monthly','월 구독'],['yearly','연 구독']].map(([v,l])=>(
          <button key={v} onClick={()=>set('period',v)} style={{ flex:1, padding:'8px', border:'none', borderRadius:7, background:form.period===v?'rgba(124,58,237,0.25)':'transparent', color:form.period===v?'#a78bfa':'#64748b', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>{l}</button>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div><label style={lbl}>서비스명 *</label><input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="예: Google Workspace" style={iS}/></div>
        <div><label style={lbl}>금액 (원) *</label><input type="number" value={form.amount} onChange={e=>set('amount',e.target.value)} placeholder={form.period==='monthly'?'월 금액':'연 금액'} style={iS}/></div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div><label style={lbl}>카테고리</label>
          <select value={form.subCat} onChange={e=>set('subCat',e.target.value)} style={iS}>
            {SUB_CATS.map(c=><option key={c} value={c} style={{background:'#111d35'}}>{c}</option>)}
          </select>
        </div>
        <div><label style={lbl}>다음 갱신일</label><input type="date" value={form.renewalDate} onChange={e=>set('renewalDate',e.target.value)} style={iS}/></div>
      </div>
      <div><label style={lbl}>메모 (선택)</label><input value={form.memo} onChange={e=>set('memo',e.target.value)} placeholder="추가 메모" style={iS}/></div>
      <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, color:'#e2e8f0' }}>
        <input type="checkbox" checked={form.active} onChange={e=>set('active',e.target.checked)} style={{ width:15, height:15, accentColor:'#1D9E75' }}/>
        <span>활성 구독 (해지 시 체크 해제)</span>
      </label>
      {amt > 0 && (
        <div style={{ background:'#0a1120', borderRadius:8, padding:'10px 12px', fontSize:12, color:'#64748b', lineHeight:2 }}>
          <div>월 환산 비용: <span style={{ color:'#a78bfa', fontWeight:600 }}>{fmt(monthly)}/월</span></div>
          <div>연간 총 비용: <span style={{ color:'#a78bfa', fontWeight:600 }}>{fmt(yearly)}/년</span></div>
        </div>
      )}
      <div style={{ display:'flex', gap:10, marginTop:4 }}>
        <button onClick={onClose} style={{ flex:1, padding:11, border:'1px solid #334155', borderRadius:9, background:'transparent', color:'#94a3b8', fontWeight:600, fontSize:14, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>취소</button>
        <button onClick={()=>onSave({ ...form, amount:parseFloat(form.amount)||0 })} style={{ flex:2, padding:11, border:'none', borderRadius:9, background:'linear-gradient(135deg,#7c3aed,#6d28d9)', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>저장하기</button>
      </div>
    </div>
  )
}

export default function AccountingPage({ user, navigate, onLogout, currentPage }) {
  const [tab, setTab] = useState('dashboard')
  const [entries, setEntries] = useState([])
  const [fixedCosts, setFixedCosts] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [incCats, setIncCats] = useState(DEFAULT_INC_CATS)
  const [expCats, setExpCats] = useState(DEFAULT_EXP_CATS)
  const [budget, setBudgetState] = useState(0)
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState(null)
  const [subModal, setSubModal] = useState(null)
  const [filterType, setFilterType] = useState('all')
  const [filterBiz, setFilterBiz] = useState('all')
  const [budgetInput, setBudgetInput] = useState('')
  const [newCat, setNewCat] = useState({ income:'', expense:'' })
  const [editCat, setEditCat] = useState(null)
  const [fxForm, setFxForm] = useState({ name:'', amount:'', cat:'' })
  const [calSelected, setCalSelected] = useState(null)
  const [subFilter, setSubFilter] = useState('all') // all | monthly | yearly | inactive
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),2500) }

  const now = new Date()
  const [viewMonth, setViewMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`)
  const [viewY, viewM] = viewMonth.split('-').map(Number)

  useEffect(() => {
    const u1 = onSnapshot(collection(db,'accounting_entries'), snap => {
      setEntries(snap.docs.map(d=>({...d.data(),id:d.id})).sort((a,b)=>b.date?.localeCompare(a.date)))
    })
    const u2 = onSnapshot(collection(db,'accounting_fixed'), snap => {
      setFixedCosts(snap.docs.map(d=>({...d.data(),id:d.id})))
    })
    const u3 = onSnapshot(collection(db,'accounting_subscriptions'), snap => {
      setSubscriptions(snap.docs.map(d=>({...d.data(),id:d.id})))
    })
    const u4 = onSnapshot(doc(db,'accounting_settings','main'), snap => {
      if (snap.exists()) {
        const d = snap.data()
        if (d.incCats) setIncCats(d.incCats)
        if (d.expCats) setExpCats(d.expCats)
        if (d.budget !== undefined) setBudgetState(d.budget)
      }
    })
    return () => { u1(); u2(); u3(); u4() }
  }, [])

  const saveSettings = async (updates) => {
    await setDoc(doc(db,'accounting_settings','main'), updates, { merge:true })
  }

  // Subscription calculations
  const activeSubs = subscriptions.filter(s=>s.active!==false)
  const monthlySubs = activeSubs.filter(s=>s.period==='monthly')
  const yearlySubs = activeSubs.filter(s=>s.period==='yearly')
  const monthlyTotal = monthlySubs.reduce((s,sub)=>s+sub.amount,0)
  const yearlyTotal = yearlySubs.reduce((s,sub)=>s+sub.amount,0)
  const annualTotal = monthlyTotal*12 + yearlyTotal
  const monthlyEquivalent = monthlyTotal + Math.round(yearlyTotal/12)

  // Main calculations
  const monthEntries = entries.filter(e => e.date?.startsWith(viewMonth))
  const revenue = monthEntries.filter(e=>e.type==='income').reduce((s,e)=>s+e.amount,0)
  const varExp = monthEntries.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amount,0)
  const fixedTotal = fixedCosts.reduce((s,f)=>s+f.amount,0)
  const totalExp = varExp + fixedTotal
  const profit = revenue - totalExp
  const vatPay = Math.max(
    monthEntries.filter(e=>e.type==='income'&&e.tax!=='exempt').reduce((s,e)=>s+calcVAT(e.amount,e.tax),0) -
    monthEntries.filter(e=>e.type==='expense'&&e.tax!=='exempt').reduce((s,e)=>s+calcVAT(e.amount,e.tax),0), 0
  )
  const budgetPct = budget ? Math.min(Math.round(totalExp/budget*100),100) : 0

  const months6 = Array.from({length:6},(_,i)=>{
    const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1)
    return { y:d.getFullYear(), m:d.getMonth(), label:(d.getMonth()+1)+'월' }
  })
  const revData = months6.map(({y,m})=>entries.filter(e=>{const d=new Date(e.date);return d.getFullYear()===y&&d.getMonth()===m&&e.type==='income'}).reduce((s,e)=>s+e.amount,0))
  const expData = months6.map(({y,m})=>entries.filter(e=>{const d=new Date(e.date);return d.getFullYear()===y&&d.getMonth()===m&&e.type==='expense'}).reduce((s,e)=>s+e.amount,0)+fixedTotal)

  const expCatTotals = {}
  monthEntries.filter(e=>e.type==='expense').forEach(e=>{ expCatTotals[e.cat]=(expCatTotals[e.cat]||0)+e.amount })
  fixedCosts.forEach(f=>{ expCatTotals[f.cat]=(expCatTotals[f.cat]||0)+f.amount })
  const catChartData = Object.entries(expCatTotals).map(([cat,amount])=>({ cat, amount }))

  const saveEntry = async (form, existingId) => {
    const id = existingId || `entry_${Date.now()}`
    await setDoc(doc(db,'accounting_entries',id), { ...form, createdAt:serverTimestamp(), createdBy:user.id }, { merge:true })
    await logActivity({ userId:user.id, userName:user.name, action:existingId?'가계부 수정':'가계부 추가', itemDesc:form.memo||form.cat })
    showToast(existingId ? '✅ 수정되었습니다' : '✅ 추가되었습니다')
    setModal(null)
  }
  const delEntry = async id => { await deleteDoc(doc(db,'accounting_entries',id)); showToast('🗑️ 삭제되었습니다') }

  const saveSub = async (form, existingId) => {
    const id = existingId || `sub_${Date.now()}`
    await setDoc(doc(db,'accounting_subscriptions',id), { ...form, updatedAt:serverTimestamp() }, { merge:true })
    showToast(existingId ? '✅ 구독이 수정되었습니다' : '✅ 구독이 추가되었습니다')
    setSubModal(null)
  }
  const delSub = async id => { await deleteDoc(doc(db,'accounting_subscriptions',id)); showToast('🗑️ 구독이 삭제되었습니다') }
  const toggleSubActive = async (sub) => {
    await updateDoc(doc(db,'accounting_subscriptions',sub.id), { active: !sub.active })
    showToast(sub.active ? '구독이 비활성화되었습니다' : '구독이 활성화되었습니다')
  }

  const addFixed = async () => {
    if (!fxForm.name || !fxForm.amount) { showToast('항목명과 금액을 입력해주세요'); return }
    await setDoc(doc(db,'accounting_fixed',`fixed_${Date.now()}`), { ...fxForm, amount:parseFloat(fxForm.amount) })
    setFxForm({ name:'', amount:'', cat:expCats[0]||'' }); showToast('✅ 고정비가 추가되었습니다')
  }
  const delFixed = async id => { await deleteDoc(doc(db,'accounting_fixed',id)); showToast('🗑️ 삭제되었습니다') }

  const handleSetBudget = async () => {
    const v = parseFloat(budgetInput)||0
    setBudgetState(v); await saveSettings({ budget:v }); setBudgetInput('')
    showToast('✅ 예산이 설정되었습니다')
  }

  const addCat = async (type) => {
    const name = newCat[type].trim(); if (!name) return
    const updated = type==='income' ? [...incCats,name] : [...expCats,name]
    type==='income' ? setIncCats(updated) : setExpCats(updated)
    await saveSettings(type==='income'?{incCats:updated}:{expCats:updated})
    setNewCat(n=>({...n,[type]:''})); showToast('✅ 추가되었습니다')
  }
  const delCat = async (type,cat) => {
    const updated = type==='income' ? incCats.filter(c=>c!==cat) : expCats.filter(c=>c!==cat)
    type==='income' ? setIncCats(updated) : setExpCats(updated)
    await saveSettings(type==='income'?{incCats:updated}:{expCats:updated})
    showToast('🗑️ 삭제되었습니다')
  }
  const updateCat = async (type,oldCat,newName) => {
    const updated = type==='income' ? incCats.map(c=>c===oldCat?newName:c) : expCats.map(c=>c===oldCat?newName:c)
    type==='income' ? setIncCats(updated) : setExpCats(updated)
    await saveSettings(type==='income'?{incCats:updated}:{expCats:updated})
    setEditCat(null); showToast('✅ 수정되었습니다')
  }

  const navMonth = d => {
    const [y,m] = viewMonth.split('-').map(Number)
    const nd = new Date(y, m-1+d, 1)
    setViewMonth(`${nd.getFullYear()}-${String(nd.getMonth()+1).padStart(2,'0')}`)
    setCalSelected(null)
  }

  const exportExcel = () => {
    const wb = XLSX.utils.book_new()
    const ws1 = XLSX.utils.aoa_to_sheet([
      ['날짜','구분','카테고리','거래처','금액','공급가액','부가세','업무구분','구독여부','구독주기','메모'],
      ...monthEntries.map(e=>[e.date,e.type==='income'?'수입':'지출',e.cat,e.client||'',e.amount,supplyAmt(e.amount,e.tax),calcVAT(e.amount,e.tax),e.biz==='biz'?'업무용':'개인용',e.isSubscription?'구독':'일반',e.subPeriod||'',e.memo||'']),
      ...fixedCosts.map(f=>['-','지출(고정)',f.cat,'',f.amount,f.amount,0,'업무용','','',f.name])
    ])
    ws1['!cols'] = [12,8,12,12,14,14,12,8,8,8,16].map(w=>({wch:w}))
    XLSX.utils.book_append_sheet(wb, ws1, '거래내역')
    const ws2 = XLSX.utils.aoa_to_sheet([
      ['항목','금액'],['총 매출',revenue],['총 지출',totalExp],['순이익',profit],['납부 부가세',Math.round(vatPay)],['예산',budget||'-'],['예산 소진율',budget?budgetPct+'%':'-'],['',''],
      ['구독 현황',''],['월 구독 합계',monthlyTotal],['연 구독 합계',yearlyTotal],['연간 구독 총액',annualTotal],['월 예상 구독 고정 지출',monthlyEquivalent],
    ])
    ws2['!cols'] = [{wch:20},{wch:16}]
    XLSX.utils.book_append_sheet(wb, ws2, '요약')
    const ws3 = XLSX.utils.aoa_to_sheet([
      ['서비스명','구독 주기','금액','월 환산','카테고리','갱신일','상태'],
      ...subscriptions.map(s=>[s.name,s.period==='monthly'?'월 구독':'연 구독',s.amount,s.period==='monthly'?s.amount:Math.round(s.amount/12),s.subCat||'',s.renewalDate||'',s.active!==false?'활성':'비활성'])
    ])
    ws3['!cols'] = [{wch:20},{wch:10},{wch:14},{wch:14},{wch:12},{wch:12},{wch:8}]
    XLSX.utils.book_append_sheet(wb, ws3, '구독 현황')
    XLSX.writeFile(wb, `가계부_${viewMonth}.xlsx`)
    showToast('📥 엑셀 파일이 다운로드되었습니다')
  }

  const filtered = monthEntries.filter(e => {
    if (filterType!=='all'&&e.type!==filterType) return false
    if (filterBiz!=='all'&&e.biz!==filterBiz) return false
    return true
  })

  // Calendar
  const firstDay = new Date(viewY, viewM-1, 1).getDay()
  const daysInMonth = new Date(viewY, viewM, 0).getDate()
  const calCells = []
  for (let i=0;i<firstDay;i++) calCells.push(null)
  for (let d=1;d<=daysInMonth;d++) calCells.push(d)
  while (calCells.length%7!==0) calCells.push(null)
  const getDateStr = day => `${viewY}-${String(viewM).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  const getDayEntries = day => entries.filter(e=>e.date===getDateStr(day))
  const isToday = day => day && viewY===now.getFullYear() && viewM-1===now.getMonth() && day===now.getDate()
  const calSelEntries = calSelected ? entries.filter(e=>e.date===calSelected) : []

  // Upcoming renewals (next 30 days)
  const upcomingRenewals = subscriptions.filter(s=>s.active!==false&&s.renewalDate).map(s=>({...s,days:daysUntil(s.renewalDate)})).filter(s=>s.days!==null&&s.days<=30).sort((a,b)=>a.days-b.days)

  const filteredSubs = subscriptions.filter(s=>{
    if (subFilter==='monthly') return s.period==='monthly'&&s.active!==false
    if (subFilter==='yearly') return s.period==='yearly'&&s.active!==false
    if (subFilter==='inactive') return s.active===false
    return true
  })

  const TABS = [{id:'dashboard',label:'대시보드'},{id:'calendar',label:'달력 뷰'},{id:'ledger',label:'수입/지출'},{id:'subscription',label:'구독 관리'},{id:'vat',label:'부가세'},{id:'fixed',label:'고정비'},{id:'categories',label:'카테고리'}]

  // Sub category breakdown
  const subCatBreakdown = {}
  activeSubs.forEach(s=>{ const mo = s.period==='monthly'?s.amount:Math.round(s.amount/12); subCatBreakdown[s.subCat||'기타']=(subCatBreakdown[s.subCat||'기타']||0)+mo })

  return (
    <div style={{ minHeight:'100vh', background:'#0d1526', fontFamily:"'Noto Sans KR',sans-serif", color:'#e2e8f0' }}>
      <Header user={user} navigate={navigate} onLogout={onLogout} currentPage={currentPage}/>
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'24px 20px' }}>

        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24, flexWrap:'wrap' }}>
          <button onClick={()=>navigate('main')} style={{ padding:'6px 12px', background:'rgba(255,255,255,0.05)', border:'1px solid #1e2e50', borderRadius:8, color:'#94a3b8', fontSize:13, cursor:'pointer' }}>← 뒤로</button>
          <h1 style={{ fontSize:18, fontWeight:700, color:'#f1f5f9' }}>💰 사업자 가계부</h1>
          <div style={{ flex:1 }}/>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={()=>navMonth(-1)} style={{ padding:'5px 10px', background:'#111d35', border:'1px solid #1e2e50', borderRadius:7, color:'#94a3b8', cursor:'pointer', fontSize:14 }}>‹</button>
            <span style={{ fontSize:14, fontWeight:600, color:'#e2e8f0', minWidth:90, textAlign:'center' }}>{viewMonth.replace('-','년 ')}월</span>
            <button onClick={()=>navMonth(1)} style={{ padding:'5px 10px', background:'#111d35', border:'1px solid #1e2e50', borderRadius:7, color:'#94a3b8', cursor:'pointer', fontSize:14 }}>›</button>
          </div>
          <button onClick={exportExcel} style={{ padding:'8px 16px', background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:8, color:'#4ade80', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>📥 엑셀 다운로드</button>
        </div>

        <div style={{ display:'flex', borderBottom:'1px solid #1e2e50', marginBottom:24, overflowX:'auto' }}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:'10px 18px', border:'none', background:'transparent', fontSize:13, fontWeight:600, cursor:'pointer', color:tab===t.id?'#93c5fd':'#4a5568', borderBottom:`2px solid ${tab===t.id?'#3b82f6':'transparent'}`, marginBottom:-1, whiteSpace:'nowrap', fontFamily:"'Noto Sans KR',sans-serif" }}>{t.label}</button>
          ))}
        </div>

        {/* ── DASHBOARD ── */}
        {tab==='dashboard' && <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:10, marginBottom:18 }}>
            <StatCard label="이번달 매출" value={fmt(revenue)} color="#4ade80"/>
            <StatCard label="이번달 지출" value={fmt(totalExp)} color="#f87171"/>
            <StatCard label="순이익" value={fmt(Math.abs(profit))} color={profit>=0?'#4ade80':'#f87171'}/>
            <StatCard label="납부 부가세" value={fmt(Math.round(vatPay))} color="#60a5fa"/>
          </div>

          {/* 구독 요약 카드 */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:10, marginBottom:18 }}>
            <StatCard label="월 구독 합계" value={fmt(monthlyTotal)} color="#a78bfa" sub={`${monthlySubs.length}개 서비스`}/>
            <StatCard label="연 구독 합계" value={fmt(yearlyTotal)} color="#a78bfa" sub={`${yearlySubs.length}개 서비스`}/>
            <StatCard label="월 예상 구독 고정 지출" value={fmt(monthlyEquivalent)} color="#c084fc" sub="월구독 + 연구독÷12"/>
          </div>

          <div style={cardS}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <span style={{ fontSize:13, fontWeight:600, color:'#cbd5e1' }}>월 예산 현황</span>
              <span style={{ fontSize:12, color:budget&&totalExp>budget?'#f87171':'#64748b' }}>{budget?`${fmt(totalExp)} / ${fmt(budget)}`:'예산 미설정'}</span>
            </div>
            <BarBg pct={budgetPct} color={budgetPct>=90?'#ef4444':budgetPct>=70?'#f59e0b':'#1D9E75'}/>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
              <span style={{ fontSize:11, color:budget&&totalExp>budget?'#f87171':'#475569' }}>{budget?(totalExp>budget?`초과 ${fmt(totalExp-budget)}`:`잔여 ${fmt(budget-totalExp)}`):'예산을 설정해주세요'}</span>
              {budget>0&&<span style={{ fontSize:11, color:'#475569' }}>{budgetPct}%</span>}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <input value={budgetInput} onChange={e=>setBudgetInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSetBudget()} placeholder="월 예산 입력 (원)" type="number" style={{ ...iS, flex:1 }}/>
              <button onClick={handleSetBudget} style={{ padding:'9px 16px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:8, color:'#fff', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>설정</button>
              {budget>0&&<button onClick={async()=>{setBudgetState(0);await saveSettings({budget:0})}} style={{ padding:'9px 12px', background:'transparent', border:'1px solid #1e2e50', borderRadius:8, color:'#64748b', fontSize:13, cursor:'pointer' }}>초기화</button>}
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div style={cardS}><div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>카테고리별 지출</div><CatBar items={catChartData}/></div>
            <div style={cardS}>
              <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:8 }}>월별 손익 추이</div>
              <div style={{ display:'flex', gap:12, fontSize:11, marginBottom:10 }}>
                <span style={{ display:'flex', alignItems:'center', gap:4, color:'#475569' }}><span style={{ width:8, height:8, borderRadius:1, background:'#1D9E75', display:'inline-block' }}/> 매출</span>
                <span style={{ display:'flex', alignItems:'center', gap:4, color:'#475569' }}><span style={{ width:8, height:8, borderRadius:1, background:'#D85A30', display:'inline-block' }}/> 지출</span>
              </div>
              <MiniChart months={months6.map(m=>m.label)} revData={revData} expData={expData}/>
            </div>
          </div>
        </>}

        {/* ── CALENDAR ── */}
        {tab==='calendar' && <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:10, marginBottom:18 }}>
            <StatCard label="이달 총 수입" value={fmt(revenue)} color="#4ade80"/>
            <StatCard label="이달 총 지출" value={fmt(totalExp)} color="#f87171"/>
            <StatCard label="순이익" value={fmt(Math.abs(profit))} color={profit>=0?'#4ade80':'#f87171'}/>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
            <button onClick={()=>setModal('add')} style={{ padding:'8px 18px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:8, color:'#fff', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>+ 내역 추가</button>
          </div>
          <div style={{ background:'#111d35', border:'1px solid #1e2e50', borderRadius:14, overflow:'hidden', marginBottom:16 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,minmax(0,1fr))', borderBottom:'1px solid #1e2e50', background:'#0d1526' }}>
              {['일','월','화','수','목','금','토'].map((w,i)=>(
                <div key={w} style={{ padding:'10px 0', textAlign:'center', fontSize:12, fontWeight:600, color:i===0?'#f87171':i===6?'#60a5fa':'#64748b', borderRight:i<6?'1px solid #1e2e50':'none' }}>{w}</div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,minmax(0,1fr))' }}>
              {calCells.map((day,idx)=>{
                if (!day) return <div key={idx} style={{ minHeight:90, background:'rgba(0,0,0,0.15)', borderRight:(idx%7)<6?'1px solid #192640':'none', borderBottom:Math.floor(idx/7)<Math.floor((calCells.length-1)/7)?'1px solid #192640':'none' }}/>
                const dateStr = getDateStr(day)
                const dayE = getDayEntries(day)
                const dayInc = dayE.filter(e=>e.type==='income').reduce((s,e)=>s+e.amount,0)
                const dayExp = dayE.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amount,0)
                const today = isToday(day)
                const sel = calSelected===dateStr
                const col = idx%7
                return (
                  <div key={idx} onClick={()=>setCalSelected(sel?null:dateStr)}
                    style={{ minHeight:90, padding:6, borderRight:col<6?'1px solid #192640':'none', borderBottom:Math.floor(idx/7)<Math.floor((calCells.length-1)/7)?'1px solid #192640':'none', background:sel?'rgba(59,130,246,0.08)':today?'rgba(59,130,246,0.05)':'transparent', cursor:'pointer', outline:sel?'2px solid rgba(59,130,246,0.4)':'none', outlineOffset:-2 }}
                    onMouseEnter={e=>{if(!sel)e.currentTarget.style.background='rgba(255,255,255,0.02)'}}
                    onMouseLeave={e=>{e.currentTarget.style.background=sel?'rgba(59,130,246,0.08)':today?'rgba(59,130,246,0.05)':'transparent'}}>
                    <div style={{ marginBottom:4 }}>
                      {today
                        ? <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:20, height:20, borderRadius:'50%', background:'#3b82f6', color:'#fff', fontSize:11, fontWeight:700 }}>{day}</span>
                        : <span style={{ fontSize:12, fontWeight:500, color:col===0?'#f87171':col===6?'#60a5fa':'#94a3b8' }}>{day}</span>
                      }
                    </div>
                    {dayE.slice(0,2).map((e,i)=>(
                      <div key={i} style={{ fontSize:10, padding:'1px 5px', borderRadius:3, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', background:e.type==='income'?'rgba(29,158,117,0.15)':'rgba(216,90,48,0.12)', color:e.type==='income'?'#5DCAA5':'#F0997B' }}>{e.memo||e.cat}</div>
                    ))}
                    {dayE.length>2&&<div style={{ fontSize:9, color:'#475569' }}>+{dayE.length-2}개</div>}
                    {dayE.length>0&&(
                      <div style={{ marginTop:4, paddingTop:3, borderTop:'1px solid #192640' }}>
                        {dayInc>0&&<div style={{ fontSize:10, fontWeight:600, color:'#4ade80' }}>+{fmt(dayInc)}</div>}
                        {dayExp>0&&<div style={{ fontSize:10, fontWeight:600, color:'#f87171' }}>-{fmt(dayExp)}</div>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          {calSelected && (
            <div style={cardS}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                <span style={{ fontSize:14, fontWeight:600, color:'#cbd5e1' }}>{parseInt(calSelected.split('-')[2])}일 내역 ({calSelEntries.length}건)</span>
                <button onClick={()=>setModal({ date:calSelected })} style={{ marginLeft:'auto', padding:'6px 14px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:7, color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>+ 이 날 추가</button>
              </div>
              {calSelEntries.length===0
                ? <div style={{ textAlign:'center', padding:'20px 0', color:'#475569', fontSize:13 }}>내역이 없습니다</div>
                : calSelEntries.map((e,idx)=>{
                  const tc = TAX_COLORS[e.tax]||TAX_COLORS.exempt
                  return (
                    <div key={e.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:idx<calSelEntries.length-1?'1px solid #192640':'none' }}>
                      <div style={{ width:7, height:7, borderRadius:'50%', background:e.type==='income'?'#1D9E75':'#D85A30', flexShrink:0 }}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:2 }}>
                          <span style={{ fontSize:11, color:'#64748b' }}>{e.cat}</span>
                          <span style={{ fontSize:10, padding:'1px 6px', borderRadius:99, background:tc.bg, color:tc.color }}>{TAX_LABELS[e.tax]||e.tax}</span>
                          {e.isSubscription && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:99, background:'rgba(124,58,237,0.15)', color:'#a78bfa' }}>구독</span>}
                        </div>
                        <div style={{ fontSize:13, fontWeight:500, color:'#e2e8f0' }}>{e.memo||e.cat}</div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:e.type==='income'?'#4ade80':'#f87171' }}>{e.type==='income'?'+':'-'}{fmt(e.amount)}</div>
                      </div>
                      <div style={{ display:'flex', gap:5 }}>
                        <button onClick={()=>setModal(e)} style={{ padding:'4px 9px', background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:6, color:'#93c5fd', fontSize:11, cursor:'pointer' }}>수정</button>
                        <button onClick={()=>delEntry(e.id)} style={{ padding:'4px 8px', background:'rgba(239,68,68,0.08)', border:'none', borderRadius:6, color:'#f87171', fontSize:11, cursor:'pointer' }}>삭제</button>
                      </div>
                    </div>
                  )
                })
              }
            </div>
          )}
        </>}

        {/* ── LEDGER ── */}
        {tab==='ledger' && <>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}>
            <button onClick={()=>setModal('add')} style={{ padding:'9px 18px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:8, color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>+ 내역 추가</button>
          </div>
          <div style={cardS}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14, flexWrap:'wrap' }}>
              <span style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', flex:1 }}>거래 내역</span>
              {[['all','전체'],['income','수입'],['expense','지출']].map(([v,l])=>(
                <button key={v} onClick={()=>setFilterType(v)} style={{ padding:'4px 10px', borderRadius:20, border:`1px solid ${filterType===v?'#3b82f6':'#1e2e50'}`, background:filterType===v?'rgba(59,130,246,0.15)':'transparent', color:filterType===v?'#93c5fd':'#4a5568', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>{l}</button>
              ))}
              {[['all','전체'],['biz','업무'],['personal','개인']].map(([v,l])=>(
                <button key={v} onClick={()=>setFilterBiz(v)} style={{ padding:'4px 10px', borderRadius:20, border:`1px solid ${filterBiz===v?'#a78bfa':'#1e2e50'}`, background:filterBiz===v?'rgba(167,139,250,0.12)':'transparent', color:filterBiz===v?'#a78bfa':'#4a5568', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>{l}</button>
              ))}
            </div>
            {filtered.length===0
              ? <div style={{ textAlign:'center', padding:'30px 0', color:'#475569', fontSize:13 }}>내역이 없습니다</div>
              : filtered.map((e,idx)=>{
                const tc = TAX_COLORS[e.tax]||TAX_COLORS.exempt
                return (
                  <div key={e.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 0', borderBottom:idx<filtered.length-1?'1px solid #192640':'none' }}>
                    <div style={{ width:7, height:7, borderRadius:'50%', background:e.type==='income'?'#1D9E75':'#D85A30', flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:2, flexWrap:'wrap' }}>
                        <span style={{ fontSize:11, color:'#64748b' }}>{e.cat}</span>
                        {e.client&&<span style={{ fontSize:10, color:'#475569' }}>{e.client}</span>}
                        <span style={{ fontSize:10, padding:'1px 6px', borderRadius:99, background:tc.bg, color:tc.color }}>{TAX_LABELS[e.tax]||e.tax}</span>
                        <span style={{ fontSize:10, padding:'1px 6px', borderRadius:99, background:e.biz==='biz'?'rgba(34,197,94,0.12)':'rgba(245,158,11,0.12)', color:e.biz==='biz'?'#4ade80':'#fbbf24' }}>{e.biz==='biz'?'업무':'개인'}</span>
                        {e.isSubscription&&<span style={{ fontSize:10, padding:'1px 6px', borderRadius:99, background:'rgba(124,58,237,0.15)', color:'#a78bfa' }}>{e.subPeriod==='yearly'?'연구독':'월구독'}</span>}
                      </div>
                      <div style={{ fontSize:13, fontWeight:500, color:'#e2e8f0' }}>{e.memo||e.cat}</div>
                      <div style={{ fontSize:11, color:'#475569' }}>{e.date}</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:e.type==='income'?'#4ade80':'#f87171' }}>{e.type==='income'?'+':'-'}{fmt(e.amount)}</div>
                      {e.tax!=='exempt'&&<div style={{ fontSize:10, color:'#475569' }}>VAT {fmt(calcVAT(e.amount,e.tax))}</div>}
                    </div>
                    <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                      <button onClick={()=>setModal(e)} style={{ padding:'4px 9px', background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:6, color:'#93c5fd', fontSize:11, cursor:'pointer' }}>수정</button>
                      <button onClick={()=>delEntry(e.id)} style={{ padding:'4px 8px', background:'rgba(239,68,68,0.08)', border:'none', borderRadius:6, color:'#f87171', fontSize:11, cursor:'pointer' }}>삭제</button>
                    </div>
                  </div>
                )
              })
            }
          </div>
        </>}

        {/* ── SUBSCRIPTION ── */}
        {tab==='subscription' && <>
          {/* 연간 비용 분석 */}
          <div style={{ background:'rgba(124,58,237,0.06)', border:'1px solid rgba(124,58,237,0.2)', borderRadius:14, padding:'20px 22px', marginBottom:18 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#a78bfa', marginBottom:16 }}>📦 연간 구독 비용 분석</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:16, marginBottom:16 }}>
              <div>
                <div style={{ fontSize:12, color:'#64748b', marginBottom:6 }}>월 구독 합계 × 12개월</div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4 }}>
                  <span style={{ color:'#94a3b8' }}>{fmt(monthlyTotal)} × 12</span>
                  <span style={{ fontWeight:600, color:'#e2e8f0' }}>{fmt(monthlyTotal*12)}</span>
                </div>
                <div style={{ fontSize:12, color:'#64748b', marginBottom:6, marginTop:10 }}>연 구독 합계</div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                  <span style={{ color:'#94a3b8' }}>{yearlySubs.length}개 서비스</span>
                  <span style={{ fontWeight:600, color:'#e2e8f0' }}>{fmt(yearlyTotal)}</span>
                </div>
              </div>
              <div style={{ background:'rgba(124,58,237,0.08)', borderRadius:10, padding:'16px' }}>
                <div style={{ fontSize:12, color:'#64748b', marginBottom:8 }}>1년간 예상 구독 유지비</div>
                <div style={{ fontSize:26, fontWeight:700, color:'#a78bfa', marginBottom:12 }}>{fmt(annualTotal)}</div>
                <div style={{ height:1, background:'rgba(124,58,237,0.2)', marginBottom:12 }}/>
                <div style={{ fontSize:12, color:'#64748b', marginBottom:4 }}>월 예상 구독 고정 지출</div>
                <div style={{ fontSize:18, fontWeight:700, color:'#c084fc' }}>{fmt(monthlyEquivalent)}<span style={{ fontSize:12, fontWeight:400, color:'#64748b' }}>/월</span></div>
                <div style={{ fontSize:11, color:'#475569', marginTop:4 }}>월구독 {fmt(monthlyTotal)} + 연구독÷12 {fmt(Math.round(yearlyTotal/12))}</div>
              </div>
            </div>
            {/* 카테고리별 구독 월비용 */}
            {Object.keys(subCatBreakdown).length > 0 && (
              <div>
                <div style={{ fontSize:12, color:'#64748b', marginBottom:8 }}>카테고리별 월 환산 비용</div>
                <CatBar items={Object.entries(subCatBreakdown).map(([cat,amount])=>({ cat, amount }))}/>
              </div>
            )}
          </div>

          {/* 갱신 임박 알림 */}
          {upcomingRenewals.length > 0 && (
            <div style={{ background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.2)', borderRadius:12, padding:'14px 16px', marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#fcd34d', marginBottom:10 }}>⚠️ 갱신 임박 ({upcomingRenewals.length}건)</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {upcomingRenewals.map(s=>(
                  <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, fontSize:13 }}>
                    <span style={{ color:'#e2e8f0', flex:1 }}>{s.name}</span>
                    <span style={{ color:'#64748b' }}>{fmt(s.amount)}/{s.period==='monthly'?'월':'년'}</span>
                    <RenewalBadge dateStr={s.renewalDate}/>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 구독 목록 */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ display:'flex', gap:6 }}>
              {[['all','전체'],['monthly','월 구독'],['yearly','연 구독'],['inactive','비활성']].map(([v,l])=>(
                <button key={v} onClick={()=>setSubFilter(v)} style={{ padding:'5px 12px', borderRadius:20, border:`1px solid ${subFilter===v?'#7c3aed':'#1e2e50'}`, background:subFilter===v?'rgba(124,58,237,0.15)':'transparent', color:subFilter===v?'#a78bfa':'#4a5568', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>{l}</button>
              ))}
            </div>
            <button onClick={()=>setSubModal('add')} style={{ padding:'8px 18px', background:'linear-gradient(135deg,#7c3aed,#6d28d9)', border:'none', borderRadius:8, color:'#fff', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>+ 구독 추가</button>
          </div>

          <div style={cardS}>
            {filteredSubs.length===0
              ? <div style={{ textAlign:'center', padding:'30px 0', color:'#475569', fontSize:13 }}>구독 내역이 없습니다</div>
              : filteredSubs.sort((a,b)=>a.period.localeCompare(b.period)||a.name.localeCompare(b.name)).map((s,idx)=>{
                const monthly = s.period==='monthly' ? s.amount : Math.round(s.amount/12)
                const color = CAT_COLORS[s.subCat||'기타'] || '#888'
                const inactive = s.active===false
                return (
                  <div key={s.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom:idx<filteredSubs.length-1?'1px solid #192640':'none', opacity:inactive?0.5:1 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:inactive?'#475569':color, flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:3, flexWrap:'wrap' }}>
                        <span style={{ fontSize:13, fontWeight:600, color:'#e2e8f0' }}>{s.name}</span>
                        <span style={{ fontSize:10, padding:'1px 7px', borderRadius:99, background:s.period==='monthly'?'rgba(59,130,246,0.12)':'rgba(245,158,11,0.12)', color:s.period==='monthly'?'#93c5fd':'#fbbf24', border:`1px solid ${s.period==='monthly'?'rgba(59,130,246,0.2)':'rgba(245,158,11,0.2)'}` }}>{s.period==='monthly'?'월 구독':'연 구독'}</span>
                        {s.subCat && <span style={{ fontSize:10, color:'#475569' }}>{s.subCat}</span>}
                        {inactive && <span style={{ fontSize:10, padding:'1px 7px', borderRadius:99, background:'rgba(255,255,255,0.06)', color:'#475569' }}>비활성</span>}
                        <RenewalBadge dateStr={s.renewalDate}/>
                      </div>
                      {s.memo && <div style={{ fontSize:11, color:'#475569' }}>{s.memo}</div>}
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#f87171' }}>{fmt(s.amount)}/{s.period==='monthly'?'월':'년'}</div>
                      {s.period==='yearly' && <div style={{ fontSize:11, color:'#64748b' }}>월 환산 {fmt(monthly)}</div>}
                    </div>
                    <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                      <button onClick={()=>toggleSubActive(s)} title={inactive?'활성화':'비활성화'} style={{ padding:'4px 8px', background:inactive?'rgba(34,197,94,0.1)':'rgba(255,255,255,0.05)', border:`1px solid ${inactive?'rgba(34,197,94,0.2)':'#1e2e50'}`, borderRadius:6, color:inactive?'#4ade80':'#64748b', fontSize:11, cursor:'pointer' }}>{inactive?'활성화':'해지'}</button>
                      <button onClick={()=>setSubModal(s)} style={{ padding:'4px 9px', background:'rgba(124,58,237,0.1)', border:'1px solid rgba(124,58,237,0.2)', borderRadius:6, color:'#a78bfa', fontSize:11, cursor:'pointer' }}>수정</button>
                      <button onClick={()=>delSub(s.id)} style={{ padding:'4px 8px', background:'rgba(239,68,68,0.08)', border:'none', borderRadius:6, color:'#f87171', fontSize:11, cursor:'pointer' }}>삭제</button>
                    </div>
                  </div>
                )
              })
            }
          </div>
        </>}

        {/* ── VAT ── */}
        {tab==='vat' && <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:10, marginBottom:18 }}>
            {[0,1,2,3].map(q=>{
              const ms=[[0,1,2],[3,4,5],[6,7,8],[9,10,11]][q]
              const qE=entries.filter(e=>{const d=new Date(e.date);return d.getFullYear()===viewY&&ms.includes(d.getMonth())})
              const sv=qE.filter(e=>e.type==='income'&&e.tax!=='exempt').reduce((s,e)=>s+calcVAT(e.amount,e.tax),0)
              const pv=qE.filter(e=>e.type==='expense'&&e.tax!=='exempt').reduce((s,e)=>s+calcVAT(e.amount,e.tax),0)
              return <StatCard key={q} label={`${q+1}분기 납부세액`} value={fmt(Math.round(Math.max(sv-pv,0)))} color="#60a5fa"/>
            })}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div style={cardS}>
              <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>이번 분기 내역</div>
              {[0,1,2,3].map(q=>{
                const ms=[[0,1,2],[3,4,5],[6,7,8],[9,10,11]][q]
                if (!ms.includes(now.getMonth())) return null
                const qE=entries.filter(e=>{const d=new Date(e.date);return d.getFullYear()===viewY&&ms.includes(d.getMonth())})
                const sv=qE.filter(e=>e.type==='income'&&e.tax!=='exempt').reduce((s,e)=>s+calcVAT(e.amount,e.tax),0)
                const pv=qE.filter(e=>e.type==='expense'&&e.tax!=='exempt').reduce((s,e)=>s+calcVAT(e.amount,e.tax),0)
                return (
                  <div key={q} style={{ background:'#0a1120', borderRadius:9, padding:14 }}>
                    {[['매출세액',sv,'#4ade80'],['매입세액 (공제)',pv,'#f87171'],['납부세액',Math.max(sv-pv,0),'#60a5fa']].map(([label,val,color])=>(
                      <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #1e2e50', fontSize:13 }}>
                        <span style={{ color:'#94a3b8' }}>{label}</span>
                        <span style={{ fontWeight:600, color }}>{fmt(Math.round(val))}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
              <div style={{ fontSize:11, color:'#475569', marginTop:12, lineHeight:1.7 }}>과세·부가세포함 항목에 적용<br/>부가세포함: 총액 ÷ 1.1 × 0.1 = 부가세</div>
            </div>
            <div style={cardS}>
              <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>연간 분기별 요약</div>
              {[0,1,2,3].map(q=>{
                const ms=[[0,1,2],[3,4,5],[6,7,8],[9,10,11]][q]
                const qE=entries.filter(e=>{const d=new Date(e.date);return d.getFullYear()===viewY&&ms.includes(d.getMonth())})
                const sv=qE.filter(e=>e.type==='income'&&e.tax!=='exempt').reduce((s,e)=>s+calcVAT(e.amount,e.tax),0)
                const pv=qE.filter(e=>e.type==='expense'&&e.tax!=='exempt').reduce((s,e)=>s+calcVAT(e.amount,e.tax),0)
                return (
                  <div key={q} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:q<3?'1px solid #192640':'none' }}>
                    <span style={{ fontSize:13, color:'#94a3b8' }}>{q+1}분기</span>
                    <span style={{ fontSize:14, fontWeight:600, color:'#60a5fa' }}>{fmt(Math.round(Math.max(sv-pv,0)))}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </>}

        {/* ── FIXED ── */}
        {tab==='fixed' && <>
          <div style={cardS}>
            <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>고정비 추가</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
              <div><label style={lbl}>항목명</label><input value={fxForm.name} onChange={e=>setFxForm(f=>({...f,name:e.target.value}))} placeholder="예: 사무실 월세" style={iS}/></div>
              <div><label style={lbl}>월 금액 (원)</label><input type="number" value={fxForm.amount} onChange={e=>setFxForm(f=>({...f,amount:e.target.value}))} placeholder="0" style={iS}/></div>
              <div><label style={lbl}>카테고리</label>
                <select value={fxForm.cat} onChange={e=>setFxForm(f=>({...f,cat:e.target.value}))} style={iS}>
                  {expCats.map(c=><option key={c} value={c} style={{background:'#111d35'}}>{c}</option>)}
                </select>
              </div>
            </div>
            <button onClick={addFixed} style={{ width:'100%', padding:'10px', border:'none', borderRadius:9, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>+ 고정비 추가</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div style={cardS}>
              <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>등록된 고정비</div>
              {fixedCosts.length===0 ? <div style={{ textAlign:'center', padding:'24px 0', color:'#475569', fontSize:13 }}>없습니다</div>
                : fixedCosts.map(f=>(
                  <div key={f.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid #192640' }}>
                    <div style={{ width:7, height:7, borderRadius:'50%', background:CAT_COLORS[f.cat]||'#888', flexShrink:0 }}/>
                    <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:500, color:'#e2e8f0' }}>{f.name}</div><div style={{ fontSize:11, color:'#64748b' }}>{f.cat}</div></div>
                    <span style={{ fontSize:13, fontWeight:600, color:'#f87171' }}>{fmt(f.amount)}/월</span>
                    <button onClick={()=>delFixed(f.id)} style={{ padding:'3px 8px', background:'rgba(239,68,68,0.08)', border:'none', borderRadius:6, color:'#f87171', fontSize:11, cursor:'pointer' }}>삭제</button>
                  </div>
                ))
              }
              {fixedCosts.length>0&&<div style={{ display:'flex', justifyContent:'space-between', paddingTop:12, borderTop:'1px solid #1e2e50', fontSize:13, fontWeight:600 }}><span style={{ color:'#64748b', fontWeight:400 }}>월 합계</span><span style={{ color:'#f87171' }}>{fmt(fixedTotal)}</span></div>}
            </div>
            <div style={cardS}><div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>카테고리별 비중</div><CatBar items={fixedCosts.map(f=>({cat:f.cat,amount:f.amount}))}/></div>
          </div>
        </>}

        {/* ── CATEGORIES ── */}
        {tab==='categories' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {[['income','수입 카테고리',incCats],['expense','지출 카테고리',expCats]].map(([type,title,cats])=>(
              <div key={type} style={cardS}>
                <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>{title}</div>
                <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                  <input value={newCat[type]} onChange={e=>setNewCat(n=>({...n,[type]:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&addCat(type)} placeholder="새 카테고리" style={{ ...iS, flex:1 }}/>
                  <button onClick={()=>addCat(type)} style={{ padding:'9px 14px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:8, color:'#fff', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>추가</button>
                </div>
                {cats.map((cat,i)=>(
                  <div key={cat} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'rgba(255,255,255,0.02)', border:'1px solid #192640', borderRadius:8, marginBottom:6 }}>
                    <div style={{ width:7, height:7, borderRadius:'50%', background:CAT_COLORS[cat]||COLOR_POOL[i%COLOR_POOL.length], flexShrink:0 }}/>
                    {editCat?.cat===cat&&editCat?.type===type
                      ? <><input defaultValue={cat} id={`ec_${type}_${i}`} style={{ ...iS, flex:1, padding:'5px 9px' }}/>
                          <button onClick={()=>{ const v=document.getElementById(`ec_${type}_${i}`).value.trim(); if(v) updateCat(type,cat,v) }} style={{ padding:'4px 10px', background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:6, color:'#4ade80', fontSize:11, cursor:'pointer' }}>저장</button>
                          <button onClick={()=>setEditCat(null)} style={{ padding:'4px 8px', background:'transparent', border:'1px solid #1e2e50', borderRadius:6, color:'#64748b', fontSize:11, cursor:'pointer' }}>취소</button></>
                      : <><span style={{ flex:1, fontSize:13, color:'#e2e8f0' }}>{cat}</span>
                          <button onClick={()=>setEditCat({cat,type})} style={{ padding:'4px 9px', background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:6, color:'#93c5fd', fontSize:11, cursor:'pointer' }}>수정</button>
                          <button onClick={()=>delCat(type,cat)} style={{ padding:'4px 8px', background:'rgba(239,68,68,0.08)', border:'none', borderRadius:6, color:'#f87171', fontSize:11, cursor:'pointer' }}>삭제</button></>
                    }
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Entry Modal */}
      {modal && (
        <Modal onClose={()=>setModal(null)}>
          <EntryForm
            initial={modal==='add'?(calSelected?{date:calSelected}:null):(typeof modal==='object'&&modal.date?modal:null)}
            incCats={incCats} expCats={expCats}
            onSave={form=>saveEntry(form, typeof modal==='object'&&modal.id?modal.id:null)}
            onClose={()=>setModal(null)}
          />
        </Modal>
      )}

      {/* Subscription Modal */}
      {subModal && (
        <Modal onClose={()=>setSubModal(null)}>
          <SubForm
            initial={subModal==='add'?null:subModal}
            onSave={form=>saveSub(form, subModal!=='add'&&subModal.id?subModal.id:null)}
            onClose={()=>setSubModal(null)}
          />
        </Modal>
      )}

      <Toast message={toast} onClose={()=>setToast('')}/>
    </div>
  )
}
