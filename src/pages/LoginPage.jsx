import { useState } from 'react'
import { db } from '../firebase.js'
import { doc, getDoc } from 'firebase/firestore'
import { hashPassword } from '../utils.js'
import { firebaseSignIn } from '../firebase.js'

export default function LoginPage({ onLogin }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)

  const doShake = () => { setShake(true); setTimeout(() => setShake(false), 500) }

  const handleLogin = async () => {
    if (!pw.trim()) { setErr('비밀번호를 입력해주세요'); doShake(); return }
    setLoading(true); setErr('')
    try {
      // Firebase 익명 인증 먼저 확보
      await firebaseSignIn()
      const hash = await hashPassword(pw)
      // Check all accounts
      const accountsSnap = await Promise.all([
        getDoc(doc(db, 'accounts', 'boss')),
        getDoc(doc(db, 'accounts', 'jinsu')),
        getDoc(doc(db, 'accounts', 'pilseon')),
      ])
      const matched = accountsSnap.find(s => s.exists() && s.data().passwordHash === hash)
      if (matched) {
        const data = matched.data()
        onLogin({ id: data.id, name: data.name, role: data.role })
      } else {
        setErr('비밀번호가 올바르지 않습니다')
        doShake(); setPw('')
      }
    } catch (e) {
      setErr('오류가 발생했습니다. 다시 시도해주세요')
      console.error(e)
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg, #0d1526 0%, #111d35 50%, #0d1526 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:"'Noto Sans KR',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap'); @keyframes fadein{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}} @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}`}</style>

      <div style={{ width:'100%', maxWidth:380 }}>
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ fontSize:48, marginBottom:14 }}>🛠️</div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#f1f5f9', letterSpacing:'-0.5px', marginBottom:6 }}>팀 트래커</h1>
          <p style={{ fontSize:13, color:'#475569' }}>비밀번호를 입력해 접속하세요</p>
        </div>

        <div style={{ background:'#111d35', border:'1px solid #1e2e50', borderRadius:20, padding:'32px 28px', animation:shake?'shake 0.4s ease':'fadein 0.4s ease', boxShadow:'0 25px 60px rgba(0,0,0,0.4)' }}>
          <div style={{ marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, background:'#0a1120', border:`1px solid ${err?'#ef4444':'#1e2e50'}`, borderRadius:11, padding:'12px 14px', transition:'border-color 0.2s' }}>
              <span style={{ fontSize:18 }}>🔒</span>
              <input type="password" value={pw} placeholder="비밀번호 입력" autoFocus
                onChange={e => { setPw(e.target.value); setErr('') }}
                onKeyDown={e => e.key==='Enter' && handleLogin()}
                style={{ flex:1, border:'none', outline:'none', background:'transparent', color:'#e2e8f0', fontSize:15, fontWeight:500, fontFamily:"'Noto Sans KR',sans-serif" }} />
            </div>
            {err && <p style={{ color:'#f87171', fontSize:12, marginTop:8, paddingLeft:4 }}>{err}</p>}
          </div>

          <button onClick={handleLogin} disabled={loading} style={{ width:'100%', padding:14, border:'none', borderRadius:11, background:loading?'#334155':'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#fff', fontWeight:700, fontSize:15, cursor:loading?'not-allowed':'pointer', fontFamily:"'Noto Sans KR',sans-serif", boxShadow:loading?'none':'0 4px 15px rgba(37,99,235,0.4)', transition:'all 0.2s' }}>
            {loading ? '확인 중...' : '입장하기'}
          </button>
        </div>

        <p style={{ textAlign:'center', marginTop:20, fontSize:12, color:'#334155' }}>팀원 전용 · 무단 접근 금지</p>
      </div>
    </div>
  )
}
