export const BIG_CATS = [
  { id: 'dev',       label: '개발',         icon: '💻', color: '#3b82f6', dim: '#0d1f3c' },
  { id: 'design',    label: '디자인',        icon: '🎨', color: '#a78bfa', dim: '#1e1040' },
  { id: 'marketing', label: '브랜드/마케팅', icon: '📣', color: '#f59e0b', dim: '#261a00' },
  { id: 'ops',       label: '운영',          icon: '⚙️', color: '#34d399', dim: '#052e1c' },
]

export const SUB_CATS = {
  dev:    ['로그인/회원가입','프로필 편집','여행/게하','커뮤니티','채팅','일정/캘린더','내정보','알림','기타'],
  design: ['앱 화면 디자인','아이콘/일러스트','타이포그래피','컬러 시스템','컴포넌트','기타'],
}

export const CAT_ICONS = {
  '로그인/회원가입':'🔐','프로필 편집':'👤','여행/게하':'✈️',
  '커뮤니티':'💬','채팅':'📨','일정/캘린더':'📅','내정보':'🧾','알림':'🔔','기타':'📌',
  '앱 화면 디자인':'🖼️','아이콘/일러스트':'🎭','타이포그래피':'🔤','컬러 시스템':'🎨','컴포넌트':'🧩',
}

export const STATUS_LIST = ['대기','진행','완료']
export const STATUS_STYLE = {
  '대기': { color:'#60a5fa', bg:'rgba(59,130,246,0.12)',  border:'rgba(59,130,246,0.3)' },
  '진행': { color:'#4ade80', bg:'rgba(34,197,94,0.12)',   border:'rgba(34,197,94,0.3)'  },
  '완료': { color:'#a5b4fc', bg:'rgba(129,140,248,0.12)', border:'rgba(129,140,248,0.3)'},
}

export const ACCOUNTS = [
  { id:'boss',    name:'대표', role:'admin'  },
  { id:'jinsu',   name:'진수', role:'member' },
  { id:'pilseon', name:'필선', role:'member' },
]

// SHA-256 hashes — raw passwords never stored in code
export const PASSWORD_HASHES = {
  boss:    '7efb4c411b800ea17926fe919bddd7ebaa51893d56cfce63dcd055b812ddfb63',
  jinsu:   '767ad372f995d5d5612bebe6599dc8f467c5527f14d9b0bc49d190fb3747031a',
  pilseon: '4fb6bffe0e5be7f4b1f15904ef70200005a73ac64e34c4a8dca79db5137bb61b',
}

export const DEFAULT_PERMS = {
  jinsu:   { dev:{view:true,edit:true},  design:{view:false,edit:false}, marketing:{view:false,edit:false}, ops:{view:false,edit:false} },
  pilseon: { dev:{view:true,edit:true},  design:{view:false,edit:false}, marketing:{view:false,edit:false}, ops:{view:false,edit:false} },
}

export const ADMIN_PERMS = {
  dev:{view:true,edit:true}, design:{view:true,edit:true}, marketing:{view:true,edit:true}, ops:{view:true,edit:true},
}

