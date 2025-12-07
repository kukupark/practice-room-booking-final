// public/app.js

const dateInput = document.getElementById('date');
const roomSelect = document.getElementById('room');
const startInput = document.getElementById('start');
const endInput = document.getElementById('end');
const studentInput = document.getElementById('student');
const messageEl = document.getElementById('message');
const timetableEl = document.getElementById('timetable');
const form = document.getElementById('reserveForm');

// 연습실 번호
const ROOMS = [1, 2, 3, 4, 5];

// 13:00 ~ 22:00, 1시간 간격
const TIME_SLOTS = generateTimeSlots('13:00', '22:00', 60);

let currentReservations = [];
let currentBlocks = []; // ✅ 수업(검은 칸) 블록
let selectedCell = null; // 현재 선택된 칸


// 시간 문자열 배열 만들기: "HH:MM" → stepMinutes 단위로 증가
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

function timeToMinutes(t) {
  if (!t || typeof t !== 'string') return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
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
  const today = new Date().toISOString().slice(0, 10);
  dateInput.value = today;

  buildTimeSelects();

  // 처음 로딩 시 오늘 날짜 기준 시간표
  loadReservationsAndBlocks();

  // 날짜를 바꾸면 자동으로 해당 날짜 시간표 로딩
  dateInput.addEventListener('change', () => {
    loadReservationsAndBlocks();
  });

  form.addEventListener('submit', submitReservation);
});

function buildTimeSelects() {
  const startSelect = document.getElementById('start-time');
  const endSelect = document.getElementById('end-time');
  if (!startSelect || !endSelect) return;

  startSelect.innerHTML = '';
  endSelect.innerHTML = '';

  // 시작 시간: 09:00 ~ 21:50 (10분 단위)
  for (let h = 9; h <= 21; h++) {
    for (let m = 0; m < 60; m += 10) {
      const t = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      startSelect.appendChild(opt);
    }
  }

  // 끝나는 시간: 09:10 ~ 22:00 (10분 단위)
  // → 끝나는 시간이 시작 시간보다 반드시 커야 하니까 조금 넉넉하게
  for (let h = 9; h <= 22; h++) {
    for (let m = 0; m < 60; m += 10) {
      const t = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      endSelect.appendChild(opt);
    }
  }
}


// 예약 + 수업 블록 모두 불러오기
async function loadReservationsAndBlocks() {
  const date = dateInput.value;
  if (!date) return;

  messageEl.textContent = '';

  try {
    const [resRes, blocksRes] = await Promise.all([
      fetch(`/api/reservations?date=${encodeURIComponent(date)}`),
      fetch(`/api/blocks?date=${encodeURIComponent(date)}`),
    ]);

    if (!resRes.ok) {
      const err = await resRes.json().catch(() => ({}));
      messageEl.textContent =
        err.error || '예약 목록을 불러오는 중 오류가 발생했습니다.';
      messageEl.style.color = 'red';
      return;
    }

    if (!blocksRes.ok) {
      const err = await blocksRes.json().catch(() => ({}));
      messageEl.textContent =
        err.error || '수업 시간표를 불러오는 중 오류가 발생했습니다.';
      messageEl.style.color = 'red';
      return;
    }

    const reservations = await resRes.json();
    const blocks = await blocksRes.json();

    currentReservations = reservations;
    currentBlocks = blocks;

    renderTimetable();
  } catch (err) {
    console.error(err);
    messageEl.textContent = '서버와 통신 중 오류가 발생했습니다.';
    messageEl.style.color = 'red';
  }
}

