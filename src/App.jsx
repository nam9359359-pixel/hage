import { useState, useEffect } from "react";

const INITIAL_ITEMS = [
  { id: 1, category: "로그인/회원가입", page: "휴대폰번호로 로그인 P", desc: "비밀번호 재설정 아이콘 우측 여백 조정", detail: "", status: "대기" },
  { id: 2, category: "로그인/회원가입", page: "회원가입 P", desc: "이메일 종류 추가하기", detail: "다음, 카카오, 구글 추가", status: "대기" },
  { id: 3, category: "로그인/회원가입", page: "회원가입 P", desc: "비번 2차 입력시 칸 작아지는거 수정", detail: "", status: "대기" },
  { id: 4, category: "로그인/회원가입", page: "회원가입 - 닉네임 P", desc: "닉네임 설정 최대 글자 수 제한", detail: "최대 20자 제한", status: "대기" },
  { id: 5, category: "프로필 편집", page: "프로필편집 P", desc: "사용자 아이디 최대 글자 수 제한", detail: "최대 20자 제한", status: "대기" },
  { id: 6, category: "프로필 편집", page: "프로필편집 P", desc: "닉네임, 설명, 사용자 아이디 각 페이지에서 저장 시 저장되게 변경", detail: "", status: "대기" },
  { id: 7, category: "여행/게하", page: "여행 - 게하 클릭", desc: "정보 바 드래그로 이동 시 고정되는 문제 해결", detail: "", status: "대기" },
  { id: 8, category: "여행/게하", page: "여행 - 게하 클릭 - 정보 P", desc: "객실 더보기 아이콘 좌우 여백 확인", detail: "", status: "대기" },
  { id: 9, category: "여행/게하", page: "여행 - 게하 클릭 - 정보", desc: "각 정보 별 구분선 추가", detail: "", status: "대기" },
  { id: 10, category: "여행/게하", page: "여행 - 게하 클릭 - 리뷰", desc: "점세개(⋮) 기능 추가", detail: "", status: "대기" },
  { id: 11, category: "커뮤니티", page: "커뮤니티 - 정렬", desc: "추천순 점수제도 다시 고려", detail: "필선이가 한다함", status: "진행" },
  { id: 12, category: "커뮤니티", page: "커뮤니티 - 정렬", desc: "추천순 눌러도 정렬 뜨게 변경", detail: "", status: "대기" },
  { id: 13, category: "커뮤니티", page: "커뮤니티 - 게시글 신고", desc: "서버 데이터 및 관리자 페이지에 남게 적용하고, 점수제도에 적용", detail: "", status: "대기" },
  { id: 14, category: "커뮤니티", page: "커뮤니티 - 신고하기", desc: "밖에서 신고하기 누를 시 세부 사유 선택 안되는 오류 수정", detail: "", status: "대기" },
  { id: 15, category: "커뮤니티", page: "커뮤니티 - 게시글 작성 - 설정", desc: "공개범위 및 댓글 허용 여부에 따른 값 적용", detail: "", status: "대기" },
  { id: 16, category: "커뮤니티", page: "커뮤니티 - 알림", desc: "알림 올때 프로필 사진 바뀌는 오류 수정", detail: "", status: "대기" },
  { id: 17, category: "커뮤니티", page: "커뮤니티 - 필터", desc: "#동행구해요 삭제하기", detail: "", status: "대기" },
  { id: 18, category: "채팅", page: "신규 채팅 - 알림창으로 접속 시", desc: "이름없음으로 표기 되는거 수정", detail: "", status: "대기" },
  { id: 19, category: "채팅", page: "채팅 - 동행", desc: "동행 이름 최대 글자수 제한", detail: "최대 20자 제한", status: "대기" },
  { id: 20, category: "일정/캘린더", page: "일정 - 캘린더 - 일정추가 - 알림", desc: "알림 사용 시 알림 오게 할 것", detail: "", status: "대기" },
  { id: 21, category: "내정보", page: "내정보 - 메뉴 P", desc: "이벤트 예약 내역 삭제", detail: "", status: "대기" },
  { id: 22, category: "내정보", page: "내정보 P", desc: "새로 고침 시 정보 바(팔로워, 팔로잉 있는 곳) 새로고침 로딩 게이지 삭제", detail: "", status: "대기" },
  { id: 23, category: "알림", page: "알림", desc: "예약 확정 안내 시 알림 속 사진을 해당 게스트 하우스 프로필 사진으로 반영", detail: "", status: "대기" },
];

