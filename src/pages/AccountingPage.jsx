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
const CAT_COLORS = {
  '매출':'#1D9E75','용역수입':'#5DCAA5','이자수입':'#9FE1CB','기타수입':'#085041',
  '식비/접대':'#D85A30','교통':'#378ADD','인건비':'#7F77DD','마케팅':'#D4537E',
  '장비/소모품':'#BA7517','임대료':'#E24B4A','통신비':'#639922','세금/공과금':'#888780',
  '기타':'#B4B2A9','구독 서비스':'#534AB7','업무도구':'#378ADD','인프라':'#639922',
  '디자인':'#D4537E','커뮤니케이션':'#1D9E75','보안':'#7F77DD'
}
const COLOR_POOL = ['#1D9E75','#378ADD','#7F77DD','#D4537E','#BA7517','#E24B4A','#639922','#D85A30','#534AB7','#5DCAA5']

const calcVAT = (amount, tax) => {
  if (tax==='taxable') return Math.round(amount*0.1)
  if (tax==='inclusive') return Math.round(amount - amount/1.1)
  return 0
}
const supplyAmt = (amount, tax) => tax==='inclusive' ? Math.round(amount/1.1) : amount
const TAX_LABELS = { taxable:'과세', exempt:'면세', inclusive:'부가세포함' }
const TAX_COLORS = {
  taxable:{ bg:'rgba(59,130,246,0.15)', color:'#93c5fd' },
  exempt:{ bg:'rgba(255,255,255,0.06)', color:'#64748b' },
  inclusive:{ bg:'rgba(167,139,250,0.15)', color:'#a78bfa' }
}

const iS = { width:'100%', padding:'9px 11px', background:'#0a1120', border:'1px solid #1e2e50', borderRadius:8, color:'#e2e8f0', fontSize:13, outline:'none', fontFamily:"'Noto Sans KR',sans-serif" }
const lbl = { fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }
const cardS = { background:'#111d35', border:'1px solid #1e2e50', borderRadius:14, padding:'16px 18px', marginBottom:16 }

// ── 구독 기간 계산 ──────────────────────────────────────────────────────────
function calcSubMonths(sub) {
  if (sub.period==='monthly') return 1
  if (sub.period==='yearly') return 12
  if (sub.period==='custom' && sub.startDate && sub.endDate) {
    const s=new Date(sub.startDate), e=new Date(sub.endDate)
    return Math.max(1, Math.round((e-s)/(1000*60*60*24*30.44)))
  }
  return 1
}
function calcMonthlyAmt(sub) {
  if (sub.period==='monthly') return sub.amount
  if (sub.period==='yearly') return Math.round(sub.amount/12)
  if (sub.period==='custom') return Math.round(sub.amount/Math.max(calcSubMonths(sub),1))
  return sub.amount
}
function daysUntil(dateStr) {
  if (!dateStr) return null
  const today=new Date(); today.setHours(0,0,0,0)
  const target=new Date(dateStr); target.setHours(0,0,0,0)
  return Math.round((target-today)/(1000*60*60*24))
}
function isExpired(sub) {
  if (sub.period==='custom'&&sub.endDate) return daysUntil(sub.endDate)<0
  return false
}
function daysUntilEnd(sub) {
  if (sub.period==='custom'&&sub.endDate) return daysUntil(sub.endDate)
  if (sub.renewalDate) return daysUntil(sub.renewalDate)
  return null
}

// ── 뱃지 컴포넌트 ────────────────────────────────────────────────────────────
function StatusBadge({ sub }) {
  const days=daysUntilEnd(sub)
  if (days===null) return null
  const expired=days<0
  const label=expired?`${Math.abs(days)}일 종료됨`:days===0?'오늘 종료/갱신':`${days}일 후 ${sub.period==='custom'?'종료':'갱신'}`
  const color=expired?'#f87171':days<=7?'#fbbf24':days<=30?'#93c5fd':days<=90?'#6ee7b7':'#475569'
  const bg=expired?'rgba(239,68,68,0.1)':days<=7?'rgba(251,191,36,0.1)':days<=30?'rgba(59,130,246,0.08)':days<=90?'rgba(110,231,183,0.08)':'transparent'
  return <span style={{ fontSize:10, padding:'1px 7px', borderRadius:99, background:bg, color, border:`1px solid ${color}44`, flexShrink:0 }}>{label}</span>
}
function PeriodLabel({ sub }) {
  if (sub.period==='monthly') return <span style={{ fontSize:10, padding:'1px 7px', borderRadius:99, background:'rgba(59,130,246,0.12)', color:'#93c5fd', border:'1px solid rgba(59,130,246,0.2)' }}>월 구독</span>
  if (sub.period==='yearly') return <span style={{ fontSize:10, padding:'1px 7px', borderRadius:99, background:'rgba(245,158,11,0.12)', color:'#fbbf24', border:'1px solid rgba(245,158,11,0.2)' }}>연 구독</span>
  const months=calcSubMonths(sub)
  return <span style={{ fontSize:10, padding:'1px 7px', borderRadius:99, background:'rgba(167,139,250,0.12)', color:'#a78bfa', border:'1px solid rgba(167,139,250,0.2)' }}>{months>=12?`${Math.round(months/12)}년`:months+'개월'} 구독</span>
}
function SourceBadge({ source }) {
  const map = { sub:null, fixed:['📌 고정비','rgba(255,255,255,0.06)','#64748b'], entry:['📝 내역','rgba(59,130,246,0.08)','#60a5fa'] }
  const info = map[source]
  if (!info) return null
  return <span style={{ fontSize:10, padding:'1px 6px', borderRadius:99, background:info[1], color:info[2] }}>{info[0]}</span>
}

function StatCard({ label, value, color, sub }) {
  return (
    <div style={{ background:'#111d35', border:'1px solid #1e2e50', borderRadius:11, padding:'12px 16px' }}>
      <div style={{ fontSize:11, fontWeight:600, color:'#64748b', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:19, fontWeight:700, color:color||'#e2e8f0' }}>{value}</div>
      {sub&&<div style={{ fontSize:11, color:'#475569', marginTop:3 }}>{sub}</div>}
    </div>
  )
}
function BarBg({ pct, color }) {
  return (
    <div style={{ background:'#1e2e50', borderRadius:99, height:7, margin:'6px 0 5px' }}>
      <div style={{ height:7, borderRadius:99, width:`${Math.min(pct,100)}%`, background:color||'#1D9E75', transition:'width 0.4s' }}/>
    </div>
  )
}
function CatBar({ items }) {
  const total=items.reduce((s,i)=>s+(i.amount||0),0)
  if (!total) return <div style={{ fontSize:12, color:'#475569', textAlign:'center', padding:'16px 0' }}>내역 없음</div>
  return items.sort((a,b)=>(b.amount||0)-(a.amount||0)).map((item,i)=>{
    const pct=Math.round((item.amount||0)/total*100)
    const color=CAT_COLORS[item.cat||item.name]||COLOR_POOL[i%COLOR_POOL.length]
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
          <div style={{ height:5, borderRadius:99, width:`${pct}%`, background:color }}/>
        </div>
      </div>
    )
  })
}
function MiniChart({ months, revData, expData }) {
  const max=Math.max(...revData,...expData,1)
  return (
    <div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:100 }}>
        {months.map((m,i)=>(
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
            <div style={{ width:'100%', display:'flex', gap:1, alignItems:'flex-end' }}>
              <div style={{ flex:1, background:'#1D9E75', borderRadius:'2px 2px 0 0', height:`${Math.round(revData[i]/max*88)}px`, minHeight:2 }}/>
              <div style={{ flex:1, background:'#D85A30', borderRadius:'2px 2px 0 0', height:`${Math.round(expData[i]/max*88)}px`, minHeight:2 }}/>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:4, marginTop:4 }}>
        {months.map((m,i)=><div key={i} style={{ flex:1, textAlign:'center', fontSize:10, color:'#475569' }}>{m}</div>)}
      </div>
    </div>
  )
}