// 시간표 그리기
function renderTimetable() {
  timetableEl.innerHTML = '';
  selectedCell = null;

  const table = document.createElement('div');
  table.className = 'timetable-table';

  // 왼쪽 위 코너
  const corner = document.createElement('div');
  corner.className = 'tt-header tt-corner';
  corner.textContent = '시간';
  table.appendChild(corner);

  // 상단 헤더: 연습실
  ROOMS.forEach((room) => {
    const h = document.createElement('div');
    h.className = 'tt-header';
    h.textContent = `연습실 ${room}`;
    table.appendChild(h);
  });

  // 각 시간줄
  TIME_SLOTS.forEach((time, idx) => {
    // 왼쪽 시간 칸
    const timeCell = document.createElement('div');
    timeCell.className = 'tt-time';
    timeCell.textContent = time;
    table.appendChild(timeCell);

    // 각 연습실 칸
    ROOMS.forEach((room) => {
      const cell = document.createElement('div');
      cell.className = 'tt-cell';

      // 1) 수업 블록(검은 칸)인지 확인
      const block = currentBlocks.find(
        (b) =>
          String(b.room) === String(room) &&
          b.start <= time &&
          b.end > time
      );

      if (block) {
        // ✅ 수업 시간: 검은 칸, 클릭 불가
        cell.classList.add('tt-block');
        cell.textContent = '수업';
        table.appendChild(cell);
        return;
      }

      // 2) 예약된 칸인지 확인
      const reservation = currentReservations.find((r) => {
        return (
          String(r.room) === String(room) &&
          r.start <= time &&
          r.end > time
        );
      });

      if (reservation) {
        cell.classList.add('tt-busy');
        cell.innerHTML = `
          <div class="tt-student">${reservation.student}</div>
          <div class="tt-range">${reservation.start} ~ ${reservation.end}</div>
        `;

        cell.addEventListener('click', () => {
          // 파란 선택 제거
          if (selectedCell) {
            selectedCell.classList.remove('tt-selected');
            selectedCell = null;
          }

          const ok = window.confirm(
            `학생: ${reservation.student}\n시간: ${reservation.start} ~ ${reservation.end}\n\n` +
              '이 예약을 취소하시겠습니까?\n\n' +
              '※ [확인] → 취소 시도 (관리코드 필요)\n' +
              '※ [취소] → 아래 예약 폼에 이 정보만 채우기'
          );

          if (ok) {
            const code = window.prompt(
              '이 예약의 관리코드를 입력하세요.\n(처음 예약할 때 안내된 4자리 숫자)'
            );
            if (!code) return;
            cancelReservation(reservation.id, code);
          } else {
            // 변경 편하게 하도록 폼 채우기
            roomSelect.value = String(room);
            startInput.value = reservation.start;
            endInput.value = reservation.end;
            studentInput.value = reservation.student;
            studentInput.focus();
          }
        });
      } else {
        // 3) 비어있는 칸 (예약 가능)
        cell.classList.add('tt-free');
        cell.textContent = '비어있음';

        cell.addEventListener('click', () => {
          roomSelect.value = String(room);
          startInput.value = time;

          const next = TIME_SLOTS[idx + 1] || addMinutes(time, 60);
          endInput.value = next;

          studentInput.focus();

          if (selectedCell) {
            selectedCell.classList.remove('tt-selected');
          }
          cell.classList.add('tt-selected');
          selectedCell = cell;
        });
      }

      table.appendChild(cell);
    });
  });

  timetableEl.appendChild(table);
}

// 예약 취소 요청
async function cancelReservation(id, manageCode) {
  messageEl.textContent = '';

  try {
    const res = await fetch(`/api/reservations/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ manageCode }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      messageEl.textContent =
        data.error || '예약을 취소하는 중 오류가 발생했습니다.';
      messageEl.style.color = 'red';
      return;
    }

    messageEl.textContent = '예약이 취소되었습니다.';
    messageEl.style.color = 'green';

    loadReservationsAndBlocks();
  } catch (err) {
    console.error(err);
    messageEl.textContent = '서버 오류가 발생했습니다.';
    messageEl.style.color = 'red';
  }
}

// 예약 폼 전송
async function submitReservation(e) {
  e.preventDefault();
  messageEl.textContent = '';

  const start = document.getElementById('start-time').value;
const end = document.getElementById('end-time').value;
const msg = document.getElementById('message'); // 메시지 표시 div

if (end <= start) {
  msg.textContent = '끝나는 시간은 시작 시간보다 늦어야 합니다.';
  return;
}

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

    // 서버에서 되돌려준 4자리 관리코드
    const code =
      data.manage_code || data.manageCode || '(코드 정보를 받지 못했습니다)';

    alert(
      `예약이 저장되었습니다.\n\n` +
        `예약 관리코드: ${code}\n` +
        `이 코드는 나중에 예약 취소/변경할 때 필요합니다.\n` +
        `꼭 메모하거나 사진을 찍어 두세요.`
    );

    messageEl.innerHTML =
      '예약이 저장되었습니다.<br>' +
      `예약 관리코드: <strong>${code}</strong><br>` +
      '<small>※ 이 코드는 나중에 예약 변경/취소할 때 필요합니다. 꼭 메모하거나 사진을 찍어 두세요.</small>';
    messageEl.style.color = 'green';

    studentInput.value = '';

    loadReservationsAndBlocks();
  } catch (err) {
    console.error(err);
    messageEl.textContent = '서버 오류가 발생했습니다.';
    messageEl.style.color = 'red';
  }
}