const CATEGORIES = ["전체", "로그인/회원가입", "프로필 편집", "여행/게하", "커뮤니티", "채팅", "일정/캘린더", "내정보", "알림"];
const CATEGORY_ICONS = { "로그인/회원가입": "🔐", "프로필 편집": "👤", "여행/게하": "✈️", "커뮤니티": "💬", "채팅": "📨", "일정/캘린더": "📅", "내정보": "🧾", "알림": "🔔" };
const STATUS_LIST = ["대기", "진행", "완료"];
const ADMIN_PW = "admin1234";
const VIEWER_PW = "team1234";

const STORAGE_KEY = "bugtracker_items";

const statusStyle = (s) => {
  if (s === "진행") return { bg: "#dcfce7", color: "#16a34a", dot: "#22c55e" };
  if (s === "완료") return { bg: "#e0e7ff", color: "#4338ca", dot: "#6366f1" };
  return { bg: "#eff6ff", color: "#2563eb", dot: "#3b82f6" };
};

// ── LOGIN ──────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [role, setRole] = useState("viewer");
  const [shake, setShake] = useState(false);

  const handleLogin = () => {
    const expected = role === "admin" ? ADMIN_PW : VIEWER_PW;
    if (pw === expected) {
      onLogin(role);
    } else {
      setErr("비밀번호가 올바르지 않습니다");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPw("");
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
      padding: "20px", fontFamily: "'Noto Sans KR', sans-serif"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap');
        @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
        @keyframes fadein{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        *{box-sizing:border-box;margin:0;padding:0;}
        input,select,textarea,button{font-family:'Noto Sans KR',sans-serif;}
        ::-webkit-scrollbar{width:6px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:#334155;border-radius:6px;}
      `}</style>
      <div style={{
        width: "100%", maxWidth: 400,
        background: "#1e293b", border: "1px solid #334155",
        borderRadius: 20, padding: "40px 36px",
        boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
        animation: shake ? "shake 0.4s ease" : "fadein 0.4s ease"
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 42, marginBottom: 12 }}>🛠️</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", letterSpacing: -0.5 }}>개발팀 수정 사항</h1>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>접근 권한을 선택하고 비밀번호를 입력하세요</p>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 20, background: "#0f172a", borderRadius: 12, padding: 4 }}>
          {[["viewer", "👥 팀원 보기"], ["admin", "🔑 관리자"]].map(([r, label]) => (
            <button key={r} onClick={() => { setRole(r); setErr(""); setPw(""); }} style={{
              flex: 1, padding: "10px 0", borderRadius: 9, border: "none", cursor: "pointer",
              fontWeight: 600, fontSize: 13,
              background: role === r ? "#3b82f6" : "transparent",
              color: role === r ? "#fff" : "#64748b", transition: "all 0.2s"
            }}>{label}</button>
          ))}
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "#0f172a", border: `1px solid ${err ? "#ef4444" : "#334155"}`,
            borderRadius: 12, padding: "12px 16px"
          }}>
            <span style={{ fontSize: 18 }}>🔒</span>
            <input type="password" value={pw} placeholder="비밀번호 입력"
              onChange={e => { setPw(e.target.value); setErr(""); }}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "#f1f5f9", fontSize: 15, fontWeight: 500 }}
            />
          </div>
          {err && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 8, paddingLeft: 4 }}>{err}</p>}
        </div>
        <button onClick={handleLogin} style={{
          width: "100%", padding: "14px", border: "none", borderRadius: 12,
          background: "linear-gradient(135deg, #3b82f6, #2563eb)",
          color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
          boxShadow: "0 4px 15px rgba(59,130,246,0.4)"
        }}>입장하기</button>
        <div style={{ marginTop: 24, padding: "14px", background: "#0f172a", borderRadius: 10, fontSize: 12, color: "#475569", lineHeight: 1.8 }}>
          <div>👥 <strong style={{ color: "#94a3b8" }}>팀원</strong>: 열람 + 상태 변경 가능</div>
          <div>🔑 <strong style={{ color: "#94a3b8" }}>관리자</strong>: 추가 · 수정 · 삭제 가능</div>
        </div>
      </div>
    </div>
  );
}

// ── MODAL ─────────────────────────────────────────────────────────────────
function Modal({ item, onClose, onSave }) {
  const [form, setForm] = useState(item || { category: "로그인/회원가입", page: "", desc: "", detail: "", status: "대기" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inputStyle = {
    width: "100%", padding: "10px 14px",
    background: "#0f172a", border: "1px solid #334155",
    borderRadius: 10, color: "#f1f5f9", fontSize: 14, outline: "none"
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 18, padding: "30px 28px", width: "100%", maxWidth: 500, boxShadow: "0 25px 60px rgba(0,0,0,0.5)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>{item ? "✏️ 항목 수정" : "➕ 새 항목 추가"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 6 }}>카테고리</label>
            <select value={form.category} onChange={e => set("category", e.target.value)} style={{ ...inputStyle }}>
              {CATEGORIES.filter(c => c !== "전체").map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 6 }}>페이지</label>
            <input value={form.page} onChange={e => set("page", e.target.value)} placeholder="예: 회원가입 P" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 6 }}>수정 내용</label>
            <textarea value={form.desc} onChange={e => set("desc", e.target.value)} placeholder="수정해야 할 내용을 입력하세요" rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 6 }}>상세 정보 <span style={{ color: "#475569", fontWeight: 400 }}>(선택)</span></label>
            <input value={form.detail} onChange={e => set("detail", e.target.value)} placeholder="예: 최대 20자 제한" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 8 }}>상태</label>
            <div style={{ display: "flex", gap: 8 }}>
              {STATUS_LIST.map(s => {
                const st = statusStyle(s);
                const active = form.status === s;
                return (
                  <button key={s} onClick={() => set("status", s)} style={{
                    flex: 1, padding: "8px 0", border: `2px solid ${active ? st.dot : "#334155"}`,
                    borderRadius: 8, background: active ? st.bg + "33" : "transparent",
                    color: active ? st.color : "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "all 0.15s"
                  }}><span style={{ marginRight: 4 }}>●</span>{s}</button>
                );
              })}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "12px", border: "1px solid #334155", borderRadius: 10, background: "transparent", color: "#94a3b8", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>취소</button>
          <button onClick={() => onSave(form)} style={{ flex: 2, padding: "12px", border: "none", borderRadius: 10, background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>저장하기</button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────────────────────
export default function App() {
  const [role, setRole] = useState(null);
  const [items, setItems] = useState([]);
  const [filterCat, setFilterCat] = useState("전체");
  const [filterStatus, setFilterStatus] = useState("전체");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => {
    if (!role) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setItems(JSON.parse(saved)); } catch { setItems(INITIAL_ITEMS); }
    } else {
      setItems(INITIAL_ITEMS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_ITEMS));
    }
  }, [role]);

  const save = (newItems) => {
    setItems(newItems);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const handleSave = (form) => {
    if (!form.desc.trim() || !form.page.trim()) { showToast("페이지와 수정 내용을 입력해주세요"); return; }
    let newItems;
    if (modal === "add") {
      const newId = Math.max(0, ...items.map(i => i.id)) + 1;
      newItems = [...items, { ...form, id: newId }];
      showToast("✅ 항목이 추가되었습니다");
    } else {
      newItems = items.map(i => i.id === form.id ? form : i);
      showToast("✅ 항목이 수정되었습니다");
    }
    save(newItems);
    setModal(null);
  };

  const handleDelete = (id) => {
    save(items.filter(i => i.id !== id));
    setConfirmDel(null);
    showToast("🗑️ 항목이 삭제되었습니다");
  };

  const handleStatusChange = (id, newStatus) => {
    save(items.map(i => i.id === id ? { ...i, status: newStatus } : i));
    showToast("🔄 상태가 변경되었습니다");
  };

  if (!role) return <LoginPage onLogin={setRole} />;

  const filtered = items.filter(i => {
    if (filterCat !== "전체" && i.category !== filterCat) return false;
    if (filterStatus !== "전체" && i.status !== filterStatus) return false;
    if (search && !i.desc.includes(search) && !i.page.includes(search) && !i.category.includes(search)) return false;
    return true;
  });

  const groupedByCategory = CATEGORIES.filter(c => c !== "전체").reduce((acc, cat) => {
    const catItems = filtered.filter(i => i.category === cat);
    if (catItems.length > 0) acc[cat] = catItems;
    return acc;
  }, {});

  const waiting = items.filter(i => i.status === "대기").length;
  const inProgress = items.filter(i => i.status === "진행").length;
  const done = items.filter(i => i.status === "완료").length;

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", fontFamily: "'Noto Sans KR', sans-serif", color: "#f1f5f9" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap');
        @keyframes fadein{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        *{box-sizing:border-box;margin:0;padding:0;}
        input,select,textarea,button{font-family:'Noto Sans KR',sans-serif;}
        ::-webkit-scrollbar{width:6px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:#334155;border-radius:6px;}
        .item-row:hover{background:#263348 !important;}
        .cat-btn:hover{background:#334155 !important;}
      `}</style>

      {/* HEADER */}
      <div style={{ background: "#1e293b", borderBottom: "1px solid #334155", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", gap: 16, height: 60 }}>
          <span style={{ fontSize: 22 }}>🛠️</span>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", lineHeight: 1 }}>개발팀 수정 사항</h1>
            <p style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Bug Tracker</p>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "6px 12px" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="검색..."
              style={{ border: "none", outline: "none", background: "transparent", color: "#f1f5f9", fontSize: 13, width: 120 }} />
            <span style={{ color: "#475569" }}>🔍</span>
          </div>
          {role === "admin" && (
            <button onClick={() => setModal("add")} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
              background: "linear-gradient(135deg, #3b82f6, #2563eb)", border: "none", borderRadius: 8,
              color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap"
            }}>+ 추가</button>
          )}
          <button onClick={() => { setRole(null); setItems([]); }} style={{
            padding: "7px 12px", background: "transparent", border: "1px solid #334155",
            borderRadius: 8, color: "#64748b", fontSize: 12, cursor: "pointer"
          }}>로그아웃</button>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 20px" }}>
        {/* STATS */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          {[
            { label: "전체", val: items.length, color: "#94a3b8", bg: "#1e293b" },
            { label: "대기", val: waiting, color: "#3b82f6", bg: "#1e3a5f" },
            { label: "진행", val: inProgress, color: "#22c55e", bg: "#14532d" },
            { label: "완료", val: done, color: "#818cf8", bg: "#1e1b4b" },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}33`, borderRadius: 12, padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, animation: "fadein 0.4s ease" }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.val}</span>
              <span style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.label}</span>
            </div>
          ))}
          {role === "admin" && (
            <div style={{ marginLeft: "auto", background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#f59e0b" }}>
              🔑 관리자 모드
            </div>
          )}
        </div>

        {/* STATUS FILTER */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {["전체", ...STATUS_LIST].map(s => {
            const active = filterStatus === s;
            const st = s !== "전체" ? statusStyle(s) : { dot: "#3b82f6", color: "#3b82f6" };
            return (
              <button key={s} className="cat-btn" onClick={() => setFilterStatus(s)} style={{
                padding: "5px 12px", borderRadius: 20, border: `1px solid ${active ? st.dot : "#334155"}`,
                background: active ? st.dot + "22" : "transparent", color: active ? st.color : "#64748b",
                fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s"
              }}>{s === "전체" ? "전체 상태" : `● ${s}`}</button>
            );
          })}
        </div>

        {/* CATEGORY FILTER */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
          {CATEGORIES.map(c => (
            <button key={c} className="cat-btn" onClick={() => setFilterCat(c)} style={{
              padding: "5px 12px", borderRadius: 20, border: `1px solid ${filterCat === c ? "#3b82f6" : "#334155"}`,
              background: filterCat === c ? "#3b82f633" : "transparent",
              color: filterCat === c ? "#60a5fa" : "#64748b",
              fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s"
            }}>
              {c !== "전체" && CATEGORY_ICONS[c] && <span style={{ marginRight: 4 }}>{CATEGORY_ICONS[c]}</span>}
              {c}
            </button>
          ))}
        </div>

        {/* LIST */}
        {Object.keys(groupedByCategory).length === 0 ? (
          <div style={{ textAlign: "center", color: "#475569", padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <p>해당하는 항목이 없습니다</p>
          </div>
        ) : (
          Object.entries(groupedByCategory).map(([cat, catItems]) => (
            <div key={cat} style={{ marginBottom: 24, animation: "fadein 0.3s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingLeft: 4 }}>
                <span style={{ fontSize: 18 }}>{CATEGORY_ICONS[cat]}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>{cat}</span>
                <span style={{ fontSize: 11, color: "#64748b", background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "1px 8px", fontWeight: 600 }}>{catItems.length}건</span>
              </div>
              <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 14, overflow: "hidden" }}>
                {catItems.map((item, idx) => {
                  const st = statusStyle(item.status);
                  return (
                    <div key={item.id} className="item-row" style={{
                      display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                      borderBottom: idx < catItems.length - 1 ? "1px solid #334155" : "none", transition: "background 0.15s"
                    }}>
                      <span style={{ fontSize: 11, color: "#475569", minWidth: 18, fontWeight: 600 }}>{item.id}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: "#60a5fa", fontWeight: 600, background: "#1e3a5f", display: "inline-block", borderRadius: 5, padding: "1px 7px", marginBottom: 5, maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.page}</div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: "#e2e8f0", lineHeight: 1.5 }}>{item.desc}</div>
                        {item.detail && <div style={{ marginTop: 4, fontSize: 12, color: "#94a3b8", background: "#0f172a", display: "inline-block", borderRadius: 5, padding: "2px 8px" }}>💡 {item.detail}</div>}
                      </div>
                      <select value={item.status} onChange={e => handleStatusChange(item.id, e.target.value)} style={{
                        background: st.bg + "33", border: `1px solid ${st.dot}55`, borderRadius: 20,
                        color: st.color, fontWeight: 700, fontSize: 11, padding: "4px 8px", cursor: "pointer", outline: "none", whiteSpace: "nowrap"
                      }}>
                        {STATUS_LIST.map(s => <option key={s} value={s} style={{ background: "#1e293b", color: "#f1f5f9" }}>{s}</option>)}
                      </select>
                      {role === "admin" && (
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button onClick={() => setModal(item)} style={{ padding: "5px 10px", background: "#334155", border: "none", borderRadius: 7, color: "#94a3b8", fontSize: 12, cursor: "pointer" }}>✏️</button>
                          <button onClick={() => setConfirmDel(item)} style={{ padding: "5px 10px", background: "#450a0a", border: "none", borderRadius: 7, color: "#f87171", fontSize: 12, cursor: "pointer" }}>🗑️</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {modal && <Modal item={modal === "add" ? null : modal} onClose={() => setModal(null)} onSave={handleSave} />}

      {confirmDel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 }}>
          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: "28px", maxWidth: 380, width: "100%", boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: 32, marginBottom: 12, textAlign: "center" }}>🗑️</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, textAlign: "center", color: "#f1f5f9" }}>항목을 삭제할까요?</h3>
            <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", lineHeight: 1.6, marginBottom: 24 }}>
              "{confirmDel.desc.slice(0, 30)}{confirmDel.desc.length > 30 ? "..." : ""}"<br />삭제 후 복구할 수 없습니다.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDel(null)} style={{ flex: 1, padding: "11px", border: "1px solid #334155", borderRadius: 10, background: "transparent", color: "#94a3b8", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>취소</button>
              <button onClick={() => handleDelete(confirmDel.id)} style={{ flex: 1, padding: "11px", border: "none", borderRadius: 10, background: "#dc2626", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>삭제하기</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "12px 24px", color: "#f1f5f9", fontWeight: 600, fontSize: 14, boxShadow: "0 8px 30px rgba(0,0,0,0.4)", zIndex: 9999, whiteSpace: "nowrap", animation: "fadein 0.2s ease" }}>{toast}</div>
      )}
    </div>
  );
}
