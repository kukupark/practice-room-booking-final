// public/app.js

const dateInput = document.getElementById('date');
const loadBtn = document.getElementById('loadBtn');
const roomSelect = document.getElementById('room');
const startInput = document.getElementById('start');
const endInput = document.getElementById('end');
const studentInput = document.getElementById('student');
const messageEl = document.getElementById('message');
const listEl = document.getElementById('list');
const timetableEl = document.getElementById('timetable');
const form = document.getElementById('reserveForm');

// 연습실 번호 (필요하면 개수 늘리면 됨)
const ROOMS = [1, 2, 3, 4, 5];

// 시간표에 표시할 시간대 (예: 13:00 ~ 22:00, 30분 간격)
const TIME_SLOTS = generateTimeSlots('13:00', '22:00', 30);

let currentReservations = [];

// 시간 문자열 배열 만들기
function generateTimeSlots(start, end, stepMinutes) {
  const slots = [];
  let [h, m] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);

  while (h < eh || (h === eh && m < em)) {
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    slots.push(`${hh}:${mm}`);

    m += stepMinutes;
    if (m >= 60) {
      h += 1;
      m -= 60;
    }
  }

  return slots;
}

// timeStr("HH:MM")에 분 더하기
function addMinutes(timeStr, deltaMinutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m + deltaMinutes, 0, 0);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

window.addEventListener('DOMContentLoaded', () => {
  // 오늘 날짜 기본 설정
  const today = new Date().toISOString().slice(0, 10);
  dateInput.value = today;

  // 첫 로딩 시 데이터 가져오기
  loadReservations();

  loadBtn.addEventListener('click', (e) => {
    e.preventDefault();
    loadReservations();
  });

  form.addEventListener('submit', submitReservation);
});

// 예약 데이터 불러오기
async function loadReservations() {
  const date = dateInput.value;
  if (!date) return;

  messageEl.textContent = '';

  try {
    const res = await fetch(
      `/api/reservations?date=${encodeURIComponent(date)}`
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      messageEl.textContent =
        err.error || '예약 목록을 불러오는 중 오류가 발생했습니다.';
      messageEl.style.color = 'red';
      return;
    }

    const data = await res.json();
    currentReservations = data;

    renderTimetable();
    renderList();
  } catch (err) {
    console.error(err);
    messageEl.textContent = '서버와 통신 중 오류가 발생했습니다.';
    messageEl.style.color = 'red';
  }
}

// 시간표 그리기
function renderTimetable() {
  timetableEl.innerHTML = '';

  const table = document.createElement('div');
  table.className = 'timetable-table';

  // 첫 칸(왼쪽 위) - "시간" 표시
  const corner = document.createElement('div');
  corner.className = 'tt-header tt-corner';
  corner.textContent = '시간';
  table.appendChild(corner);

  // 상단 헤더: 연습실 1~5
  ROOMS.forEach((room) => {
    const h = document.createElement('div');
    h.className = 'tt-header';
    h.textContent = `연습실 ${room}`;
    table.appendChild(h);
  });

  // 각 시간줄
  TIME_SLOTS.forEach((time, idx) => {
    // 왼쪽 시간 표시 칸
    const timeCell = document.createElement('div');
    timeCell.className = 'tt-time';
    timeCell.textContent = time;
    table.appendChild(timeCell);

    // 각 연습실 칸
    ROOMS.forEach((room) => {
      const cell = document.createElement('div');
      cell.className = 'tt-cell';

      // 해당 시간대에 이 방을 사용하는 예약이 있는지 확인
      const reservation = currentReservations.find((r) => {
        return (
          String(r.room) === String(room) &&
          r.start <= time &&
          r.end > time
        );
      });

      if (reservation) {
        // 예약 차 있음
        cell.classList.add('tt-busy');
        cell.innerHTML = `
          <div class="tt-student">${reservation.student}</div>
          <div class="tt-range">${reservation.start} ~ ${reservation.end}</div>
        `;
      } else {
        // 비어 있는 칸
        cell.classList.add('tt-free');
        cell.textContent = '비어있음';

        // 클릭하면 폼에 자동 입력
        cell.addEventListener('click', () => {
          roomSelect.value = String(room);
          startInput.value = time;

          // 기본으로 1시간짜리 예약 (2칸 = 30분 x 2)
          const next = TIME_SLOTS[idx + 2] || addMinutes(time, 60);
          endInput.value = next;

          studentInput.focus();
        });
      }

      table.appendChild(cell);
    });
  });

  timetableEl.appendChild(table);
}

// 오른쪽 예약 목록 그리기
function renderList() {
  listEl.innerHTML = '';

  if (!currentReservations || currentReservations.length === 0) {
    listEl.textContent = '이 날짜에는 아직 예약이 없습니다.';
    return;
  }

  const byRoom = {};
  ROOMS.forEach((r) => (byRoom[r] = []));
  currentReservations.forEach((r) => {
    const room = Number(r.room);
    if (!byRoom[room]) byRoom[room] = [];
    byRoom[room].push(r);
  });

  Object.keys(byRoom)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((room) => {
      const list = byRoom[room];
      const title = document.createElement('h3');
      title.textContent = `연습실 ${room}`;
      listEl.appendChild(title);

      if (list.length === 0) {
        const p = document.createElement('p');
        p.textContent = '예약 없음';
        listEl.appendChild(p);
        return;
      }

      list.sort((a, b) => a.start.localeCompare(b.start));

      const ul = document.createElement('ul');
      list.forEach((r) => {
        const li = document.createElement('li');
        li.textContent = `${r.start} ~ ${r.end} — ${r.student}`;
        ul.appendChild(li);
      });

      listEl.appendChild(ul);
    });
}

// 예약 폼 전송
async function submitReservation(e) {
  e.preventDefault();
  messageEl.textContent = '';

  const body = {
    room: roomSelect.value,
    date: dateInput.value,
    start: startInput.value,
    end: endInput.value,
    student: studentInput.value.trim(),
  };

  if (!body.date || !body.start || !body.end || !body.student) {
    messageEl.textContent = '모든 항목을 입력해주세요.';
    messageEl.style.color = 'red';
    return;
  }

  try {
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      messageEl.textContent = data.error || '예약에 실패했습니다.';
      messageEl.style.color = 'red';
      return;
    }

    messageEl.textContent = '예약이 저장되었습니다.';
    messageEl.style.color = 'green';
    studentInput.value = '';

    // 새로 예약 후 목록/시간표 다시 불러오기
    loadReservations();
  } catch (err) {
    console.error(err);
    messageEl.textContent = '서버 오류가 발생했습니다.';
    messageEl.style.color = 'red';
  }
}