// ── 구독 폼 ─────────────────────────────────────────────────────────────────
function SubForm({ initial, expCats, onSave, onClose }) {
  const [form, setForm] = useState({
    name:initial?.name||'', amount:initial?.amount?.toString()||'',
    period:initial?.period||'monthly', subCat:initial?.subCat||'업무도구',
    renewalDate:initial?.renewalDate||'', startDate:initial?.startDate||'',
    endDate:initial?.endDate||'', active:initial?.active!==false, memo:initial?.memo||'',
    // 내역 연동
    linkedDate:initial?.linkedDate||new Date().toISOString().slice(0,10),
    linkedCat:initial?.linkedCat||'', tax:initial?.tax||'taxable', biz:initial?.biz||'biz',
    createEntry:initial?.id?false:true, // 새로 추가시 내역도 자동 생성
  })
  const set=(k,v)=>setForm(f=>({...f,[k]:v}))
  const amt=parseFloat(form.amount)||0
  const monthly=calcMonthlyAmt({...form,amount:amt})
  const months=form.period==='custom'?calcSubMonths({...form}):form.period==='yearly'?12:1

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12, maxHeight:'80vh', overflowY:'auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
        <h3 style={{ fontSize:16, fontWeight:700, color:'#f1f5f9' }}>{initial?.id?'✏️ 구독 수정':'➕ 구독 추가'}</h3>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'#64748b', fontSize:20, cursor:'pointer' }}>✕</button>
      </div>
      <div>
        <label style={lbl}>구독 주기</label>
        <div style={{ display:'flex', background:'#0a1120', border:'1px solid #1e2e50', borderRadius:9, padding:3 }}>
          {[['monthly','월 구독'],['yearly','연 구독'],['custom','사용자 지정']].map(([v,l])=>(
            <button key={v} onClick={()=>set('period',v)} style={{ flex:1, padding:'8px', border:'none', borderRadius:7, background:form.period===v?'rgba(124,58,237,0.25)':'transparent', color:form.period===v?'#a78bfa':'#64748b', fontWeight:600, fontSize:12, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div><label style={lbl}>서비스명 *</label><input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="예: Adobe CC" style={iS}/></div>
        <div><label style={lbl}>{form.period==='monthly'?'월 금액':form.period==='yearly'?'연 금액':'총 금액'} *</label>
          <input type="number" value={form.amount} onChange={e=>set('amount',e.target.value)} placeholder="0" style={iS}/></div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div><label style={lbl}>구독 카테고리</label>
          <select value={form.subCat} onChange={e=>set('subCat',e.target.value)} style={iS}>
            {SUB_CATS.map(c=><option key={c} value={c} style={{background:'#111d35'}}>{c}</option>)}
          </select>
        </div>
        {form.period!=='custom'
          ? <div><label style={lbl}>다음 갱신일</label><input type="date" value={form.renewalDate} onChange={e=>set('renewalDate',e.target.value)} style={iS}/></div>
          : <div><label style={lbl}>메모</label><input value={form.memo} onChange={e=>set('memo',e.target.value)} placeholder="3년 약정 등" style={iS}/></div>}
      </div>
      {form.period==='custom'&&(
        <div style={{ background:'rgba(124,58,237,0.06)', border:'1px solid rgba(124,58,237,0.2)', borderRadius:9, padding:12 }}>
          <div style={{ fontSize:12, color:'#a78bfa', fontWeight:600, marginBottom:10 }}>📅 구독 기간</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lbl}>시작일 *</label><input type="date" value={form.startDate} onChange={e=>set('startDate',e.target.value)} style={iS}/></div>
            <div><label style={lbl}>종료일 *</label><input type="date" value={form.endDate} onChange={e=>set('endDate',e.target.value)} style={iS}/></div>
          </div>
          {form.startDate&&form.endDate&&<div style={{ marginTop:8, fontSize:12, color:'#a78bfa' }}>총 {months}개월</div>}
        </div>
      )}
      {form.period==='monthly'&&<div><label style={lbl}>메모 (선택)</label><input value={form.memo} onChange={e=>set('memo',e.target.value)} placeholder="추가 메모" style={iS}/></div>}
      <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, color:'#e2e8f0' }}>
        <input type="checkbox" checked={form.active} onChange={e=>set('active',e.target.checked)} style={{ width:15, height:15, accentColor:'#1D9E75' }}/>
        활성 구독
      </label>

      {/* 내역 자동 연동 */}
      {!initial?.id&&(
        <div style={{ background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.15)', borderRadius:9, padding:12 }}>
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', marginBottom:form.createEntry?10:0 }}>
            <input type="checkbox" checked={form.createEntry} onChange={e=>set('createEntry',e.target.checked)} style={{ width:15, height:15, accentColor:'#3b82f6' }}/>
            <span style={{ fontSize:13, fontWeight:600, color:'#93c5fd' }}>수입/지출 내역에도 자동 추가</span>
          </label>
          {form.createEntry&&(
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              <div><label style={lbl}>날짜</label><input type="date" value={form.linkedDate} onChange={e=>set('linkedDate',e.target.value)} style={iS}/></div>
              <div><label style={lbl}>지출 카테고리</label>
                <select value={form.linkedCat} onChange={e=>set('linkedCat',e.target.value)} style={iS}>
                  <option value="">선택</option>
                  {expCats.map(c=><option key={c} value={c} style={{background:'#111d35'}}>{c}</option>)}
                </select>
              </div>
              <div><label style={lbl}>과세 여부</label>
                <select value={form.tax} onChange={e=>set('tax',e.target.value)} style={iS}>
                  <option value="taxable" style={{background:'#111d35'}}>과세</option>
                  <option value="exempt" style={{background:'#111d35'}}>면세</option>
                  <option value="inclusive" style={{background:'#111d35'}}>부가세포함</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {amt>0&&(
        <div style={{ background:'#0a1120', borderRadius:8, padding:'10px 12px', fontSize:12, color:'#64748b', lineHeight:2 }}>
          <div>월 환산: <span style={{ color:'#a78bfa', fontWeight:600 }}>{fmt(monthly)}/월</span></div>
          <div>연간: <span style={{ color:'#a78bfa', fontWeight:600 }}>{fmt(monthly*12)}/년</span></div>
        </div>
      )}
      <div style={{ display:'flex', gap:10, marginTop:4 }}>
        <button onClick={onClose} style={{ flex:1, padding:11, border:'1px solid #334155', borderRadius:9, background:'transparent', color:'#94a3b8', fontWeight:600, fontSize:14, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>취소</button>
        <button onClick={()=>onSave({...form,amount:parseFloat(form.amount)||0})} style={{ flex:2, padding:11, border:'none', borderRadius:9, background:'linear-gradient(135deg,#7c3aed,#6d28d9)', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>저장하기</button>
      </div>
    </div>
  )
}

// ── 내역 폼 ─────────────────────────────────────────────────────────────────
function EntryForm({ initial, incCats, expCats, onSave, onClose }) {
  const [type, setType] = useState(initial?.type||'expense')
  const [form, setForm] = useState({
    date:initial?.date||new Date().toISOString().slice(0,10),
    cat:initial?.cat||'', client:initial?.client||'', tax:initial?.tax||'taxable',
    amount:initial?.amount?.toString()||'', biz:initial?.biz||'biz', memo:initial?.memo||'',
    isSubscription:initial?.isSubscription||false, subPeriod:initial?.subPeriod||'monthly',
    subCat:initial?.subCat||'업무도구', renewalDate:initial?.renewalDate||'',
    startDate:initial?.startDate||'', endDate:initial?.endDate||'',
    createSubRecord:initial?.isSubscription?false:false, // 구독탭에도 추가할지
  })
  const set=(k,v)=>setForm(f=>({...f,[k]:v}))
  const curCats=type==='income'?incCats:expCats
  const amt=parseFloat(form.amount)||0
  const vat=calcVAT(amt,form.tax)
  const supply=supplyAmt(amt,form.tax)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12, maxHeight:'80vh', overflowY:'auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
        <h3 style={{ fontSize:16, fontWeight:700, color:'#f1f5f9' }}>{initial?.id?'✏️ 내역 수정':'➕ 내역 추가'}</h3>
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
        <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', marginBottom:form.isSubscription?10:0 }}>
          <input type="checkbox" checked={form.isSubscription} onChange={e=>set('isSubscription',e.target.checked)} style={{ width:15, height:15, accentColor:'#7c3aed' }}/>
          <span style={{ fontSize:13, fontWeight:600, color:'#a78bfa' }}>구독 서비스</span>
          <span style={{ fontSize:11, color:'#64748b' }}>체크 시 구독 탭에 자동 연동</span>
        </label>
        {form.isSubscription&&(
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ display:'flex', gap:8 }}>
              {[['monthly','월 구독'],['yearly','연 구독'],['custom','사용자 지정']].map(([v,l])=>(
                <button key={v} onClick={()=>set('subPeriod',v)} style={{ flex:1, padding:'6px', border:`1px solid ${form.subPeriod===v?'rgba(124,58,237,0.5)':'#1e2e50'}`, borderRadius:7, background:form.subPeriod===v?'rgba(124,58,237,0.2)':'transparent', color:form.subPeriod===v?'#a78bfa':'#64748b', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>{l}</button>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div><label style={lbl}>구독 카테고리</label>
                <select value={form.subCat} onChange={e=>set('subCat',e.target.value)} style={iS}>
                  {SUB_CATS.map(c=><option key={c} value={c} style={{background:'#111d35'}}>{c}</option>)}
                </select>
              </div>
              {form.subPeriod!=='custom'
                ? <div><label style={lbl}>갱신일 (선택)</label><input type="date" value={form.renewalDate} onChange={e=>set('renewalDate',e.target.value)} style={iS}/></div>
                : <div/>}
            </div>
            {form.subPeriod==='custom'&&(
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div><label style={lbl}>시작일</label><input type="date" value={form.startDate} onChange={e=>set('startDate',e.target.value)} style={iS}/></div>
                <div><label style={lbl}>종료일</label><input type="date" value={form.endDate} onChange={e=>set('endDate',e.target.value)} style={iS}/></div>
              </div>
            )}
          </div>
        )}
      </div>

      {amt>0&&form.tax!=='exempt'&&(
        <div style={{ background:'#0a1120', borderRadius:8, padding:'10px 12px', fontSize:12, color:'#64748b', lineHeight:1.8 }}>
          {form.tax==='taxable'&&<>공급가액 <span style={{color:'#e2e8f0'}}>{fmt(amt)}</span> + 부가세 <span style={{color:'#a78bfa'}}>{fmt(vat)}</span> = 합계 <span style={{color:'#4ade80'}}>{fmt(amt+vat)}</span></>}
          {form.tax==='inclusive'&&<>총액 <span style={{color:'#e2e8f0'}}>{fmt(amt)}</span> → 공급가액 <span style={{color:'#93c5fd'}}>{fmt(supply)}</span> + 부가세 <span style={{color:'#a78bfa'}}>{fmt(vat)}</span></>}
        </div>
      )}
      <div style={{ display:'flex', gap:10, marginTop:4 }}>
        <button onClick={onClose} style={{ flex:1, padding:11, border:'1px solid #334155', borderRadius:9, background:'transparent', color:'#94a3b8', fontWeight:600, fontSize:14, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>취소</button>
        <button onClick={()=>onSave({...form,type,amount:parseFloat(form.amount)||0})} style={{ flex:2, padding:11, border:'none', borderRadius:9, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>저장하기</button>
      </div>
    </div>
  )
}

// ── 메인 페이지 ─────────────────────────────────────────────────────────────
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
  const [fxForm, setFxForm] = useState({ name:'', amount:'', cat:'', isSubscription:false, subPeriod:'monthly', renewalDate:'', startDate:'', endDate:'', subCat:'업무도구' })
  const [calSelected, setCalSelected] = useState(null)
  const [subFilter, setSubFilter] = useState('all')
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),2500) }

  const now = new Date()
  const [viewMonth, setViewMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`)
  const [viewY, viewM] = viewMonth.split('-').map(Number)

  useEffect(() => {
    const u1=onSnapshot(collection(db,'accounting_entries'), snap=>setEntries(snap.docs.map(d=>({...d.data(),id:d.id})).sort((a,b)=>b.date?.localeCompare(a.date))))
    const u2=onSnapshot(collection(db,'accounting_fixed'), snap=>setFixedCosts(snap.docs.map(d=>({...d.data(),id:d.id}))))
    const u3=onSnapshot(collection(db,'accounting_subscriptions'), snap=>setSubscriptions(snap.docs.map(d=>({...d.data(),id:d.id}))))
    const u4=onSnapshot(doc(db,'accounting_settings','main'), snap=>{ if(snap.exists()){const d=snap.data(); if(d.incCats)setIncCats(d.incCats); if(d.expCats)setExpCats(d.expCats); if(d.budget!==undefined)setBudgetState(d.budget)} })
    return ()=>{ u1(); u2(); u3(); u4() }
  }, [])

  const saveSettings = async u => { await setDoc(doc(db,'accounting_settings','main'),u,{merge:true}) }

  // ── 모든 구독을 하나로 합산 (3개 소스) ─────────────────────────────────────
  // 1) 전용 구독 (accounting_subscriptions)
  const dedicatedSubs = subscriptions.map(s=>({...s, source:'sub'}))
  // 2) 고정비 구독 (accounting_fixed where isSubscription=true)
  const fixedSubs = fixedCosts.filter(f=>f.isSubscription).map(f=>({
    id:`fx_${f.id}`, name:f.name, amount:f.amount,
    period:f.subPeriod||'monthly', subCat:f.subCat||'기타',
    renewalDate:f.renewalDate||'', startDate:f.startDate||'', endDate:f.endDate||'',
    active:f.active!==false, memo:'', source:'fixed', originalId:f.id,
  }))
  // 3) 내역 구독 (accounting_entries where isSubscription=true) — 중복 방지: 같은 이름+기간이 전용구독에 없는 것만
  const entrySubs = entries.filter(e=>e.isSubscription).reduce((acc,e)=>{
    const key=`${e.memo||e.cat}_${e.subPeriod||'monthly'}`
    if (!acc.seen.has(key)) {
      acc.seen.add(key)
      acc.list.push({
        id:`entry_${e.id}`, name:e.memo||e.cat, amount:e.amount,
        period:e.subPeriod||'monthly', subCat:e.subCat||'기타',
        renewalDate:e.renewalDate||'', startDate:e.startDate||'', endDate:e.endDate||'',
        active:true, memo:'', source:'entry', originalId:e.id,
        linkedEntryDate:e.date,
      })
    }
    return acc
  }, {seen:new Set(), list:[]}).list
  // 전용구독과 이름이 겹치는 내역구독은 제외
  const dedicatedNames = new Set(dedicatedSubs.map(s=>`${s.name}_${s.period}`))
  const filteredEntrySubs = entrySubs.filter(s=>!dedicatedNames.has(`${s.name}_${s.period}`))
  const allSubs = [...dedicatedSubs, ...fixedSubs, ...filteredEntrySubs]
  const activeSubs = allSubs.filter(s=>s.active!==false&&!isExpired(s))
  const monthlySubs = activeSubs.filter(s=>s.period==='monthly')
  const yearlySubs  = activeSubs.filter(s=>s.period==='yearly')
  const customSubs  = activeSubs.filter(s=>s.period==='custom')
  const monthlyTotal  = monthlySubs.reduce((s,sub)=>s+sub.amount,0)
  const yearlyTotal   = yearlySubs.reduce((s,sub)=>s+sub.amount,0)
  const customMonthly = customSubs.reduce((s,sub)=>s+calcMonthlyAmt(sub),0)
  const totalMonthlyEquivalent = monthlyTotal + Math.round(yearlyTotal/12) + Math.round(customMonthly)
  const annualTotal   = monthlyTotal*12 + yearlyTotal + customSubs.reduce((s,sub)=>s+calcMonthlyAmt(sub)*12,0)

  const expiredSubs = allSubs.filter(s=>isExpired(s))
  const alertSubs   = allSubs.filter(s=>s.active!==false&&!isExpired(s)).map(s=>({...s,days:daysUntilEnd(s)})).filter(s=>s.days!==null&&s.days<=90).sort((a,b)=>a.days-b.days)

  // ── 재무 계산 ──────────────────────────────────────────────────────────────
  const monthEntries = entries.filter(e=>e.date?.startsWith(viewMonth))
  const revenue   = monthEntries.filter(e=>e.type==='income').reduce((s,e)=>s+e.amount,0)
  const varExp    = monthEntries.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amount,0)
  const fixedSubAmt = fixedCosts.filter(f=>f.isSubscription).reduce((s,f)=>s+f.amount,0)
  const fixedNonSubAmt = fixedCosts.filter(f=>!f.isSubscription).reduce((s,f)=>s+f.amount,0)
  const fixedTotalAmt = fixedSubAmt + fixedNonSubAmt
  const totalExp  = varExp + fixedTotalAmt
  const profit    = revenue - totalExp
  const vatPay    = Math.max(
    monthEntries.filter(e=>e.type==='income'&&e.tax!=='exempt').reduce((s,e)=>s+calcVAT(e.amount,e.tax),0) -
    monthEntries.filter(e=>e.type==='expense'&&e.tax!=='exempt').reduce((s,e)=>s+calcVAT(e.amount,e.tax),0), 0
  )
  const budgetPct = budget ? Math.min(Math.round(totalExp/budget*100),100) : 0

  const months6 = Array.from({length:6},(_,i)=>{ const d=new Date(now.getFullYear(),now.getMonth()-5+i,1); return {y:d.getFullYear(),m:d.getMonth(),label:(d.getMonth()+1)+'월'} })
  const revData  = months6.map(({y,m})=>entries.filter(e=>{ const d=new Date(e.date); return d.getFullYear()===y&&d.getMonth()===m&&e.type==='income' }).reduce((s,e)=>s+e.amount,0))
  const expData  = months6.map(({y,m})=>entries.filter(e=>{ const d=new Date(e.date); return d.getFullYear()===y&&d.getMonth()===m&&e.type==='expense' }).reduce((s,e)=>s+e.amount,0)+fixedTotalAmt)

  const expCatTotals = {}
  monthEntries.filter(e=>e.type==='expense').forEach(e=>{ expCatTotals[e.cat]=(expCatTotals[e.cat]||0)+e.amount })
  fixedCosts.forEach(f=>{ expCatTotals[f.cat]=(expCatTotals[f.cat]||0)+f.amount })
  const catChartData = Object.entries(expCatTotals).map(([cat,amount])=>({cat,amount}))

  const subCatBreakdown = {}
  activeSubs.forEach(s=>{ const mo=calcMonthlyAmt(s); subCatBreakdown[s.subCat||'기타']=(subCatBreakdown[s.subCat||'기타']||0)+mo })

  // ── 저장 함수 ──────────────────────────────────────────────────────────────
  const saveEntry = async (form, existingId) => {
    const id = existingId||`entry_${Date.now()}`
    const data = {...form, createdAt:serverTimestamp(), createdBy:user.id}
    await setDoc(doc(db,'accounting_entries',id), data, {merge:true})
    // 구독 체크된 경우 accounting_subscriptions에도 자동 upsert (이름 기준)
    if (form.isSubscription) {
      const subKey = `autosub_${(form.memo||form.cat).replace(/\s/g,'_')}_${form.subPeriod||'monthly'}`
      await setDoc(doc(db,'accounting_subscriptions',subKey), {
        name:form.memo||form.cat, amount:form.amount, period:form.subPeriod||'monthly',
        subCat:form.subCat||'기타', renewalDate:form.renewalDate||'',
        startDate:form.startDate||'', endDate:form.endDate||'',
        active:true, memo:'', source:'entry', autoCreated:true,
      }, {merge:true})
    }
    await logActivity({userId:user.id, userName:user.name, action:existingId?'가계부 수정':'가계부 추가', itemDesc:form.memo||form.cat})
    showToast(existingId?'✅ 수정되었습니다':'✅ 추가되었습니다'); setModal(null)
  }

  const delEntry = async id => { await deleteDoc(doc(db,'accounting_entries',id)); showToast('🗑️ 삭제되었습니다') }

  const saveSub = async (form, existingId) => {
    const id = existingId||`sub_${Date.now()}`
    await setDoc(doc(db,'accounting_subscriptions',id), {...form, updatedAt:serverTimestamp()}, {merge:true})
    // 내역에도 자동 추가 옵션
    if (!existingId && form.createEntry && form.linkedDate) {
      const entryId = `entry_${Date.now()}_sub`
      const entryAmt = form.period==='monthly' ? form.amount : form.period==='yearly' ? Math.round(form.amount/12) : calcMonthlyAmt(form)
      await setDoc(doc(db,'accounting_entries',entryId), {
        type:'expense', date:form.linkedDate, cat:form.linkedCat||'구독 서비스',
        amount:form.period==='monthly'?form.amount:form.amount,
        tax:form.tax||'taxable', biz:'biz', memo:form.name,
        isSubscription:true, subPeriod:form.period, subCat:form.subCat,
        createdAt:serverTimestamp(), createdBy:user.id,
      })
    }
    showToast(existingId?'✅ 구독이 수정되었습니다':'✅ 구독이 추가되었습니다'); setSubModal(null)
  }

  const delSub = async (s) => {
    if (s.source==='fixed') { await updateDoc(doc(db,'accounting_fixed',s.originalId),{isSubscription:false}); }
    else if (s.source==='entry') { await updateDoc(doc(db,'accounting_entries',s.originalId),{isSubscription:false}); }
    else { await deleteDoc(doc(db,'accounting_subscriptions',s.id)); }
    showToast('🗑️ 구독이 삭제되었습니다')
  }

  const toggleSubActive = async s => {
    if (s.source==='fixed') { await updateDoc(doc(db,'accounting_fixed',s.originalId),{active:!s.active}) }
    else if (s.source==='entry') { /* entry는 개별 토글 불필요 */ }
    else { await updateDoc(doc(db,'accounting_subscriptions',s.id),{active:!s.active}) }
    showToast(s.active?'구독이 비활성화되었습니다':'구독이 활성화되었습니다')
  }

  const addFixed = async () => {
    if (!fxForm.name||!fxForm.amount) { showToast('항목명과 금액을 입력해주세요'); return }
    await setDoc(doc(db,'accounting_fixed',`fixed_${Date.now()}`),{...fxForm,amount:parseFloat(fxForm.amount)})
    setFxForm({name:'',amount:'',cat:'',isSubscription:false,subPeriod:'monthly',renewalDate:'',startDate:'',endDate:'',subCat:'업무도구'})
    showToast('✅ 고정비가 추가되었습니다')
  }
  const delFixed = async id => { await deleteDoc(doc(db,'accounting_fixed',id)); showToast('🗑️ 삭제되었습니다') }

  const handleSetBudget = async () => {
    const v=parseFloat(budgetInput)||0; setBudgetState(v); await saveSettings({budget:v}); setBudgetInput(''); showToast('✅ 예산이 설정되었습니다')
  }
  const addCat = async type => {
    const name=newCat[type].trim(); if(!name) return
    const updated=type==='income'?[...incCats,name]:[...expCats,name]
    type==='income'?setIncCats(updated):setExpCats(updated)
    await saveSettings(type==='income'?{incCats:updated}:{expCats:updated})
    setNewCat(n=>({...n,[type]:''})); showToast('✅ 추가되었습니다')
  }
  const delCat = async (type,cat) => {
    const updated=type==='income'?incCats.filter(c=>c!==cat):expCats.filter(c=>c!==cat)
    type==='income'?setIncCats(updated):setExpCats(updated)
    await saveSettings(type==='income'?{incCats:updated}:{expCats:updated}); showToast('🗑️ 삭제되었습니다')
  }
  const updateCat = async (type,oldCat,newName) => {
    const updated=type==='income'?incCats.map(c=>c===oldCat?newName:c):expCats.map(c=>c===oldCat?newName:c)
    type==='income'?setIncCats(updated):setExpCats(updated)
    await saveSettings(type==='income'?{incCats:updated}:{expCats:updated}); setEditCat(null); showToast('✅ 수정되었습니다')
  }

  const navMonth = d => {
    const [y,m]=viewMonth.split('-').map(Number), nd=new Date(y,m-1+d,1)
    setViewMonth(`${nd.getFullYear()}-${String(nd.getMonth()+1).padStart(2,'0')}`); setCalSelected(null)
  }

  const exportExcel = () => {
    const wb = XLSX.utils.book_new()
    const ws1 = XLSX.utils.aoa_to_sheet([
      ['날짜','구분','카테고리','거래처','금액','공급가액','부가세','업무구분','구독여부','구독주기','메모'],
      ...monthEntries.map(e=>[e.date,e.type==='income'?'수입':'지출',e.cat,e.client||'',e.amount,supplyAmt(e.amount,e.tax),calcVAT(e.amount,e.tax),e.biz==='biz'?'업무용':'개인용',e.isSubscription?'구독':'일반',e.subPeriod||'',e.memo||'']),
      ...fixedCosts.map(f=>['-','지출(고정)',f.cat,'',f.amount,f.amount,0,'업무용',f.isSubscription?'구독(고정)':'고정비','',f.name])
    ])
    ws1['!cols']=[12,8,12,12,14,14,12,8,10,10,16].map(w=>({wch:w}))
    XLSX.utils.book_append_sheet(wb,ws1,'거래내역')
    const ws2 = XLSX.utils.aoa_to_sheet([
      ['항목','금액'],['총 매출',revenue],['총 지출',totalExp],['순이익',profit],
      ['납부 부가세',Math.round(vatPay)],['예산',budget||'-'],['예산 소진율',budget?budgetPct+'%':'-'],['',''],
      ['구독 현황',''],['월 구독 합계',monthlyTotal],['연 구독 합계',yearlyTotal],
      ['사용자지정 월환산',Math.round(customMonthly)],['연간 구독 총액',annualTotal],['월 예상 고정 지출',totalMonthlyEquivalent],
    ])
    ws2['!cols']=[{wch:22},{wch:16}]
    XLSX.utils.book_append_sheet(wb,ws2,'요약')
    const ws3 = XLSX.utils.aoa_to_sheet([
      ['서비스명','구독주기','금액','월환산','카테고리','시작일','종료/갱신일','출처','상태'],
      ...allSubs.map(s=>[s.name,s.period==='monthly'?'월':s.period==='yearly'?'연':'사용자지정',s.amount,calcMonthlyAmt(s),s.subCat||'',s.startDate||'',s.endDate||s.renewalDate||'',s.source==='fixed'?'고정비':s.source==='entry'?'내역':'전용',s.active!==false&&!isExpired(s)?'활성':'비활성'])
    ])
    ws3['!cols']=[{wch:20},{wch:10},{wch:14},{wch:14},{wch:12},{wch:12},{wch:14},{wch:8},{wch:8}]
    XLSX.utils.book_append_sheet(wb,ws3,'구독현황')
    XLSX.writeFile(wb,`가계부_${viewMonth}.xlsx`)
    showToast('📥 엑셀 파일이 다운로드되었습니다')
  }

  const filtered = monthEntries.filter(e=>{
    if(filterType!=='all'&&e.type!==filterType) return false
    if(filterBiz!=='all'&&e.biz!==filterBiz) return false
    return true
  })
  const filteredSubs = allSubs.filter(s=>{
    if(subFilter==='monthly') return s.period==='monthly'&&s.active!==false&&!isExpired(s)
    if(subFilter==='yearly') return s.period==='yearly'&&s.active!==false&&!isExpired(s)
    if(subFilter==='custom') return s.period==='custom'&&s.active!==false&&!isExpired(s)
    if(subFilter==='inactive') return s.active===false||isExpired(s)
    return true
  })

  // Calendar
  const firstDay=new Date(viewY,viewM-1,1).getDay(), daysInMonth=new Date(viewY,viewM,0).getDate()
  const calCells=[]; for(let i=0;i<firstDay;i++) calCells.push(null); for(let d=1;d<=daysInMonth;d++) calCells.push(d); while(calCells.length%7!==0) calCells.push(null)
  const getDateStr=day=>`${viewY}-${String(viewM).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  const getDayE=day=>entries.filter(e=>e.date===getDateStr(day))
  const isToday=day=>day&&viewY===now.getFullYear()&&viewM-1===now.getMonth()&&day===now.getDate()
  const calSelE=calSelected?entries.filter(e=>e.date===calSelected):[]

  // ── 전체 누적 집계 ──────────────────────────────────────────────────────────
  const totalRevenue    = entries.filter(e=>e.type==='income').reduce((s,e)=>s+e.amount,0)
  const totalVarExp     = entries.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amount,0)
  const totalFixedMonths = (() => {
    if (!entries.length) return 0
    const dates = entries.map(e=>e.date).filter(Boolean).sort()
    if (!dates.length) return 0
    const first = new Date(dates[0])
    const last  = new Date(dates[dates.length-1])
    return Math.max(1, Math.round((last-first)/(1000*60*60*24*30.44))+1)
  })()
  const totalFixedExpEst = fixedTotalAmt * totalFixedMonths
  const totalAllExp      = totalVarExp + totalFixedExpEst
  const totalProfit      = totalRevenue - totalAllExp
  const totalVatPay      = Math.max(
    entries.filter(e=>e.type==='income'&&e.tax!=='exempt').reduce((s,e)=>s+calcVAT(e.amount,e.tax),0) -
    entries.filter(e=>e.type==='expense'&&e.tax!=='exempt').reduce((s,e)=>s+calcVAT(e.amount,e.tax),0), 0
  )
  // 연도별 집계
  const thisYear = now.getFullYear()
  const yearEntries = entries.filter(e=>e.date?.startsWith(String(thisYear)))
  const yearRevenue = yearEntries.filter(e=>e.type==='income').reduce((s,e)=>s+e.amount,0)
  const yearVarExp  = yearEntries.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amount,0)
  const yearFixedEst = fixedTotalAmt * now.getMonth() // 올해 지난 달 수
  const yearTotalExp = yearVarExp + yearFixedEst
  const yearProfit   = yearRevenue - yearTotalExp

  const TABS=[{id:'dashboard',label:'대시보드'},{id:'calendar',label:'달력 뷰'},{id:'ledger',label:'수입/지출'},{id:'subscription',label:'구독 관리'},{id:'vat',label:'부가세'},{id:'fixed',label:'고정비'},{id:'categories',label:'카테고리'}]

  // SubRow 컴포넌트
  const SubRow = ({s,idx,total}) => {
    const monthly=calcMonthlyAmt(s)
    const color=CAT_COLORS[s.subCat||'기타']||'#888'
    const inactive=s.active===false||isExpired(s)
    return (
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom:idx<total-1?'1px solid #192640':'none', opacity:inactive?0.55:1 }}>
        <div style={{ width:8, height:8, borderRadius:'50%', background:inactive?'#475569':color, flexShrink:0 }}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3, flexWrap:'wrap' }}>
            <span style={{ fontSize:13, fontWeight:600, color:'#e2e8f0' }}>{s.name}</span>
            <PeriodLabel sub={s}/>
            {s.subCat&&<span style={{ fontSize:10, color:'#475569' }}>{s.subCat}</span>}
            <SourceBadge source={s.source}/>
            {isExpired(s)&&<span style={{ fontSize:10, padding:'1px 6px', borderRadius:99, background:'rgba(239,68,68,0.1)', color:'#f87171' }}>종료됨</span>}
            <StatusBadge sub={s}/>
          </div>
          {s.period==='custom'&&s.startDate&&s.endDate&&<div style={{ fontSize:11, color:'#475569' }}>{s.startDate} ~ {s.endDate} ({calcSubMonths(s)}개월)</div>}
          {s.memo&&<div style={{ fontSize:11, color:'#475569' }}>{s.memo}</div>}
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#f87171' }}>{fmt(s.amount)}/{s.period==='monthly'?'월':s.period==='yearly'?'년':'총액'}</div>
          {s.period!=='monthly'&&<div style={{ fontSize:11, color:'#64748b' }}>월 환산 {fmt(monthly)}</div>}
        </div>
        <div style={{ display:'flex', gap:5, flexShrink:0 }}>
          {s.source!=='entry'&&<button onClick={()=>toggleSubActive(s)} style={{ padding:'4px 8px', background:inactive?'rgba(34,197,94,0.1)':'rgba(255,255,255,0.05)', border:`1px solid ${inactive?'rgba(34,197,94,0.2)':'#1e2e50'}`, borderRadius:6, color:inactive?'#4ade80':'#64748b', fontSize:11, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>{inactive?'활성화':'해지'}</button>}
          {s.source==='sub'&&<button onClick={()=>setSubModal(s)} style={{ padding:'4px 9px', background:'rgba(124,58,237,0.1)', border:'1px solid rgba(124,58,237,0.2)', borderRadius:6, color:'#a78bfa', fontSize:11, cursor:'pointer' }}>수정</button>}
          {s.source==='fixed'&&<button onClick={()=>{ setTab('fixed'); showToast('고정비 탭에서 수정해주세요') }} style={{ padding:'4px 8px', background:'transparent', border:'1px solid #1e2e50', borderRadius:6, color:'#64748b', fontSize:11, cursor:'pointer' }}>고정비로 이동</button>}
          {s.source==='entry'&&<button onClick={()=>{ setTab('ledger'); showToast('수입/지출 탭에서 수정해주세요') }} style={{ padding:'4px 8px', background:'transparent', border:'1px solid #1e2e50', borderRadius:6, color:'#64748b', fontSize:11, cursor:'pointer' }}>내역으로 이동</button>}
          <button onClick={()=>delSub(s)} style={{ padding:'4px 8px', background:'rgba(239,68,68,0.08)', border:'none', borderRadius:6, color:'#f87171', fontSize:11, cursor:'pointer' }}>제거</button>
        </div>
      </div>
    )
  }

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

        {/* DASHBOARD */}
        {tab==='dashboard'&&<>
          {/* 이번달 */}
          <div style={{ fontSize:12, fontWeight:700, color:'#64748b', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.5px' }}>이번달 ({viewMonth.replace('-','년 ')}월)</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:10, marginBottom:18 }}>
            <StatCard label="매출" value={fmt(revenue)} color="#4ade80"/>
            <StatCard label="지출" value={fmt(totalExp)} color="#f87171"/>
            <StatCard label="순이익" value={fmt(Math.abs(profit))} color={profit>=0?'#4ade80':'#f87171'} sub={profit>=0?'흑자':'적자'}/>
            <StatCard label="납부 부가세" value={fmt(Math.round(vatPay))} color="#60a5fa"/>
          </div>

          {/* 올해 */}
          <div style={{ fontSize:12, fontWeight:700, color:'#64748b', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.5px' }}>{thisYear}년 누계</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:10, marginBottom:18 }}>
            <StatCard label="연간 총 매출" value={fmt(yearRevenue)} color="#4ade80" sub={`고정비 ${now.getMonth()}개월 포함`}/>
            <StatCard label="연간 총 지출" value={fmt(yearTotalExp)} color="#f87171"/>
            <StatCard label="연간 순이익" value={fmt(Math.abs(yearProfit))} color={yearProfit>=0?'#4ade80':'#f87171'} sub={yearProfit>=0?'흑자':'적자'}/>
            <StatCard label="연간 납부 부가세" value={fmt(Math.round(totalVatPay))} color="#60a5fa" sub="전체 기간"/>
          </div>

          {/* 전체 누적 */}
          <div style={{ fontSize:12, fontWeight:700, color:'#64748b', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.5px' }}>전체 누적 (입력된 전체 내역)</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:10, marginBottom:18 }}>
            <StatCard label="누적 총 매출" value={fmt(totalRevenue)} color="#5DCAA5" sub={`${entries.filter(e=>e.type==='income').length}건`}/>
            <StatCard label="누적 총 지출" value={fmt(totalVarExp)} color="#fb923c" sub={`${entries.filter(e=>e.type==='expense').length}건 (변동비)`}/>
            <StatCard label="누적 순이익" value={fmt(Math.abs(totalRevenue-totalVarExp))} color={(totalRevenue-totalVarExp)>=0?'#5DCAA5':'#fb923c'} sub="변동비 기준"/>
            <StatCard label="전체 거래 건수" value={`${entries.length}건`} color="#94a3b8" sub={`수입 ${entries.filter(e=>e.type==='income').length} / 지출 ${entries.filter(e=>e.type==='expense').length}`}/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:10, marginBottom:18 }}>
            <StatCard label="월 구독 합계" value={fmt(monthlyTotal)} color="#a78bfa" sub={`${monthlySubs.length}개`}/>
            <StatCard label="연간 구독 총액" value={fmt(annualTotal)} color="#a78bfa" sub={`전체 ${activeSubs.length}개 (수입/지출+고정비+전용 합산)`}/>
            <StatCard label="월 예상 구독 고정 지출" value={fmt(totalMonthlyEquivalent)} color="#c084fc" sub="모든 구독 월환산"/>
          </div>
          {expiredSubs.length>0&&(
            <div style={{ background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:12, padding:'12px 16px', marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#f87171', marginBottom:8 }}>🔴 종료된 구독 ({expiredSubs.length}건)</div>
              {expiredSubs.map(s=><div key={s.id} style={{ fontSize:12, color:'#94a3b8', marginBottom:3 }}>• {s.name} ({s.endDate} 종료)</div>)}
            </div>
          )}
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

        {/* CALENDAR */}
        {tab==='calendar'&&<>
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
                if(!day) return <div key={idx} style={{ minHeight:90, background:'rgba(0,0,0,0.15)', borderRight:(idx%7)<6?'1px solid #192640':'none', borderBottom:Math.floor(idx/7)<Math.floor((calCells.length-1)/7)?'1px solid #192640':'none' }}/>
                const ds=getDateStr(day), dayE=getDayE(day)
                const dayInc=dayE.filter(e=>e.type==='income').reduce((s,e)=>s+e.amount,0)
                const dayExp=dayE.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amount,0)
                const today=isToday(day), sel=calSelected===ds, col=idx%7
                return (
                  <div key={idx} onClick={()=>setCalSelected(sel?null:ds)}
                    style={{ minHeight:90, padding:6, borderRight:col<6?'1px solid #192640':'none', borderBottom:Math.floor(idx/7)<Math.floor((calCells.length-1)/7)?'1px solid #192640':'none', background:sel?'rgba(59,130,246,0.08)':today?'rgba(59,130,246,0.05)':'transparent', cursor:'pointer', outline:sel?'2px solid rgba(59,130,246,0.4)':'none', outlineOffset:-2 }}
                    onMouseEnter={e=>{if(!sel)e.currentTarget.style.background='rgba(255,255,255,0.02)'}}
                    onMouseLeave={e=>{e.currentTarget.style.background=sel?'rgba(59,130,246,0.08)':today?'rgba(59,130,246,0.05)':'transparent'}}>
                    <div style={{ marginBottom:4 }}>
                      {today?<span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:20, height:20, borderRadius:'50%', background:'#3b82f6', color:'#fff', fontSize:11, fontWeight:700 }}>{day}</span>
                        :<span style={{ fontSize:12, fontWeight:500, color:col===0?'#f87171':col===6?'#60a5fa':'#94a3b8' }}>{day}</span>}
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
          {calSelected&&(
            <div style={cardS}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                <span style={{ fontSize:14, fontWeight:600, color:'#cbd5e1' }}>{parseInt(calSelected.split('-')[2])}일 내역 ({calSelE.length}건)</span>
                <button onClick={()=>setModal({date:calSelected})} style={{ marginLeft:'auto', padding:'6px 14px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:7, color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>+ 이 날 추가</button>
              </div>
              {calSelE.length===0?<div style={{ textAlign:'center', padding:'20px 0', color:'#475569', fontSize:13 }}>내역이 없습니다</div>
                :calSelE.map((e,idx)=>{
                  const tc=TAX_COLORS[e.tax]||TAX_COLORS.exempt
                  return (
                    <div key={e.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:idx<calSelE.length-1?'1px solid #192640':'none' }}>
                      <div style={{ width:7, height:7, borderRadius:'50%', background:e.type==='income'?'#1D9E75':'#D85A30', flexShrink:0 }}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:2, flexWrap:'wrap' }}>
                          <span style={{ fontSize:11, color:'#64748b' }}>{e.cat}</span>
                          <span style={{ fontSize:10, padding:'1px 6px', borderRadius:99, background:tc.bg, color:tc.color }}>{TAX_LABELS[e.tax]||e.tax}</span>
                          {e.isSubscription&&<span style={{ fontSize:10, padding:'1px 6px', borderRadius:99, background:'rgba(124,58,237,0.15)', color:'#a78bfa' }}>구독</span>}
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

        {/* LEDGER */}
        {tab==='ledger'&&<>
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
            {filtered.length===0?<div style={{ textAlign:'center', padding:'30px 0', color:'#475569', fontSize:13 }}>내역이 없습니다</div>
              :filtered.map((e,idx)=>{
                const tc=TAX_COLORS[e.tax]||TAX_COLORS.exempt
                return (
                  <div key={e.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 0', borderBottom:idx<filtered.length-1?'1px solid #192640':'none' }}>
                    <div style={{ width:7, height:7, borderRadius:'50%', background:e.type==='income'?'#1D9E75':'#D85A30', flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:2, flexWrap:'wrap' }}>
                        <span style={{ fontSize:11, color:'#64748b' }}>{e.cat}</span>
                        {e.client&&<span style={{ fontSize:10, color:'#475569' }}>{e.client}</span>}
                        <span style={{ fontSize:10, padding:'1px 6px', borderRadius:99, background:tc.bg, color:tc.color }}>{TAX_LABELS[e.tax]||e.tax}</span>
                        <span style={{ fontSize:10, padding:'1px 6px', borderRadius:99, background:e.biz==='biz'?'rgba(34,197,94,0.12)':'rgba(245,158,11,0.12)', color:e.biz==='biz'?'#4ade80':'#fbbf24' }}>{e.biz==='biz'?'업무':'개인'}</span>
                        {e.isSubscription&&<span style={{ fontSize:10, padding:'1px 6px', borderRadius:99, background:'rgba(124,58,237,0.15)', color:'#a78bfa' }}>구독</span>}
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

        {/* SUBSCRIPTION */}
        {tab==='subscription'&&<>
          <div style={{ background:'rgba(124,58,237,0.06)', border:'1px solid rgba(124,58,237,0.2)', borderRadius:14, padding:'20px 22px', marginBottom:18 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#a78bfa', marginBottom:16 }}>📦 연간 구독 비용 분석 <span style={{ fontSize:11, color:'#475569', fontWeight:400 }}>(수입/지출 + 고정비 + 전용 구독 전체 합산)</span></div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
              <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:9, padding:12 }}>
                <div style={{ fontSize:11, color:'#64748b', marginBottom:6 }}>월 구독</div>
                <div style={{ fontSize:16, fontWeight:700, color:'#93c5fd' }}>{fmt(monthlyTotal)}/월</div>
                <div style={{ fontSize:11, color:'#475569', marginTop:3 }}>{monthlySubs.length}개</div>
              </div>
              <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:9, padding:12 }}>
                <div style={{ fontSize:11, color:'#64748b', marginBottom:6 }}>연 구독</div>
                <div style={{ fontSize:16, fontWeight:700, color:'#fbbf24' }}>{fmt(yearlyTotal)}/년</div>
                <div style={{ fontSize:11, color:'#475569', marginTop:3 }}>{yearlySubs.length}개 · 월환산 {fmt(Math.round(yearlyTotal/12))}</div>
              </div>
              <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:9, padding:12 }}>
                <div style={{ fontSize:11, color:'#64748b', marginBottom:6 }}>사용자 지정</div>
                <div style={{ fontSize:16, fontWeight:700, color:'#a78bfa' }}>{fmt(Math.round(customMonthly))}/월 환산</div>
                <div style={{ fontSize:11, color:'#475569', marginTop:3 }}>{customSubs.length}개</div>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={{ background:'rgba(124,58,237,0.1)', borderRadius:10, padding:'14px 16px' }}>
                <div style={{ fontSize:12, color:'#64748b', marginBottom:6 }}>1년간 예상 구독 유지비</div>
                <div style={{ fontSize:24, fontWeight:700, color:'#a78bfa' }}>{fmt(annualTotal)}</div>
              </div>
              <div style={{ background:'rgba(124,58,237,0.1)', borderRadius:10, padding:'14px 16px' }}>
                <div style={{ fontSize:12, color:'#64748b', marginBottom:6 }}>월 예상 구독 고정 지출</div>
                <div style={{ fontSize:24, fontWeight:700, color:'#c084fc' }}>{fmt(totalMonthlyEquivalent)}<span style={{ fontSize:13, fontWeight:400, color:'#64748b' }}>/월</span></div>
                <div style={{ fontSize:11, color:'#475569', marginTop:4 }}>월구독 {fmt(monthlyTotal)} + 연구독÷12 {fmt(Math.round(yearlyTotal/12))} + 사용자지정 {fmt(Math.round(customMonthly))}</div>
              </div>
            </div>
            {Object.keys(subCatBreakdown).length>0&&(
              <div style={{ marginTop:16 }}>
                <div style={{ fontSize:12, color:'#64748b', marginBottom:8 }}>카테고리별 월 환산 비용</div>
                <CatBar items={Object.entries(subCatBreakdown).map(([cat,amount])=>({cat,amount}))}/>
              </div>
            )}
          </div>
          {alertSubs.length>0&&(
            <div style={{ background:'rgba(251,191,36,0.05)', border:'1px solid rgba(251,191,36,0.2)', borderRadius:12, padding:'14px 16px', marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#fcd34d', marginBottom:10 }}>⚠️ 종료/갱신 임박 ({alertSubs.length}건, 90일 이내)</div>
              {alertSubs.map(s=>(
                <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                  <span style={{ fontSize:13, color:'#e2e8f0', flex:1 }}>{s.name}</span>
                  <span style={{ fontSize:12, color:'#64748b' }}>{fmt(s.amount)}</span>
                  <SourceBadge source={s.source}/>
                  <StatusBadge sub={s}/>
                </div>
              ))}
            </div>
          )}
          {expiredSubs.length>0&&(
            <div style={{ background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:12, padding:'14px 16px', marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#f87171', marginBottom:10 }}>🔴 종료된 구독 ({expiredSubs.length}건)</div>
              {expiredSubs.map(s=>(
                <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                  <span style={{ fontSize:13, color:'#94a3b8', flex:1 }}>{s.name}</span>
                  <SourceBadge source={s.source}/>
                  <span style={{ fontSize:11, color:'#f87171' }}>{s.endDate} 종료</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:8 }}>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {[['all','전체'],['monthly','월 구독'],['yearly','연 구독'],['custom','사용자 지정'],['inactive','비활성/종료']].map(([v,l])=>(
                <button key={v} onClick={()=>setSubFilter(v)} style={{ padding:'5px 12px', borderRadius:20, border:`1px solid ${subFilter===v?'#7c3aed':'#1e2e50'}`, background:subFilter===v?'rgba(124,58,237,0.15)':'transparent', color:subFilter===v?'#a78bfa':'#4a5568', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>{l}</button>
              ))}
            </div>
            <button onClick={()=>setSubModal('add')} style={{ padding:'8px 18px', background:'linear-gradient(135deg,#7c3aed,#6d28d9)', border:'none', borderRadius:8, color:'#fff', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>+ 구독 추가</button>
          </div>
          <div style={cardS}>
            {filteredSubs.length===0?<div style={{ textAlign:'center', padding:'30px 0', color:'#475569', fontSize:13 }}>구독 내역이 없습니다</div>
              :filteredSubs.map((s,idx)=><SubRow key={s.id} s={s} idx={idx} total={filteredSubs.length}/>)
            }
          </div>
        </>}

        {/* VAT */}
        {tab==='vat'&&<>
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
                if(!ms.includes(now.getMonth())) return null
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
              <div style={{ fontSize:11, color:'#475569', marginTop:12, lineHeight:1.7 }}>과세·부가세포함 항목에만 적용</div>
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

        {/* FIXED */}
        {tab==='fixed'&&<>
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
            <div style={{ padding:'12px 14px', background:'rgba(83,74,183,0.06)', border:'1px solid rgba(83,74,183,0.15)', borderRadius:9, marginBottom:10 }}>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', marginBottom:fxForm.isSubscription?10:0 }}>
                <input type="checkbox" checked={fxForm.isSubscription} onChange={e=>setFxForm(f=>({...f,isSubscription:e.target.checked}))} style={{ width:15, height:15, accentColor:'#7c3aed' }}/>
                <span style={{ fontSize:13, fontWeight:600, color:'#a78bfa' }}>구독 서비스</span>
                <span style={{ fontSize:11, color:'#64748b' }}>→ 구독 관리 탭에 자동 표시</span>
              </label>
              {fxForm.isSubscription&&(
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  <div style={{ display:'flex', gap:8 }}>
                    {[['monthly','월 구독'],['yearly','연 구독'],['custom','사용자 지정']].map(([v,l])=>(
                      <button key={v} onClick={()=>setFxForm(f=>({...f,subPeriod:v}))} style={{ flex:1, padding:'6px', border:`1px solid ${fxForm.subPeriod===v?'rgba(124,58,237,0.5)':'#1e2e50'}`, borderRadius:7, background:fxForm.subPeriod===v?'rgba(124,58,237,0.2)':'transparent', color:fxForm.subPeriod===v?'#a78bfa':'#64748b', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>{l}</button>
                    ))}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div><label style={lbl}>구독 카테고리</label>
                      <select value={fxForm.subCat} onChange={e=>setFxForm(f=>({...f,subCat:e.target.value}))} style={iS}>
                        {SUB_CATS.map(c=><option key={c} value={c} style={{background:'#111d35'}}>{c}</option>)}
                      </select>
                    </div>
                    {fxForm.subPeriod!=='custom'
                      ?<div><label style={lbl}>다음 갱신일</label><input type="date" value={fxForm.renewalDate} onChange={e=>setFxForm(f=>({...f,renewalDate:e.target.value}))} style={iS}/></div>
                      :<div/>}
                  </div>
                  {fxForm.subPeriod==='custom'&&(
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      <div><label style={lbl}>시작일</label><input type="date" value={fxForm.startDate} onChange={e=>setFxForm(f=>({...f,startDate:e.target.value}))} style={iS}/></div>
                      <div><label style={lbl}>종료일</label><input type="date" value={fxForm.endDate} onChange={e=>setFxForm(f=>({...f,endDate:e.target.value}))} style={iS}/></div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={addFixed} style={{ width:'100%', padding:'10px', border:'none', borderRadius:9, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>+ 고정비 추가</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div style={cardS}>
              <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>등록된 고정비</div>
              {fixedCosts.length===0?<div style={{ textAlign:'center', padding:'24px 0', color:'#475569', fontSize:13 }}>없습니다</div>
                :fixedCosts.map(f=>(
                  <div key={f.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid #192640' }}>
                    <div style={{ width:7, height:7, borderRadius:'50%', background:CAT_COLORS[f.cat]||'#888', flexShrink:0 }}/>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                        <span style={{ fontSize:13, fontWeight:500, color:'#e2e8f0' }}>{f.name}</span>
                        {f.isSubscription&&<span style={{ fontSize:10, padding:'1px 6px', borderRadius:99, background:'rgba(124,58,237,0.15)', color:'#a78bfa' }}>구독</span>}
                        {f.isSubscription&&<StatusBadge sub={{...f,period:f.subPeriod||'monthly'}}/>}
                      </div>
                      <div style={{ fontSize:11, color:'#64748b' }}>{f.cat}{f.isSubscription&&f.subCat?` · ${f.subCat}`:''}</div>
                    </div>
                    <span style={{ fontSize:13, fontWeight:600, color:'#f87171' }}>{fmt(f.amount)}/월</span>
                    <button onClick={()=>delFixed(f.id)} style={{ padding:'3px 8px', background:'rgba(239,68,68,0.08)', border:'none', borderRadius:6, color:'#f87171', fontSize:11, cursor:'pointer' }}>삭제</button>
                  </div>
                ))
              }
              {fixedCosts.length>0&&<div style={{ display:'flex', justifyContent:'space-between', paddingTop:12, borderTop:'1px solid #1e2e50', fontSize:13, fontWeight:600 }}><span style={{ color:'#64748b', fontWeight:400 }}>월 합계</span><span style={{ color:'#f87171' }}>{fmt(fixedCosts.reduce((s,f)=>s+f.amount,0))}</span></div>}
            </div>
            <div style={cardS}><div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>카테고리별 비중</div><CatBar items={fixedCosts.map(f=>({cat:f.cat,amount:f.amount}))}/></div>
          </div>
        </>}

        {/* CATEGORIES */}
        {tab==='categories'&&(
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
                      ?<><input defaultValue={cat} id={`ec_${type}_${i}`} style={{ ...iS, flex:1, padding:'5px 9px' }}/>
                          <button onClick={()=>{ const v=document.getElementById(`ec_${type}_${i}`).value.trim(); if(v) updateCat(type,cat,v) }} style={{ padding:'4px 10px', background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:6, color:'#4ade80', fontSize:11, cursor:'pointer' }}>저장</button>
                          <button onClick={()=>setEditCat(null)} style={{ padding:'4px 8px', background:'transparent', border:'1px solid #1e2e50', borderRadius:6, color:'#64748b', fontSize:11, cursor:'pointer' }}>취소</button></>
                      :<><span style={{ flex:1, fontSize:13, color:'#e2e8f0' }}>{cat}</span>
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

      {modal&&<Modal onClose={()=>setModal(null)}>
        <EntryForm initial={modal==='add'?(calSelected?{date:calSelected}:null):(typeof modal==='object'&&modal.date?modal:null)} incCats={incCats} expCats={expCats} onSave={form=>saveEntry(form,typeof modal==='object'&&modal.id?modal.id:null)} onClose={()=>setModal(null)}/>
      </Modal>}
      {subModal&&<Modal onClose={()=>setSubModal(null)}>
        <SubForm initial={subModal==='add'?null:subModal} expCats={expCats} onSave={form=>saveSub(form,subModal!=='add'&&subModal.id?subModal.id:null)} onClose={()=>setSubModal(null)}/>
      </Modal>}
      <Toast message={toast} onClose={()=>setToast('')}/>
    </div>
  )
}