export const INITIAL_ITEMS = [
  { id:'1',  bigCat:'dev', category:'로그인/회원가입', page:'휴대폰번호로 로그인 P', desc:'비밀번호 재설정 아이콘 우측 여백 조정', detail:'', status:'대기', assignee:'', urgent:false },
  { id:'2',  bigCat:'dev', category:'로그인/회원가입', page:'회원가입 P', desc:'이메일 종류 추가하기', detail:'naver.com / kakao.com / gmail.com / daum.net', status:'대기', assignee:'', urgent:false },
  { id:'3',  bigCat:'dev', category:'로그인/회원가입', page:'회원가입 P', desc:'비번 2차 입력시 칸 작아지는거 수정', detail:'', status:'대기', assignee:'', urgent:false },
  { id:'4',  bigCat:'dev', category:'로그인/회원가입', page:'회원가입 - 닉네임 P', desc:'닉네임 설정 최대 글자 수 제한', detail:'최대 20자 제한', status:'대기', assignee:'', urgent:false },
  { id:'5',  bigCat:'dev', category:'프로필 편집', page:'프로필편집 P', desc:'사용자 아이디 최대 글자 수 제한', detail:'최대 20자 제한', status:'대기', assignee:'', urgent:false },
  { id:'6',  bigCat:'dev', category:'프로필 편집', page:'프로필편집 P', desc:'닉네임, 설명, 사용자 아이디 각 페이지에서 저장 시 저장되게 변경', detail:'', status:'대기', assignee:'', urgent:false },
  { id:'7',  bigCat:'dev', category:'여행/게하', page:'여행 - 게하 클릭', desc:'정보 바 드래그로 이동 시 고정되는 문제 해결', detail:'', status:'대기', assignee:'', urgent:false },
  { id:'8',  bigCat:'dev', category:'여행/게하', page:'여행 - 게하 클릭 - 정보 P', desc:'객실 더보기 아이콘 좌우 여백 확인', detail:'', status:'대기', assignee:'', urgent:false },
  { id:'9',  bigCat:'dev', category:'여행/게하', page:'여행 - 게하 클릭 - 정보', desc:'각 정보 별 구분선 추가', detail:'', status:'대기', assignee:'', urgent:false },
  { id:'10', bigCat:'dev', category:'여행/게하', page:'여행 - 게하 클릭 - 리뷰', desc:'점세개(⋮) 기능 추가', detail:'', status:'대기', assignee:'', urgent:false },
  { id:'11', bigCat:'dev', category:'커뮤니티', page:'커뮤니티 - 정렬', desc:'추천순 점수제도 다시 고려', detail:'필선이가 한다함', status:'진행', assignee:'pilseon', urgent:false },
  { id:'12', bigCat:'dev', category:'커뮤니티', page:'커뮤니티 - 정렬', desc:'추천순 눌러도 정렬 뜨게 변경', detail:'', status:'대기', assignee:'', urgent:false },
  { id:'13', bigCat:'dev', category:'커뮤니티', page:'커뮤니티 - 게시글 신고', desc:'서버 데이터 및 관리자 페이지에 남게 적용하고, 점수제도에 적용', detail:'', status:'대기', assignee:'', urgent:false },
  { id:'14', bigCat:'dev', category:'커뮤니티', page:'커뮤니티 - 신고하기', desc:'밖에서 신고하기 누를 시 세부 사유 선택 안되는 오류 수정', detail:'', status:'대기', assignee:'', urgent:false },
  { id:'15', bigCat:'dev', category:'커뮤니티', page:'커뮤니티 - 게시글 작성 - 설정', desc:'공개범위 및 댓글 허용 여부에 따른 값 적용', detail:'', status:'대기', assignee:'', urgent:false },
  { id:'16', bigCat:'dev', category:'커뮤니티', page:'커뮤니티 - 알림', desc:'알림 올때 프로필 사진 바뀌는 오류 수정', detail:'', status:'대기', assignee:'', urgent:false },
  { id:'17', bigCat:'dev', category:'커뮤니티', page:'커뮤니티 - 필터', desc:'#동행구해요 삭제하기', detail:'', status:'대기', assignee:'', urgent:false },
  { id:'18', bigCat:'dev', category:'채팅', page:'신규 채팅 - 알림창으로 접속 시', desc:'이름없음으로 표기 되는거 수정', detail:'', status:'대기', assignee:'', urgent:false },
  { id:'19', bigCat:'dev', category:'채팅', page:'채팅 - 동행', desc:'동행 이름 최대 글자수 제한', detail:'최대 20자 제한', status:'대기', assignee:'', urgent:false },
  { id:'20', bigCat:'dev', category:'일정/캘린더', page:'일정 - 캘린더 - 일정추가 - 알림', desc:'알림 사용 시 알림 오게 할 것', detail:'', status:'대기', assignee:'', urgent:false },
  { id:'21', bigCat:'dev', category:'내정보', page:'내정보 - 메뉴 P', desc:'이벤트 예약 내역 삭제', detail:'', status:'대기', assignee:'', urgent:false },
  { id:'22', bigCat:'dev', category:'내정보', page:'내정보 P', desc:'새로 고침 시 정보 바(팔로워, 팔로잉 있는 곳) 새로고침 로딩 게이지 삭제', detail:'', status:'대기', assignee:'', urgent:false },
  { id:'23', bigCat:'dev', category:'알림', page:'알림', desc:'예약 확정 안내 시 알림 속 사진을 해당 게스트 하우스 프로필 사진으로 반영', detail:'', status:'대기', assignee:'', urgent:false },
]
