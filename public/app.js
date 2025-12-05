// public/app.js

// 오늘 날짜 "YYYY-MM-DD" 문자열 만드는 함수
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// HTML 요소들 가져오기
const dateInput = document.getElementById('dateInput');
const loadBtn = document.getElementById('loadBtn');
const reserveForm = document.getElementById('reserveForm');
const roomSelect = document.getElementById('roomSelect');
const reserveDate = document.getElementById('reserveDate');
const startTime = document.getElementById('startTime');
const endTime = document.getElementById('endTime');
const studentName = document.getElementById('studentName');
const listDiv = document.getElementById('list');
const messageP = document.getElementById('message');

// 페이지 처음 열릴 때 오늘 날짜로 세팅
const today = todayStr();
dateInput.value = today;
reserveDate.value = today;

// 특정 날짜의 예약 목록 서버에서 가져와서 화면에 표시
async function loadReservations() {
  const date = dateInput.value;
  if (!date) return;

  listDiv.innerHTML = '불러오는 중...';

  const res = await fetch('/api/reservations?date=' + encodeURIComponent(date));
  const data = await res.json(); // [{room, date, start, end, student}, ...]

  if (data.length === 0) {
    listDiv.innerHTML = '<p>이 날짜에는 아직 예약이 없습니다.</p>';
    return;
  }

  // 연습실별로 묶기
  const byRoom = {};
  data.forEach(r => {
    if (!byRoom[r.room]) byRoom[r.room] = [];
    byRoom[r.room].push(r);
  });

  let html = '';

  // 연습실 1~5 순서대로 출력
  [1, 2, 3, 4, 5].forEach(roomNum => {
    const key = String(roomNum);
    const list = byRoom[key] || [];

    html += `<h3>연습실 ${roomNum}</h3>`;
    if (list.length === 0) {
      html += '<p>예약 없음</p>';
    } else {
      html += '<ul>';
      // 시간 순서대로 정렬
      list.sort((a, b) => a.start.localeCompare(b.start));
      list.forEach(r => {
        html += `<li>${r.start} ~ ${r.end} - ${r.student}</li>`;
      });
      html += '</ul>';
    }
  });

  listDiv.innerHTML = html;
}

// "해당 날짜 예약 보기" 버튼 클릭 시
loadBtn.addEventListener('click', () => {
  loadReservations();
});

// "예약하기" 버튼 눌렀을 때
reserveForm.addEventListener('submit', async (e) => {
  e.preventDefault(); // 폼의 기본 제출(새로고침) 막기
  messageP.textContent = '';

  const body = {
    room: roomSelect.value,
    date: reserveDate.value,
    start: startTime.value,
    end: endTime.value,
    student: studentName.value.trim(),
  };

  if (!body.date || !body.start || !body.end || !body.student) {
    messageP.textContent = '모든 칸을 채워주세요.';
    return;
  }

  try {
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      messageP.textContent = '에러: ' + (data.error || '예약 실패');
    } else {
      messageP.textContent = '예약이 저장되었습니다.';

      // 날짜 선택창과 예약날짜가 같으면 목록 새로고침
      if (reserveDate.value === dateInput.value) {
        loadReservations();
      }
    }
  } catch (err) {
    console.error(err);
    messageP.textContent = '서버 오류가 발생했습니다.';
  }
});

// 페이지 처음 열릴 때 오늘 날짜 예약 목록 바로 보여주기
window.addEventListener('load', () => {
  loadReservations();
});
