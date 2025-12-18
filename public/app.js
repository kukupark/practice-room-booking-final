// app.js (학생/일반 예약 페이지)

// 1시간 단위로 보이는 시간대
const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
// 연습실 1~5
const ROOMS = [1, 2, 3, 4, 5];

// 수업(검은칸) 정보
let classSlots = []; // { room, hour }

// 선택된 시간표 칸(파란 테두리)
let selectedCell = null;

// 현재 날짜 & 예약 목록 (10분 단위 세부 바 계산용)
let currentDate = null;
let currentReservations = [];

// 10분 세부 바용 선택 상태
let selectedSlot = null;      // { room, hour }
let detailStartIndex = null;  // 0~5 (각각 10분 단위 segment 시작 index)

// 오늘 날짜(YYYY-MM-DD)
function getToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// "HH:MM" → 분(minute)
function timeToMinutes(t) {
  if (!t || typeof t !== 'string') return NaN;
  const parts = t.split(':');
  if (parts.length < 2) return NaN;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
  return h * 60 + m;
}

// 분 → "HH:MM"
function minutesToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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
      const t = `${String(h).padStart(2, '0')}:${String(m)
        .toString()
        .padStart(2, '0')}`;
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      startSelect.appendChild(opt);
    }
  }

  // 끝: 09:10 ~ 22:00
  for (let h = 9; h <= 22; h++) {
    for (let m = 0; m < 60; m += 10) {
      const t = `${String(h).padStart(2, '0')}:${String(m)
        .toString()
        .padStart(2, '0')}`;
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      endSelect.appendChild(opt);
    }
  }
}

