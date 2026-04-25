import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { db } from '../firebase.js'
import { collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { logActivity, formatDate } from '../utils.js'
import Header from '../components/Header.jsx'
import { Toast, Modal, PageHeader } from '../components/UI.jsx'

const fmt = n => '₩' + Math.round(n).toLocaleString('ko-KR')
const fmtNum = n => Math.round(n).toLocaleString('ko-KR')

const DEFAULT_INC_CATS = ['매출','용역수입','이자수입','기타수입']
const DEFAULT_EXP_CATS = ['식비/접대','교통','인건비','마케팅','장비/소모품','임대료','통신비','세금/공과금','기타']
const CAT_COLORS = {
  '매출':'#1D9E75','용역수입':'#5DCAA5','이자수입':'#9FE1CB','기타수입':'#085041',
  '식비/접대':'#D85A30','교통':'#378ADD','인건비':'#7F77DD','마케팅':'#D4537E',
  '장비/소모품':'#BA7517','임대료':'#E24B4A','통신비':'#639922','세금/공과금':'#888780',
  '기타':'#B4B2A9','구독 서비스':'#534AB7',
}
const COLOR_POOL = ['#1D9E75','#378ADD','#7F77DD','#D4537E','#BA7517','#E24B4A','#639922','#D85A30','#534AB7','#5DCAA5']

const iS = { width:'100%', padding:'9px 11px', background:'#0a1120', border:'1px solid #1e2e50', borderRadius:8, color:'#e2e8f0', fontSize:13, outline:'none', fontFamily:"'Noto Sans KR',sans-serif" }
const lbl = { fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }

function StatCard({ label, value, color }) {
  return (
    <div style={{ background:'#111d35', border:'1px solid #1e2e50', borderRadius:11, padding:'12px 16px' }}>
      <div style={{ fontSize:11, fontWeight:600, color:'#64748b', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:19, fontWeight:700, color: color||'#e2e8f0' }}>{value}</div>
    </div>
  )
}

function BarBg({ pct, color }) {
  return (
    <div style={{ background:'#1e2e50', borderRadius:99, height:7, margin:'6px 0 5px' }}>
      <div style={{ height:7, borderRadius:99, width:`${Math.min(pct,100)}%`, background: color||'#1D9E75', transition:'width 0.4s' }} />
    </div>
  )
}

function CatBar({ items, totalKey='amount' }) {
  const total = items.reduce((s,i)=>s+(i[totalKey]||0),0)
  if (!total) return <div style={{ fontSize:12, color:'#475569', textAlign:'center', padding:'16px 0' }}>내역 없음</div>
  return items.sort((a,b)=>(b[totalKey]||0)-(a[totalKey]||0)).map((item,i)=>{
    const pct = Math.round((item[totalKey]||0)/total*100)
    const color = item.color || CAT_COLORS[item.cat||item.name] || COLOR_POOL[i%COLOR_POOL.length]
    return (
      <div key={i} style={{ marginBottom:8 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
          <span style={{ fontSize:12, color:'#94a3b8' }}>{item.cat||item.name}</span>
          <div style={{ display:'flex', gap:8 }}>
            <span style={{ fontSize:12, fontWeight:600, color:'#e2e8f0' }}>{fmt(item[totalKey]||0)}</span>
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

// ── Mini bar chart (no Chart.js) ─────────────────────────────────────────
function MiniChart({ months, revData, expData }) {
  const max = Math.max(...revData, ...expData, 1)
  return (
    <div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:100 }}>
        {months.map((m,i) => (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
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

export default function AccountingPage({ user, navigate, onLogout, currentPage }) {
  const [tab, setTab] = useState('dashboard')
  const [entries, setEntries] = useState([])
  const [fixedCosts, setFixedCosts] = useState([])
  const [incCats, setIncCats] = useState(DEFAULT_INC_CATS)
  const [expCats, setExpCats] = useState(DEFAULT_EXP_CATS)
  const [budget, setBudgetState] = useState(0)
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState(null)
  const [currentType, setCurrentType] = useState('expense')
  const [filterType, setFilterType] = useState('all')
  const [filterBiz, setFilterBiz] = useState('all')
  const [viewMonth, setViewMonth] = useState(() => { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}` })
  // form state
  const [form, setForm] = useState({ date:new Date().toISOString().slice(0,10), cat:'', client:'', tax:'taxable', amount:'', biz:'biz', memo:'' })
  const [fxForm, setFxForm] = useState({ name:'', amount:'', cat:expCats[0]||'' })
  const [budgetInput, setBudgetInput] = useState('')
  const [newCat, setNewCat] = useState('')
  const [editCat, setEditCat] = useState(null)
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),2500) }

  // Firebase listeners
  useEffect(() => {
    const u1 = onSnapshot(collection(db,'accounting_entries'), snap => {
      setEntries(snap.docs.map(d=>({...d.data(),id:d.id})).sort((a,b)=>b.date?.localeCompare(a.date)))
    })
    const u2 = onSnapshot(collection(db,'accounting_fixed'), snap => {
      setFixedCosts(snap.docs.map(d=>({...d.data(),id:d.id})))
    })
    const u3 = onSnapshot(doc(db,'accounting_settings','main'), snap => {
      if (snap.exists()) {
        const d = snap.data()
        if (d.incCats) setIncCats(d.incCats)
        if (d.expCats) setExpCats(d.expCats)
        if (d.budget) setBudgetState(d.budget)
      }
    })
    return () => { u1(); u2(); u3() }
  }, [])

  const saveSettings = async (updates) => {
    await setDoc(doc(db,'accounting_settings','main'), updates, { merge:true })
  }

  // Derived data
  const now = new Date()
  const [viewY, viewM] = viewMonth.split('-').map(Number)
  const monthEntries = entries.filter(e => e.date?.startsWith(viewMonth))
  const revenue = monthEntries.filter(e=>e.type==='income').reduce((s,e)=>s+e.amount,0)
  const varExp = monthEntries.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amount,0)
  const fixedTotal = fixedCosts.reduce((s,f)=>s+f.amount,0)
  const totalExp = varExp + fixedTotal
  const profit = revenue - totalExp
  const vatPay = Math.max(
    monthEntries.filter(e=>e.type==='income'&&e.tax==='taxable').reduce((s,e)=>s+e.amount*0.1,0) -
    monthEntries.filter(e=>e.type==='expense'&&e.tax==='taxable').reduce((s,e)=>s+e.amount*0.1,0),
    0
  )
  const budgetPct = budget ? Math.min(Math.round(totalExp/budget*100),100) : 0
  const budgetOver = budget && totalExp > budget

  // 6 months for chart
  const months6 = Array.from({length:6},(_,i)=>{
    const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1)
    return { y:d.getFullYear(), m:d.getMonth(), label:(d.getMonth()+1)+'월' }
  })
  const revData = months6.map(({y,m})=>entries.filter(e=>{const d=new Date(e.date);return d.getFullYear()===y&&d.getMonth()===m&&e.type==='income'}).reduce((s,e)=>s+e.amount,0))
  const expData = months6.map(({y,m})=>entries.filter(e=>{const d=new Date(e.date);return d.getFullYear()===y&&d.getMonth()===m&&e.type==='expense'}).reduce((s,e)=>s+e.amount,0)+fixedTotal)

  // Category breakdown
  const expCatTotals = {}
  monthEntries.filter(e=>e.type==='expense').forEach(e=>{ expCatTotals[e.cat]=(expCatTotals[e.cat]||0)+e.amount })
  fixedCosts.forEach(f=>{ expCatTotals[f.cat]=(expCatTotals[f.cat]||0)+f.amount })
  const catChartData = Object.entries(expCatTotals).map(([cat,amount])=>({ cat, amount }))

  // Add entry
  const addEntry = async () => {
    if (!form.amount || !form.cat) { showToast('카테고리와 금액을 입력해주세요'); return }
    const id = `entry_${Date.now()}`
    await setDoc(doc(db,'accounting_entries',id), {
      ...form, amount:parseFloat(form.amount), type:currentType,
      createdAt:serverTimestamp(), createdBy:user.id
    })
    setForm(f=>({...f, amount:'', memo:'', client:''}))
    showToast('✅ 내역이 추가되었습니다')
  }

  const delEntry = async id => {
    await deleteDoc(doc(db,'accounting_entries',id))
    showToast('🗑️ 삭제되었습니다')
  }

  const addFixed = async () => {
    if (!fxForm.name || !fxForm.amount) { showToast('항목명과 금액을 입력해주세요'); return }
    const id = `fixed_${Date.now()}`
    await setDoc(doc(db,'accounting_fixed',id), { ...fxForm, amount:parseFloat(fxForm.amount) })
    setFxForm({ name:'', amount:'', cat:expCats[0]||'' })
    showToast('✅ 고정비가 추가되었습니다')
  }

  const delFixed = async id => {
    await deleteDoc(doc(db,'accounting_fixed',id))
    showToast('🗑️ 삭제되었습니다')
  }

  const handleSetBudget = async () => {
    const v = parseFloat(budgetInput)||0
    setBudgetState(v)
    await saveSettings({ budget:v })
    setBudgetInput('')
    showToast('✅ 예산이 설정되었습니다')
  }

  // Category management
  const addCat = async (type) => {
    if (!newCat.trim()) return
    const updated = type==='income' ? [...incCats, newCat.trim()] : [...expCats, newCat.trim()]
    if (type==='income') setIncCats(updated)
    else setExpCats(updated)
    await saveSettings(type==='income' ? {incCats:updated} : {expCats:updated})
    setNewCat('')
    showToast('✅ 카테고리가 추가되었습니다')
  }

  const delCat = async (type, cat) => {
    const updated = type==='income' ? incCats.filter(c=>c!==cat) : expCats.filter(c=>c!==cat)
    if (type==='income') setIncCats(updated)
    else setExpCats(updated)
    await saveSettings(type==='income' ? {incCats:updated} : {expCats:updated})
    showToast('🗑️ 카테고리가 삭제되었습니다')
  }

  const updateCat = async (type, oldCat, newName) => {
    const updated = type==='income'
      ? incCats.map(c=>c===oldCat?newName:c)
      : expCats.map(c=>c===oldCat?newName:c)
    if (type==='income') setIncCats(updated)
    else setExpCats(updated)
    await saveSettings(type==='income' ? {incCats:updated} : {expCats:updated})
    setEditCat(null)
    showToast('✅ 수정되었습니다')
  }

  // Excel export via SheetJS
  const exportExcel = async () => {

    const wb = XLSX.utils.book_new()

    // Sheet 1: 거래 내역
    const ledgerData = [
      ['날짜','구분','카테고리','거래처','금액','부가세','업무구분','메모'],
      ...monthEntries.map(e=>[
        e.date, e.type==='income'?'수입':'지출', e.cat, e.client||'',
        e.amount, e.tax==='taxable'?Math.round(e.amount*0.1):0,
        e.biz==='biz'?'업무용':'개인용', e.memo||''
      ]),
      ...fixedCosts.map(f=>[ '-', '지출(고정)', f.cat, '', f.amount, 0, '업무용', f.name ])
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(ledgerData)
    ws1['!cols'] = [12,8,12,12,14,12,8,16].map(w=>({wch:w}))
    XLSX.utils.book_append_sheet(wb, ws1, '거래내역')

    // Sheet 2: 요약
    const summaryData = [
      ['항목','금액'],
      ['총 매출', revenue],
      ['총 지출 (변동)', varExp],
      ['총 지출 (고정)', fixedTotal],
      ['총 지출 합계', totalExp],
      ['순이익', profit],
      ['납부 부가세', Math.round(vatPay)],
      ['예산', budget||'-'],
      ['예산 소진율', budget ? budgetPct+'%' : '-'],
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(summaryData)
    ws2['!cols'] = [{wch:18},{wch:16}]
    XLSX.utils.book_append_sheet(wb, ws2, '요약')

    // Sheet 3: 카테고리별
    const catData = [
      ['카테고리','지출액','비율'],
      ...catChartData.sort((a,b)=>b.amount-a.amount).map(({cat,amount})=>[
        cat, amount, totalExp ? Math.round(amount/totalExp*100)+'%' : '0%'
      ])
    ]
    const ws3 = XLSX.utils.aoa_to_sheet(catData)
    ws3['!cols'] = [{wch:14},{wch:14},{wch:8}]
    XLSX.utils.book_append_sheet(wb, ws3, '카테고리별')

    XLSX.writeFile(wb, `가계부_${viewMonth}.xlsx`)
    showToast('📥 엑셀 파일이 다운로드되었습니다')
  }

  const filtered = monthEntries.filter(e => {
    if (filterType!=='all' && e.type!==filterType) return false
    if (filterBiz!=='all' && e.biz!==filterBiz) return false
    return true
  })

  const tabs = [
    {id:'dashboard', label:'대시보드'},
    {id:'ledger', label:'수입/지출'},
    {id:'vat', label:'부가세'},
    {id:'fixed', label:'고정비'},
    {id:'categories', label:'카테고리 설정'},
  ]

  const curCats = currentType==='income' ? incCats : expCats

  // Month nav
  const navMonth = (d) => {
    const [y,m] = viewMonth.split('-').map(Number)
    const nd = new Date(y, m-1+d, 1)
    setViewMonth(`${nd.getFullYear()}-${String(nd.getMonth()+1).padStart(2,'0')}`)
  }

  const cardStyle = { background:'#111d35', border:'1px solid #1e2e50', borderRadius:14, padding:'16px 18px', marginBottom:16 }

  return (
    <div style={{ minHeight:'100vh', background:'#0d1526', fontFamily:"'Noto Sans KR',sans-serif", color:'#e2e8f0' }}>
      <Header user={user} navigate={navigate} onLogout={onLogout} currentPage={currentPage}/>
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'24px 20px' }}>

        {/* Page header */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
          <button onClick={()=>navigate('main')} style={{ padding:'6px 12px', background:'rgba(255,255,255,0.05)', border:'1px solid #1e2e50', borderRadius:8, color:'#94a3b8', fontSize:13, cursor:'pointer' }}>← 뒤로</button>
          <h1 style={{ fontSize:18, fontWeight:700, color:'#f1f5f9' }}>💰 사업자 가계부</h1>
          <div style={{ flex:1 }} />
          {/* Month nav */}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={()=>navMonth(-1)} style={{ padding:'5px 10px', background:'#111d35', border:'1px solid #1e2e50', borderRadius:7, color:'#94a3b8', cursor:'pointer', fontSize:14 }}>‹</button>
            <span style={{ fontSize:14, fontWeight:600, color:'#e2e8f0', minWidth:90, textAlign:'center' }}>{viewMonth.replace('-','년 ')}월</span>
            <button onClick={()=>navMonth(1)} style={{ padding:'5px 10px', background:'#111d35', border:'1px solid #1e2e50', borderRadius:7, color:'#94a3b8', cursor:'pointer', fontSize:14 }}>›</button>
          </div>
          <button onClick={exportExcel} style={{ padding:'8px 16px', background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:8, color:'#4ade80', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>
            📥 엑셀 다운로드
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid #1e2e50', marginBottom:24, overflowX:'auto' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:'10px 20px', border:'none', background:'transparent', fontSize:13, fontWeight:600, cursor:'pointer', color:tab===t.id?'#93c5fd':'#4a5568', borderBottom:`2px solid ${tab===t.id?'#3b82f6':'transparent'}`, marginBottom:-1, whiteSpace:'nowrap', fontFamily:"'Noto Sans KR',sans-serif" }}>{t.label}</button>
          ))}
        </div>

        {/* DASHBOARD */}
        {tab==='dashboard' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:10, marginBottom:18 }}>
              <StatCard label="이번달 매출" value={fmt(revenue)} color="#4ade80"/>
              <StatCard label="이번달 지출" value={fmt(totalExp)} color="#f87171"/>
              <StatCard label={`순이익`} value={fmt(Math.abs(profit))} color={profit>=0?'#4ade80':'#f87171'}/>
              <StatCard label="납부 부가세" value={fmt(Math.round(vatPay))} color="#60a5fa"/>
            </div>

            {/* Budget */}
            <div style={cardStyle}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <span style={{ fontSize:13, fontWeight:600, color:'#cbd5e1' }}>월 예산 현황</span>
                <span style={{ fontSize:12, color: budgetOver?'#f87171':'#64748b' }}>
                  {budget ? `${fmt(totalExp)} / ${fmt(budget)}` : '예산 미설정'}
                </span>
              </div>
              <BarBg pct={budgetPct} color={budgetPct>=90?'#ef4444':budgetPct>=70?'#f59e0b':'#1D9E75'}/>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
                <span style={{ fontSize:11, color:budgetOver?'#f87171':'#475569' }}>
                  {budget ? (budgetOver?`초과 ${fmt(totalExp-budget)}`:`잔여 ${fmt(budget-totalExp)}`) : '예산을 설정해주세요'}
                </span>
                {budget>0 && <span style={{ fontSize:11, color:'#475569' }}>{budgetPct}%</span>}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <input value={budgetInput} onChange={e=>setBudgetInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSetBudget()} placeholder="월 예산 입력 (원)" type="number" style={{ ...iS, flex:1 }}/>
                <button onClick={handleSetBudget} style={{ padding:'9px 16px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:8, color:'#fff', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>설정</button>
                {budget>0 && <button onClick={async()=>{setBudgetState(0);await saveSettings({budget:0})}} style={{ padding:'9px 12px', background:'transparent', border:'1px solid #1e2e50', borderRadius:8, color:'#64748b', fontSize:13, cursor:'pointer' }}>초기화</button>}
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div style={cardStyle}>
                <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>카테고리별 지출</div>
                <CatBar items={catChartData}/>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:8 }}>월별 손익 추이</div>
                <div style={{ display:'flex', gap:12, fontSize:11, marginBottom:10 }}>
                  <span style={{ display:'flex', alignItems:'center', gap:4, color:'#475569' }}><span style={{ width:8, height:8, borderRadius:1, background:'#1D9E75', display:'inline-block' }}/> 매출</span>
                  <span style={{ display:'flex', alignItems:'center', gap:4, color:'#475569' }}><span style={{ width:8, height:8, borderRadius:1, background:'#D85A30', display:'inline-block' }}/> 지출</span>
                </div>
                <MiniChart months={months6.map(m=>m.label)} revData={revData} expData={expData}/>
              </div>
            </div>
          </div>
        )}

        {/* LEDGER */}
        {tab==='ledger' && (
          <div>
            <div style={cardStyle}>
              <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>내역 추가</div>
              {/* Type toggle */}
              <div style={{ display:'flex', background:'#0a1120', border:'1px solid #1e2e50', borderRadius:9, padding:3, marginBottom:14 }}>
                {[['expense','지출'],['income','수입']].map(([t,l])=>(
                  <button key={t} onClick={()=>setCurrentType(t)} style={{ flex:1, padding:'8px', border:'none', borderRadius:7, background:currentType===t?(t==='expense'?'rgba(239,68,68,0.2)':'rgba(34,197,94,0.2)'):'transparent', color:currentType===t?(t==='expense'?'#f87171':'#4ade80'):'#64748b', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>{l}</button>
                ))}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10, marginBottom:10 }}>
                <div><label style={lbl}>날짜</label><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={iS}/></div>
                <div><label style={lbl}>카테고리</label>
                  <select value={form.cat} onChange={e=>setForm(f=>({...f,cat:e.target.value}))} style={iS}>
                    <option value="">선택</option>
                    {curCats.map(c=><option key={c} value={c} style={{background:'#111d35'}}>{c}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>거래처 (선택)</label><input value={form.client} onChange={e=>setForm(f=>({...f,client:e.target.value}))} placeholder="예: (주)ABC" style={iS}/></div>
                <div><label style={lbl}>과세 여부</label>
                  <select value={form.tax} onChange={e=>setForm(f=>({...f,tax:e.target.value}))} style={iS}>
                    <option value="taxable" style={{background:'#111d35'}}>과세 (VAT 10%)</option>
                    <option value="exempt" style={{background:'#111d35'}}>면세</option>
                  </select>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
                <div><label style={lbl}>금액 (원)</label><input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0" style={iS}/></div>
                <div><label style={lbl}>업무 구분</label>
                  <select value={form.biz} onChange={e=>setForm(f=>({...f,biz:e.target.value}))} style={iS}>
                    <option value="biz" style={{background:'#111d35'}}>업무용</option>
                    <option value="personal" style={{background:'#111d35'}}>개인용</option>
                  </select>
                </div>
                <div><label style={lbl}>메모</label><input value={form.memo} onChange={e=>setForm(f=>({...f,memo:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&addEntry()} placeholder="선택 사항" style={iS}/></div>
              </div>
              {form.amount && form.tax==='taxable' && (
                <div style={{ fontSize:12, color:'#64748b', marginBottom:10 }}>
                  공급가액 {fmt(parseFloat(form.amount)||0)} + 부가세 {fmt(Math.round((parseFloat(form.amount)||0)*0.1))} = 합계 {fmt(Math.round((parseFloat(form.amount)||0)*1.1))}
                </div>
              )}
              <button onClick={addEntry} style={{ width:'100%', padding:'10px', border:'none', borderRadius:9, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>+ 추가하기</button>
            </div>

            <div style={cardStyle}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
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
                : filtered.map((e,idx)=>(
                  <div key={e.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 0', borderBottom:idx<filtered.length-1?'1px solid #192640':'none' }}>
                    <div style={{ width:7, height:7, borderRadius:'50%', background:e.type==='income'?'#1D9E75':'#D85A30', flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2, flexWrap:'wrap' }}>
                        <span style={{ fontSize:11, color:'#64748b' }}>{e.cat}</span>
                        {e.client && <span style={{ fontSize:10, color:'#475569' }}>{e.client}</span>}
                        <span style={{ fontSize:10, padding:'1px 6px', borderRadius:99, background:e.tax==='taxable'?'rgba(59,130,246,0.15)':'rgba(255,255,255,0.06)', color:e.tax==='taxable'?'#93c5fd':'#64748b' }}>{e.tax==='taxable'?'과세':'면세'}</span>
                        <span style={{ fontSize:10, padding:'1px 6px', borderRadius:99, background:e.biz==='biz'?'rgba(34,197,94,0.12)':'rgba(245,158,11,0.12)', color:e.biz==='biz'?'#4ade80':'#fbbf24' }}>{e.biz==='biz'?'업무':'개인'}</span>
                      </div>
                      <div style={{ fontSize:13, fontWeight:500, color:'#e2e8f0' }}>{e.memo||e.cat}</div>
                      <div style={{ fontSize:11, color:'#475569' }}>{e.date}</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:e.type==='income'?'#4ade80':'#f87171' }}>{e.type==='income'?'+':'-'}{fmt(e.amount)}</div>
                      {e.tax==='taxable' && <div style={{ fontSize:10, color:'#475569' }}>VAT {fmt(Math.round(e.amount*0.1))}</div>}
                    </div>
                    <button onClick={()=>delEntry(e.id)} style={{ padding:'3px 8px', background:'rgba(239,68,68,0.08)', border:'none', borderRadius:6, color:'#f87171', fontSize:11, cursor:'pointer' }}>삭제</button>
                  </div>
                ))
              }
              {filtered.length>0 && (
                <div style={{ display:'flex', justifyContent:'space-between', paddingTop:12, borderTop:'1px solid #1e2e50', fontSize:13, fontWeight:600 }}>
                  <span style={{ color:'#64748b', fontWeight:400 }}>수입 {fmt(filtered.filter(e=>e.type==='income').reduce((s,e)=>s+e.amount,0))} / 지출 {fmt(filtered.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amount,0))}</span>
                  <span style={{ color: profit>=0?'#4ade80':'#f87171' }}>{fmt(Math.abs(revenue-varExp))}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VAT */}
        {tab==='vat' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:10, marginBottom:18 }}>
              {[0,1,2,3].map(q=>{
                const ms=[[0,1,2],[3,4,5],[6,7,8],[9,10,11]][q]
                const qEntries=entries.filter(e=>{const d=new Date(e.date);return d.getFullYear()===viewY&&ms.includes(d.getMonth())})
                const sv=qEntries.filter(e=>e.type==='income'&&e.tax==='taxable').reduce((s,e)=>s+e.amount*0.1,0)
                const pv=qEntries.filter(e=>e.type==='expense'&&e.tax==='taxable').reduce((s,e)=>s+e.amount*0.1,0)
                return <StatCard key={q} label={`${q+1}분기 납부세액`} value={fmt(Math.round(Math.max(sv-pv,0)))} color="#60a5fa"/>
              })}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div style={cardStyle}>
                <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>이번 분기 부가세 내역</div>
                {[0,1,2,3].map(q=>{
                  const ms=[[0,1,2],[3,4,5],[6,7,8],[9,10,11]][q]
                  if (!ms.includes(now.getMonth())) return null
                  const qE=entries.filter(e=>{const d=new Date(e.date);return d.getFullYear()===viewY&&ms.includes(d.getMonth())})
                  const sv=qE.filter(e=>e.type==='income'&&e.tax==='taxable').reduce((s,e)=>s+e.amount*0.1,0)
                  const pv=qE.filter(e=>e.type==='expense'&&e.tax==='taxable').reduce((s,e)=>s+e.amount*0.1,0)
                  return (
                    <div key={q} style={{ background:'#0a1120', borderRadius:9, padding:14 }}>
                      {[['매출세액 (납부)',sv,'#4ade80'],['매입세액 (공제)',-pv,'#f87171'],['납부세액',Math.max(sv-pv,0),'#60a5fa']].map(([label,val,color])=>(
                        <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #1e2e50', fontSize:13 }}>
                          <span style={{ color:'#94a3b8' }}>{label}</span>
                          <span style={{ fontWeight:600, color }}>{val<0?'-':'+' }{fmt(Math.abs(Math.round(val)))}</span>
                        </div>
                      ))}
                    </div>
                  )
                })}
                <div style={{ fontSize:11, color:'#475569', marginTop:12, lineHeight:1.7 }}>납부세액 = 매출세액 - 매입세액<br/>과세 항목에만 적용됩니다</div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>연간 분기별 요약</div>
                {[0,1,2,3].map(q=>{
                  const ms=[[0,1,2],[3,4,5],[6,7,8],[9,10,11]][q]
                  const qE=entries.filter(e=>{const d=new Date(e.date);return d.getFullYear()===viewY&&ms.includes(d.getMonth())})
                  const sv=qE.filter(e=>e.type==='income'&&e.tax==='taxable').reduce((s,e)=>s+e.amount*0.1,0)
                  const pv=qE.filter(e=>e.type==='expense'&&e.tax==='taxable').reduce((s,e)=>s+e.amount*0.1,0)
                  const pay=Math.max(sv-pv,0)
                  return (
                    <div key={q} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:q<3?'1px solid #192640':'none' }}>
                      <span style={{ fontSize:13, color:'#94a3b8' }}>{q+1}분기 ({ms.map(m=>m+1).join('·')}월)</span>
                      <span style={{ fontSize:14, fontWeight:600, color:'#60a5fa' }}>{fmt(Math.round(pay))}</span>
                    </div>
                  )
                })}
                <div style={{ display:'flex', justifyContent:'space-between', paddingTop:12, borderTop:'1px solid #1e2e50', fontSize:13, fontWeight:600 }}>
                  <span style={{ color:'#64748b' }}>연간 합계</span>
                  <span style={{ color:'#60a5fa' }}>{fmt(Math.round([0,1,2,3].reduce((s,q)=>{
                    const ms=[[0,1,2],[3,4,5],[6,7,8],[9,10,11]][q]
                    const qE=entries.filter(e=>{const d=new Date(e.date);return d.getFullYear()===viewY&&ms.includes(d.getMonth())})
                    const sv=qE.filter(e=>e.type==='income'&&e.tax==='taxable').reduce((s,e)=>s+e.amount*0.1,0)
                    const pv=qE.filter(e=>e.type==='expense'&&e.tax==='taxable').reduce((s,e)=>s+e.amount*0.1,0)
                    return s+Math.max(sv-pv,0)
                  },0)))}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FIXED */}
        {tab==='fixed' && (
          <div>
            <div style={cardStyle}>
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
              <div style={cardStyle}>
                <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>등록된 고정비</div>
                {fixedCosts.length===0
                  ? <div style={{ textAlign:'center', padding:'24px 0', color:'#475569', fontSize:13 }}>등록된 고정비가 없습니다</div>
                  : fixedCosts.map(f=>(
                    <div key={f.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid #192640' }}>
                      <div style={{ width:7, height:7, borderRadius:'50%', background:CAT_COLORS[f.cat]||'#888', flexShrink:0 }}/>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:500, color:'#e2e8f0' }}>{f.name}</div>
                        <div style={{ fontSize:11, color:'#64748b' }}>{f.cat}</div>
                      </div>
                      <span style={{ fontSize:13, fontWeight:600, color:'#f87171' }}>{fmt(f.amount)}/월</span>
                      <button onClick={()=>delFixed(f.id)} style={{ padding:'3px 8px', background:'rgba(239,68,68,0.08)', border:'none', borderRadius:6, color:'#f87171', fontSize:11, cursor:'pointer' }}>삭제</button>
                    </div>
                  ))
                }
                {fixedCosts.length>0 && (
                  <div style={{ display:'flex', justifyContent:'space-between', paddingTop:12, borderTop:'1px solid #1e2e50', fontSize:13, fontWeight:600 }}>
                    <span style={{ color:'#64748b', fontWeight:400 }}>월 합계</span>
                    <span style={{ color:'#f87171' }}>{fmt(fixedTotal)}</span>
                  </div>
                )}
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>카테고리별 비중</div>
                <CatBar items={fixedCosts.map(f=>({cat:f.cat,amount:f.amount}))}/>
              </div>
            </div>
          </div>
        )}

        {/* CATEGORIES */}
        {tab==='categories' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {[['income','수입 카테고리',incCats],['expense','지출 카테고리',expCats]].map(([type,title,cats])=>(
              <div key={type} style={cardStyle}>
                <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>{title}</div>
                <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                  <input value={type===currentType||true?newCat:''} onChange={e=>setNewCat(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCat(type)} placeholder="새 카테고리 이름" style={{ ...iS, flex:1 }}/>
                  <button onClick={()=>addCat(type)} style={{ padding:'9px 14px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:8, color:'#fff', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>추가</button>
                </div>
                {cats.map((cat,i)=>(
                  <div key={cat} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'rgba(255,255,255,0.02)', border:'1px solid #192640', borderRadius:8, marginBottom:6 }}>
                    <div style={{ width:7, height:7, borderRadius:'50%', background:CAT_COLORS[cat]||COLOR_POOL[i%COLOR_POOL.length], flexShrink:0 }}/>
                    {editCat?.cat===cat&&editCat?.type===type ? (
                      <>
                        <input defaultValue={cat} id={`edit_${cat}`} style={{ ...iS, flex:1, padding:'5px 9px' }}/>
                        <button onClick={()=>{ const v=document.getElementById(`edit_${cat}`).value.trim(); if(v) updateCat(type,cat,v) }} style={{ padding:'4px 10px', background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:6, color:'#4ade80', fontSize:11, cursor:'pointer' }}>저장</button>
                        <button onClick={()=>setEditCat(null)} style={{ padding:'4px 8px', background:'transparent', border:'1px solid #1e2e50', borderRadius:6, color:'#64748b', fontSize:11, cursor:'pointer' }}>취소</button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex:1, fontSize:13, color:'#e2e8f0' }}>{cat}</span>
                        <button onClick={()=>setEditCat({cat,type})} style={{ padding:'4px 9px', background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:6, color:'#93c5fd', fontSize:11, cursor:'pointer' }}>수정</button>
                        <button onClick={()=>delCat(type,cat)} style={{ padding:'4px 8px', background:'rgba(239,68,68,0.08)', border:'none', borderRadius:6, color:'#f87171', fontSize:11, cursor:'pointer' }}>삭제</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <Toast message={toast} onClose={()=>setToast('')}/>
    </div>
  )
}
