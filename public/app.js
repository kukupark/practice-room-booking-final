// app.js (학생/일반 예약 페이지)

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const ROOMS = [1, 2, 3, 4, 5];

let classSlots = []; // { room, hour }
let selectedCell = null;

// 오늘 날짜 (YYYY-MM-DD)
function getToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function timeToMinutes(t) {
  if (!t || typeof t !== 'string') return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// (room, hour)가 수업 칸인지 확인
function isClassSlotLocal(room, hour) {
  return classSlots.some(
    (s) => String(s.room) === String(room) && s.hour === hour
  );
}

// 시작/끝 시간 select를 10분 단위로 채우기
function buildTimeSelects() {
  const startSelect = document.getElementById('start-time');
  const endSelect = document.getElementById('end-time');
  if (!startSelect || !endSelect) return;

  startSelect.innerHTML = '';
  endSelect.innerHTML = '';

  // 시작: 09:00 ~ 21:50
  for (let h = 9; h <= 21; h++) {
    for (let m = 0; m < 60; m += 10) {
      const t = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      startSelect.appendChild(opt);
    }
  }

  // 끝: 09:10 ~ 22:00
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

// 시간표 렌더링
function renderTimetable(date, reservations) {
  const grid = document.getElementById('timetable');
  if (!grid) return;

  grid.innerHTML = '';

  // --- 헤더 행 ---
  const corner = document.createElement('div');
  corner.className = 'tt-header tt-corner';
  corner.textContent = '시간';
  grid.appendChild(corner);

  ROOMS.forEach((room) => {
    const h = document.createElement('div');
    h.className = 'tt-header';
    h.textContent = `연습실 ${room}`;
    grid.appendChild(h);
  });

  // --- (room-hour) → 예약 배열 매핑 ---
  const slotMap = {};

  (reservations || []).forEach((item) => {
    const room = item.room;
    if (!room) return;

    const rawStart = item.start || '';
    const rawEnd = item.end || item['end'] || '';

    if (!rawStart || !rawEnd) return;

    const startMin = timeToMinutes(rawStart);
    const endMin = timeToMinutes(rawEnd);

    HOURS.forEach((hour) => {
      const hourStart = hour * 60;
      const hourEnd = (hour + 1) * 60;

      if (startMin < hourEnd && endMin > hourStart) {
        const key = `${room}-${hour}`;
        if (!slotMap[key]) slotMap[key] = [];
        slotMap[key].push(item);
      }
    });
  });

  // --- 시간별 행 생성 ---
  HOURS.forEach((hour) => {
    // 왼쪽 시간 칸
    const timeDiv = document.createElement('div');
    timeDiv.className = 'tt-time';
    timeDiv.textContent = `${String(hour).padStart(2, '0')}:00`;
    grid.appendChild(timeDiv);

    // 연습실 칸들
    ROOMS.forEach((room) => {
      const cell = document.createElement('div');
      cell.className = 'tt-cell';

      const key = `${room}-${hour}`;
      const items = slotMap[key] || [];
      const isClass = isClassSlotLocal(room, hour);

      if (isClass) {
        // 수업 칸 (검은색)
        cell.classList.add('tt-block');

        // 보통 수업 시간에는 예약이 안 들어가지만,
        // 혹시 들어간 경우가 있으면 표시만 해 줌
        if (items.length > 0) {
          items.forEach((item) => {
            const rawName = item.student || '';
            const rawStart = item.start || '';
            const rawEnd = item.end || item['end'] || '';

            const startText =
              typeof rawStart === 'string' ? rawStart.slice(0, 5) : '';
            const endText =
              typeof rawEnd === 'string' ? rawEnd.slice(0, 5) : '';
            const name = typeof rawName === 'string' ? rawName : '';

            const line = document.createElement('div');
            line.className = 'tt-student';
            line.textContent = `${startText}~${endText} ${name || '예약됨'}`;
            cell.appendChild(line);
          });
        } else {
          const labelDiv = document.createElement('div');
          labelDiv.className = 'tt-student';
          labelDiv.textContent = '수업';
          cell.appendChild(labelDiv);
        }
      } else if (items.length > 0) {
        // 예약 차 있는 칸 (빨간색)
        cell.classList.add('tt-busy');

        items.forEach((item) => {
          const rawName = item.student || '';
          const rawStart = item.start || '';
          const rawEnd = item.end || item['end'] || '';

          const startText =
            typeof rawStart === 'string' ? rawStart.slice(0, 5) : '';
          const endText =
            typeof rawEnd === 'string' ? rawEnd.slice(0, 5) : '';
          const name = typeof rawName === 'string' ? rawName : '';

          const line = document.createElement('div');
          line.className = 'tt-student';
          line.textContent = `${startText}~${endText} ${name || '예약됨'}`;
          cell.appendChild(line);

          // 셀 클릭으로 취소 기능을 나중에 붙이려면 여기서 id 저장 가능
          cell.dataset.id = item.id;
        });
      } else {
        // 비어있는 칸
        cell.classList.add('tt-free');
        cell.dataset.room = room;
        cell.dataset.hour = hour;
        cell.addEventListener('click', onFreeCellClick);
      }

      grid.appendChild(cell);
    });
  });
}

// 날짜별 예약 + 수업 블록 가져오기
async function loadDay() {
  const dateInput = document.getElementById('date');
  const msg = document.getElementById('message');
  if (!dateInput) return;

  const date = dateInput.value;
  if (!date) return;

  msg.textContent = '시간표를 불러오는 중입니다...';

  try {
    const [resRes, blocksRes] = await Promise.all([
      fetch(`/api/reservations?date=${encodeURIComponent(date)}`),
      fetch(`/api/blocks?date=${encodeURIComponent(date)}`),
    ]);

    let reservations = [];
    let blocks = [];

    try {
      reservations = await resRes.json();
    } catch {
      reservations = [];
    }

    try {
      blocks = await blocksRes.json();
    } catch {
      blocks = [];
    }

    if (!resRes.ok) {
      msg.textContent =
        (reservations && reservations.error) ||
        `예약 조회 실패 (status ${resRes.status})`;
      reservations = [];
    }

    if (!blocksRes.ok) {
      console.error('수업 블록 응답 오류:', blocks);
      blocks = [];
    }

    // blocks → classSlots(room, hour)로 변환
    classSlots = [];
    (blocks || []).forEach((b) => {
      const room = b.room;
      const start = b.start || '';
      const end = b.end || '';
      if (!room || !start || !end) return;

      const startMin = timeToMinutes(start);
      const endMin = timeToMinutes(end);

      const firstHour = Math.floor(startMin / 60);
      const lastHourExclusive = Math.ceil(endMin / 60);

      for (let h = firstHour; h < lastHourExclusive; h++) {
        classSlots.push({ room, hour: h });
      }
    });

    renderTimetable(date, reservations);

    if (!reservations || reservations.length === 0) {
      msg.textContent = '해당 날짜에 예약이 없습니다.';
    } else {
      msg.textContent = '';
    }
  } catch (err) {
    console.error(err);
    msg.textContent = '시간표를 불러오는 중 오류가 발생했습니다.';
  }
}

// 빈 칸 클릭 → 선택 + 폼에 값 채우기
function onFreeCellClick(event) {
  const cell = event.currentTarget;
  const room = cell.dataset.room;
  const hour = parseInt(cell.dataset.hour, 10);

  if (selectedCell) {
    selectedCell.classList.remove('tt-selected');
  }
  selectedCell = cell;
  cell.classList.add('tt-selected');

  const roomSelect = document.getElementById('room-select');
  const startSelect = document.getElementById('start-time');
  const endSelect = document.getElementById('end-time');

  if (roomSelect) {
    roomSelect.value = String(room);
  }

  const startTimeStr = `${String(hour).padStart(2, '0')}:00`;
  const endTimeStr = `${String(hour + 1).padStart(2, '0')}:00`;

  if (startSelect) {
    const hasStart = Array.from(startSelect.options).some(
      (o) => o.value === startTimeStr
    );
    if (hasStart) startSelect.value = startTimeStr;
  }

  if (endSelect) {
    const hasEnd = Array.from(endSelect.options).some(
      (o) => o.value === endTimeStr
    );
    if (hasEnd) endSelect.value = endTimeStr;
  }
}

// 예약 폼 제출
async function handleReserveSubmit(e) {
  e.preventDefault();

  const dateInput = document.getElementById('date');
  const roomSelect = document.getElementById('room-select');
  const studentInput = document.getElementById('student-name');
  const startSelect = document.getElementById('start-time');
  const endSelect = document.getElementById('end-time');
  const msg = document.getElementById('message');

  const date = dateInput.value;
  const room = roomSelect.value;
  const student = (studentInput.value || '').trim();
  const start = startSelect.value;
  const end = endSelect.value;

  if (!date || !room || !student || !start || !end) {
    msg.textContent = '날짜, 연습실, 이름, 시작/끝 시간을 모두 입력해주세요.';
    return;
  }

  if (end <= start) {
    msg.textContent = '끝나는 시간은 시작 시간보다 늦어야 합니다.';
    return;
  }

  msg.textContent = '예약을 전송하는 중입니다...';

  try {
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room, date, start, end, student }),
    });

    const data = await res.json();

    if (!res.ok) {
      msg.textContent = data.error || '예약 중 오류가 발생했습니다.';
      return;
    }

    msg.textContent = `예약이 완료되었습니다. (관리코드: ${
      data.manage_code || '****'
    })`;

    // 예약 완료 후 시간표 새로고침
    await loadDay();
  } catch (err) {
    console.error(err);
    msg.textContent = '예약 요청 중 오류가 발생했습니다.';
  }
}

// 초기화
window.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('date');
  const form = document.getElementById('reserve-form');

  if (dateInput) {
    dateInput.value = getToday();
    dateInput.addEventListener('change', loadDay);
  }

  buildTimeSelects();

  if (form) {
    form.addEventListener('submit', handleReserveSubmit);
  }

  loadDay();
});