// 1시간 단위 시간표 렌더링
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

  // --- (room-hour) → 예약 배열 매핑 (10분 단위 고려) ---
  const slotMap = {};

  (reservations || []).forEach((item) => {
    const room = item.room;
    if (!room) return;

    const rawStart = item.start || '';
    const rawEnd = item.end || item['end'] || '';

    if (!rawStart || !rawEnd) return;

    const startMin = timeToMinutes(rawStart);
    const endMin = timeToMinutes(rawEnd);
    if (Number.isNaN(startMin) || Number.isNaN(endMin)) return;

    HOURS.forEach((hour) => {
      const hourStart = hour * 60;
      const hourEnd = (hour + 1) * 60;

      // [startMin, endMin) 와 [hourStart, hourEnd) 겹치면
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
            line.textContent = `${startText}~${endText} ${
              name || '예약됨'
            }`;
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
          line.textContent = `${startText}~${endText} ${
            name || '예약됨'
          }`;
          cell.appendChild(line);

          // 필요하면 예약 취소용 id 저장 가능
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

    // 🔹 전역 상태 업데이트
    currentDate = date;
    currentReservations = reservations || [];

    // blocks → classSlots(room, hour)
    classSlots = [];
    (blocks || []).forEach((b) => {
      const room = b.room;
      const start = b.start || '';
      const end = b.end || '';
      if (!room || !start || !end) return;

      const startMin = timeToMinutes(start);
      const endMin = timeToMinutes(end);
      if (Number.isNaN(startMin) || Number.isNaN(endMin)) return;

      const firstHour = Math.floor(startMin / 60);
      const lastHourExclusive = Math.ceil(endMin / 60);

      for (let h = firstHour; h < lastHourExclusive; h++) {
        classSlots.push({ room, hour: h });
      }
    });

    // 시간표 갱신
    renderTimetable(date, reservations);

    // 선택 상태 초기화 + 세부바 비우기
    selectedCell = null;
    selectedSlot = null;
    detailStartIndex = null;
    renderDetailBar();

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

// 빈 칸 클릭 → 시간표 칸 선택 + 기본 1시간 설정 + 세부바 표시
function onFreeCellClick(event) {
  const cell = event.currentTarget;
  const room = cell.dataset.room;
  const hour = parseInt(cell.dataset.hour, 10);

  // 시간표 칸 하이라이트
  if (selectedCell) {
    selectedCell.classList.remove('tt-selected');
  }
  selectedCell = cell;
  cell.classList.add('tt-selected');

  // 전역 선택 슬롯 상태
  selectedSlot = { room: Number(room), hour };
  detailStartIndex = null; // 세부 선택 초기화

  // 폼 기본값: 해당 시간 1시간 범위
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

  // 🔹 10분 단위 세부 선택 바 렌더링
  renderDetailBar();
}

// 10분 단위 세부 선택 바 렌더링
function renderDetailBar() {
  const bar = document.getElementById('detail-bar');
  if (!bar) return;

  bar.innerHTML = '';

  if (!selectedSlot || !currentDate) {
    // 선택된 칸이 없으면 아무것도 표시하지 않음
    return;
  }

  const { room, hour } = selectedSlot;

  const header = document.createElement('div');
  header.className = 'detail-bar-header';
  header.textContent = `연습실 ${room} · ${String(hour).padStart(
    2,
    '0'
  )}:00 ~ ${String(hour + 1).padStart(2, '0')}:00 세부 예약`;
  bar.appendChild(header);

  const slotsWrap = document.createElement('div');
  slotsWrap.className = 'detail-bar-slots';

  const baseMin = hour * 60;

  // 한 시간(60분)을 10분씩 6 segment로 나누기
  for (let i = 0; i < 6; i++) {
    const slotStart = baseMin + i * 10;
    const slotEnd = slotStart + 10;
    const label = minutesToTime(slotStart);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'detail-slot';
    btn.textContent = label;

    // 해당 10분 구간에 기존 예약이 있는지 체크
    const reserved = (currentReservations || []).some((r) => {
      if (String(r.room) !== String(room)) return false;
      const rs = timeToMinutes(r.start || '');
      const re = timeToMinutes(r.end || r['end'] || '');
      if (Number.isNaN(rs) || Number.isNaN(re)) return false;
      return rs < slotEnd && re > slotStart;
    });

    if (reserved) {
      btn.classList.add('detail-slot-reserved');
      btn.disabled = true;
    } else {
      btn.addEventListener('click', () => onDetailSlotClick(i));
    }

    slotsWrap.appendChild(btn);
  }

  bar.appendChild(slotsWrap);
}

// 10분 블록 클릭 로직
function onDetailSlotClick(index) {
  const totalSegments = 6;
  if (!selectedSlot) return;

  // 첫 클릭 → 시작 index 설정 + 기본 30분 정도 선택
  if (detailStartIndex === null) {
    detailStartIndex = index;
    let endIdx = index + 3; // 기본 30분(3칸)
    if (endIdx > totalSegments) endIdx = totalSegments;
    applyDetailSelection(detailStartIndex, endIdx);
  } else {
    // 두 번째 클릭:
    //  - 이전보다 뒤를 클릭하면 → 그 지점까지를 종료로 보고 확정
    //  - 같거나 앞을 클릭하면 → 새 시작 지점으로 다시 시작
    if (index <= detailStartIndex) {
      detailStartIndex = index;
      let endIdx = index + 3;
      if (endIdx > totalSegments) endIdx = totalSegments;
      applyDetailSelection(detailStartIndex, endIdx);
    } else {
      const endIdx = index + 1;
      applyDetailSelection(detailStartIndex, endIdx);
      // 한 번 범위를 정했으니 다음 클릭은 새 구간으로 시작
      detailStartIndex = null;
    }
  }
}

// 선택된 10분 범위를 하이라이트 + 폼에 반영
function applyDetailSelection(startIdx, endIdx) {
  const bar = document.getElementById('detail-bar');
  if (!bar || !selectedSlot) return;

  const buttons = bar.querySelectorAll('.detail-slot');
  buttons.forEach((btn, i) => {
    if (i >= startIdx && i < endIdx && !btn.disabled) {
      btn.classList.add('detail-slot-selected');
    } else {
      btn.classList.remove('detail-slot-selected');
    }
  });

  const startSelect = document.getElementById('start-time');
  const endSelect = document.getElementById('end-time');
  if (!startSelect || !endSelect) return;

  const baseMin = selectedSlot.hour * 60;
  const selStartMin = baseMin + startIdx * 10;
  const selEndMin = baseMin + endIdx * 10;

  const startStr = minutesToTime(selStartMin);
  const endStr = minutesToTime(selEndMin);

  const hasStart = Array.from(startSelect.options).some(
    (o) => o.value === startStr
  );
  if (hasStart) startSelect.value = startStr;

  const hasEnd = Array.from(endSelect.options).some(
    (o) => o.value === endStr
  );
  if (hasEnd) endSelect.value = endStr;
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

    // 새 예약이 들어갔으니, 시간표/세부바 다시 불러오기
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
