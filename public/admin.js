// admin.js

// 페이지 들어올 때 한 번만 관리자 코드 입력
let adminCode = null;

// 시간 / 연습실 범위 (학생 페이지와 동일)
const HOURS = [9,10,11,12,13,14,15,16,17,18,19,20,21];
const ROOMS = [1,2,3,4,5];

// 서버에서 받은 수업 칸 (room, hour)
let classSlots = [];

// 오늘 날짜 (YYYY-MM-DD)
function getToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// (room, hour)가 수업 칸인지 확인
function isClassSlotLocal(room, hour) {
  return classSlots.some(
    (s) => String(s.room) === String(room) && s.hour === hour
  );
}

// 관리자용 시간표 그리드 렌더링
function renderAdminTimetable(date, reservations) {
  const grid = document.getElementById('admin-timetable');
  if (!grid) return;

  grid.innerHTML = '';

  // --- 헤더 행 ---
  // 왼쪽 코너: "시간"
  const corner = document.createElement('div');
  corner.className = 'tt-header tt-corner';
  corner.textContent = '시간';
  grid.appendChild(corner);

  // 연습실 1~5
  ROOMS.forEach((room) => {
    const h = document.createElement('div');
    h.className = 'tt-header';
    h.textContent = `연습실 ${room}`;
    grid.appendChild(h);
  });

  // --- (room-hour) → 예약 매핑 ---
  const slotMap = {};

  (reservations || []).forEach((item) => {
    const room = item.room;
    if (!room) return;

    const rawStart = item.start || '';
    const rawEnd = item.end || item['end'] || '';

    if (!rawStart || !rawEnd) return;

    const startHour = parseInt(String(rawStart).slice(0, 2), 10);
    const endHour   = parseInt(String(rawEnd).slice(0, 2), 10);

    for (let h = startHour; h < endHour; h++) {
      const key = `${room}-${h}`;
      slotMap[key] = item;
    }
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
      const item = slotMap[key];
      const isClass = isClassSlotLocal(room, hour);

      if (isClass) {
        // ── 수업 칸 (검은색) ──
        cell.classList.add('tt-block');

        if (item) {
          // 수업시간 + 예약까지 있는 경우 → 예약정보 표시 + 클릭시 취소
          const rawName  = item.student || '';
          const rawStart = item.start  || '';
          const rawEnd   = item.end    || item['end'] || '';

          const startText =
            typeof rawStart === 'string' ? rawStart.slice(0, 5) : '';
          const endText =
            typeof rawEnd === 'string' ? rawEnd.slice(0, 5) : '';
          const name =
            typeof rawName === 'string' ? rawName : '';

          const nameDiv = document.createElement('div');
          nameDiv.className = 'tt-student';
          nameDiv.textContent = name || '예약됨';

          const rangeDiv = document.createElement('div');
          rangeDiv.className = 'tt-range';
          rangeDiv.textContent = `${startText} ~ ${endText}`;

          cell.appendChild(nameDiv);
          cell.appendChild(rangeDiv);

          cell.dataset.id = item.id;
          cell.dataset.name = name || '예약';
          cell.dataset.time = timeDiv.textContent;
          cell.addEventListener('click', onSlotClick);
        } else {
          // 순수 수업 칸
          const labelDiv = document.createElement('div');
          labelDiv.className = 'tt-student';
          labelDiv.textContent = '수업';
          cell.appendChild(labelDiv);
        }
      } else if (item) {
        // ── 일반 예약 칸 (빨간색) ──
        cell.classList.add('tt-busy');

        const rawName  = item.student || '';
        const rawStart = item.start  || '';
        const rawEnd   = item.end    || item['end'] || '';

        const startText =
          typeof rawStart === 'string' ? rawStart.slice(0, 5) : '';
        const endText =
          typeof rawEnd === 'string' ? rawEnd.slice(0, 5) : '';
        const name =
          typeof rawName === 'string' ? rawName : '';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'tt-student';
        nameDiv.textContent = name || '예약됨';

        const rangeDiv = document.createElement('div');
        rangeDiv.className = 'tt-range';
        rangeDiv.textContent = `${startText} ~ ${endText}`;

        cell.appendChild(nameDiv);
        cell.appendChild(rangeDiv);

        cell.dataset.id = item.id;
        cell.dataset.name = name || '예약';
        cell.dataset.time = timeDiv.textContent;
        cell.addEventListener('click', onSlotClick);
      } else {
        // ── 빈 칸 ──
        cell.classList.add('tt-free');
        // 텍스트는 비워둠 (원하면 '비어있음' 같은 표시 가능)
      }

      grid.appendChild(cell);
    });
  });
}

// 날짜별 예약 + 수업블록 함께 불러오기
async function loadAdminDay() {
  const dateInput = document.getElementById('admin-date');
  const date = dateInput.value;
  const msg = document.getElementById('admin-message');

  if (!date) return;

  msg.textContent = '예약을 불러오는 중입니다...';

  try {
    const [resRes, blocksRes] = await Promise.all([
      fetch(`/api/admin/reservations?date=${encodeURIComponent(date)}`),
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
      const end   = b.end   || '';

      if (!room || !start || !end) return;

      const startHour = parseInt(String(start).slice(0, 2), 10);
      const endHour   = parseInt(String(end).slice(0, 2), 10);

      for (let h = startHour; h < endHour; h++) {
        classSlots.push({ room, hour: h });
      }
    });

    renderAdminTimetable(date, reservations);

    if (!reservations || reservations.length === 0) {
      msg.textContent = '해당 날짜에 예약이 없습니다.';
    } else {
      msg.textContent = '';
    }
  } catch (err) {
    console.error(err);
    msg.textContent = '예약을 불러오는 중 알 수 없는 오류가 발생했습니다.';
  }
}

// 칸 클릭 → 예약 강제 취소
async function onSlotClick(event) {
  const msg = document.getElementById('admin-message');
  const cell = event.currentTarget;

  const id = cell.dataset.id;
  const name = cell.dataset.name;
  const timeLabel = cell.dataset.time;

  if (!id) return;

  if (!adminCode) {
    alert('관리자 코드가 없습니다. 페이지를 새로고침해서 다시 로그인해 주세요.');
    return;
  }

  const ok = confirm(`${timeLabel} ${name} 예약을 취소할까요?`);
  if (!ok) return;

  try {
    const res = await fetch(`/api/admin/reservations/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminCode }),
    });

    const data = await res.json();

    if (!res.ok) {
      msg.textContent = data.error || '취소 중 오류가 발생했습니다.';
      return;
    }

    msg.textContent = '예약이 강제 취소되었습니다.';
    loadAdminDay();
  } catch (err) {
    console.error(err);
    msg.textContent = '취소 요청 중 오류가 발생했습니다.';
  }
}

// 초기화
window.addEventListener('DOMContentLoaded', () => {
  adminCode = prompt('관리자 코드를 입력하세요:');
  if (!adminCode) {
    alert('관리자 코드가 없으면 취소 기능을 사용할 수 없습니다.');
  }

  const dateInput = document.getElementById('admin-date');
  dateInput.value = getToday();
  dateInput.addEventListener('change', loadAdminDay);

  loadAdminDay();
});
