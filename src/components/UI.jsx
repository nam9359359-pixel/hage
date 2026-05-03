import { useState, useEffect } from 'react'

// Toast notification
export function Toast({ message, onClose }) {
  useEffect(() => { if (message) { const t = setTimeout(onClose, 2500); return () => clearTimeout(t) } }, [message])
  if (!message) return null
  return (
    <div style={{ position:'fixed', bottom:28, left:'50%', transform:'translateX(-50%)', background:'#1a2744', border:'1px solid #2d3f6e', borderRadius:12, padding:'12px 24px', color:'#e2e8f0', fontWeight:600, fontSize:14, boxShadow:'0 8px 30px rgba(0,0,0,0.5)', zIndex:9999, whiteSpace:'nowrap', animation:'fadein 0.2s ease', fontFamily:"'Noto Sans KR',sans-serif" }}>{message}</div>
  )
}

// Modal overlay
export function Modal({ children, onClose }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999, padding:20 }} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'#111d35', border:'1px solid #2d3f6e', borderRadius:18, padding:'28px 28px', width:'100%', maxWidth:500, boxShadow:'0 25px 60px rgba(0,0,0,0.5)', maxHeight:'90vh', overflowY:'auto', animation:'fadein 0.2s ease' }}>
        {children}
      </div>
    </div>
  )
}

// Confirm dialog
export function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <Modal onClose={onCancel}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:36, marginBottom:14 }}>⚠️</div>
        <p style={{ fontSize:15, color:'#e2e8f0', lineHeight:1.7, marginBottom:24 }}>{message}</p>
        <div style={{ display:'flex', gap:10 }}>
          <Btn onClick={onCancel} style={{ flex:1, background:'transparent', border:'1px solid #334155', color:'#94a3b8' }}>취소</Btn>
          <Btn onClick={onConfirm} style={{ flex:1, background:'#dc2626', border:'none', color:'#fff' }}>삭제</Btn>
        </div>
      </div>
    </Modal>
  )
}

// Generic button
export function Btn({ children, onClick, style={}, disabled=false }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding:'10px 16px', border:'none', borderRadius:9, fontWeight:600, fontSize:14, cursor:disabled?'not-allowed':'pointer', fontFamily:"'Noto Sans KR',sans-serif", opacity:disabled?0.5:1, transition:'opacity 0.15s', ...style }}>{children}</button>
  )
}

// Input field
export function Input({ value, onChange, placeholder='', type='text', style={} }) {
  return (
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{ width:'100%', padding:'10px 13px', background:'#0a1120', border:'1px solid #1e2e50', borderRadius:8, color:'#e2e8f0', fontSize:14, outline:'none', fontFamily:"'Noto Sans KR',sans-serif", ...style }} />
  )
}

// Textarea
export function Textarea({ value, onChange, placeholder='', rows=3, style={} }) {
  return (
    <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{ width:'100%', padding:'10px 13px', background:'#0a1120', border:'1px solid #1e2e50', borderRadius:8, color:'#e2e8f0', fontSize:14, outline:'none', resize:'vertical', fontFamily:"'Noto Sans KR',sans-serif", ...style }} />
  )
}

// Select
export function Select({ value, onChange, options=[], style={} }) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{ width:'100%', padding:'10px 13px', background:'#0a1120', border:'1px solid #1e2e50', borderRadius:8, color:'#e2e8f0', fontSize:14, outline:'none', fontFamily:"'Noto Sans KR',sans-serif", cursor:'pointer', ...style }}>
      {options.map(o => <option key={typeof o==='object'?o.value:o} value={typeof o==='object'?o.value:o}>{typeof o==='object'?o.label:o}</option>)}
    </select>
  )
}

// Label
export function Label({ children }) {
  return <label style={{ fontSize:11, fontWeight:700, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.5px' }}>{children}</label>
}

// Field wrapper
export function Field({ label, children, style={} }) {
  return <div style={{ display:'flex', flexDirection:'column', gap:5, ...style }}><Label>{label}</Label>{children}</div>
}

// Status badge select
export function StatusSelect({ value, onChange }) {
  const colors = {
    '대기': { color:'#60a5fa', bg:'rgba(59,130,246,0.12)', border:'rgba(59,130,246,0.3)' },
    '진행': { color:'#4ade80', bg:'rgba(34,197,94,0.12)',  border:'rgba(34,197,94,0.3)'  },
    '완료': { color:'#a5b4fc', bg:'rgba(129,140,248,0.12)',border:'rgba(129,140,248,0.3)'},
  }
  const c = colors[value] || colors['대기']
  return (
    <select value={value} onChange={e=>onChange(e.target.value)} style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:18, color:c.color, fontWeight:700, fontSize:11, padding:'3px 8px', cursor:'pointer', outline:'none', fontFamily:"'Noto Sans KR',sans-serif" }}>
      {['대기','진행','완료'].map(s=><option key={s} value={s} style={{ background:'#111d35', color:'#e2e8f0' }}>{s}</option>)}
    </select>
  )
}

// Toggle switch
export function Toggle({ value, onChange }) {
  return (
    <button onClick={()=>onChange(!value)} style={{ padding:'3px 12px', border:'none', borderRadius:12, background:value?'#22c55e':'#334155', color:value?'#fff':'#64748b', fontWeight:700, fontSize:11, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif", transition:'all 0.2s', minWidth:48 }}>
      {value?'ON':'OFF'}
    </button>
  )
}

// Page header
export function PageHeader({ title, onBack, children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28 }}>
      {onBack && <button onClick={onBack} style={{ padding:'7px 12px', background:'rgba(255,255,255,0.05)', border:'1px solid #1e2e50', borderRadius:8, color:'#94a3b8', fontSize:13, cursor:'pointer', fontFamily:"'Noto Sans KR',sans-serif" }}>← 뒤로</button>}
      <h1 style={{ fontSize:20, fontWeight:700, color:'#f1f5f9' }}>{title}</h1>
      <div style={{ flex:1 }} />
      {children}
    </div>
  )
}

// Section card
export function SectionCard({ children, style={} }) {
  return <div style={{ background:'#111d35', border:'1px solid #1e2e50', borderRadius:14, overflow:'hidden', ...style }}>{children}</div>
}

// Empty state
export function Empty({ icon='📭', message='데이터가 없습니다' }) {
  return <div style={{ textAlign:'center', padding:'60px 0', color:'#475569' }}><div style={{ fontSize:40, marginBottom:12 }}>{icon}</div><p style={{ fontSize:14 }}>{message}</p></div>
}
