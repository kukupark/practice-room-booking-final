// admin.js

let adminCode = null;

// 시간표 설정 (예약 페이지와 동일한 시간대 사용)
const HOURS = [9,10,11,12,13,14,15,16,17,18,19,20,21];
const ROOMS = [1,2,3,4,5];

// ===== 수업 시간표 =====
// ⬇⬇⬇ 여기 CLASS_SCHEDULE 내용은
// 예약 페이지(app.js)에 있는 CLASS_SCHEDULE와 똑같이 맞춰 주세요.
// (app.js에서 복사해서 그대로 붙여넣는 걸 추천!)
const CLASS_SCHEDULE = [
  // 예시: 월요일(1) 연습실 1, 16~18시 수업
  // { day: 1, room: 1, startHour: 16, endHour: 18 },
  // 예시: 수요일(3) 연습실 2, 17~19시 수업
  // { day: 3, room: 2, startHour: 17, endHour: 19 },
];

// 지정 날짜/연습실/시간이 수업인지 확인
function isClassSlot(dateStr, room, hour) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const day = d.getDay(); // 0:일,1:월,...6:토

  return CLASS_SCHEDULE.some(cls =>
    cls.day === day &&
    cls.room === room &&
    hour >= cls.startHour &&
    hour < cls.endHour
  );
}

// 오늘 날짜 YYYY-MM-DD
function getToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// 관리자 시간표 렌더링
function renderAdminTimetable(date, reservations) {
  const table = document.getElementById('admin-timetable');
  table.innerHTML = '';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');

  const timeTh = document.createElement('th');
  timeTh.textContent = '시간';
  headRow.appendChild(timeTh);

  ROOMS.forEach(room => {
    const th = document.createElement('th');
    th.textContent = `연습실 ${room}`;
    headRow.appendChild(th);
  });

  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  // (room-hour) → 예약 데이터 매핑
  const slotMap = {};

  (reservations || []).forEach(item => {
    const room = item.room;
    if (!room) return;

    const rawStart =
      item.start_time ||
      item.start ||
      item.begin_time ||
      item.begin ||
      item.from_time ||
      '';
    const rawEnd =
      item.end_time ||
      item.end ||
      item.finish_time ||
      item.finish ||
      item.to_time ||
      '';

    if (!rawStart || !rawEnd) return;

    const startHour = parseInt(String(rawStart).slice(0, 2), 10);
    const endHour = parseInt(String(rawEnd).slice(0, 2), 10);

    for (let h = startHour; h < endHour; h++) {
      const key = `${room}-${h}`;
      slotMap[key] = item;
    }
  });

  HOURS.forEach(hour => {
    const tr = document.createElement('tr');

    const timeTd = document.createElement('td');
    timeTd.className = 'time-cell';
    timeTd.textContent = `${String(hour).padStart(2, '0')}:00`;
    tr.appendChild(timeTd);

    ROOMS.forEach(room => {
      const td = document.createElement('td');
      td.className = 'slot-cell';

      const key = `${room}-${hour}`;
      const item = slotMap[key];
      const isClass = isClassSlot(date, room, hour);

      if (isClass) {
        // ---- 수업 시간 칸 (검은색) ----
        td.classList.add('slot-class');

        if (item) {
          // 수업 시간이지만 예약이 들어간 경우 → 이름/시간 표시 + 취소 가능
          const rawName =
            item.student_name || item.student || item.name || '';
          const rawStart =
            item.start_time ||
            item.start ||
            item.begin_time ||
            item.begin ||
            item.from_time ||
            '';
          const rawEnd =
            item.end_time ||
            item.end ||
            item.finish_time ||
            item.finish ||
            item.to_time ||
            '';

          const startText =
            typeof rawStart === 'string' ? rawStart.slice(0, 5) : '';
          const endText =
            typeof rawEnd === 'string' ? rawEnd.slice(0, 5) : '';
          const name =
            typeof rawName === 'string' ? rawName : '';

          td.innerHTML = `
            <div class="slot-main">${name || '예약됨'}</div>
            <div class="slot-sub">${startText} ~ ${endText}</div>
          `;
          td.dataset.id = item.id;
          td.dataset.name = name || '예약';
          td.dataset.time = timeTd.textContent;
          td.addEventListener('click', onSlotClick);
        } else {
          // 순수 수업 칸: "수업" 표시, 클릭해도 취소 안됨
          td.innerHTML = `<div class="slot-main">수업</div>`;
        }
      } else if (item) {
        // ---- 일반 예약 칸 (파란색) ----
        td.classList.add('slot-reserved');

        const rawName =
          item.student_name || item.student || item.name || '';
        const rawStart =
          item.start_time ||
          item.start ||
          item.begin_time ||
          item.begin ||
          item.from_time ||
          '';
        const rawEnd =
          item.end_time ||
          item.end ||
          item.finish_time ||
          item.finish ||
          item.to_time ||
          '';

        const startText =
          typeof rawStart === 'string' ? rawStart.slice(0, 5) : '';
        const endText =
          typeof rawEnd === 'string' ? rawEnd.slice(0, 5) : '';
        const name =
          typeof rawName === 'string' ? rawName : '';

        td.innerHTML = `
          <div class="slot-main">${name || '예약됨'}</div>
          <div class="slot-sub">${startText} ~ ${endText}</div>
        `;
        td.dataset.id = item.id;
        td.dataset.name = name || '예약';
        td.dataset.time = timeTd.textContent;
        td.addEventListener('click', onSlotClick);
      } else {
        // ---- 빈 칸 (흰색) ----
        td.classList.add('slot-empty');
        td.textContent = '';
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
}

async function loadAdminReservations() {
  const dateInput = document.getElementById('admin-date');
  const date = dateInput.value;
  const msg = document.getElementById('admin-message');

  if (!date) return;

  msg.textContent = '예약을 불러오는 중입니다...';

  try {
    const res = await fetch(
      `/api/admin/reservations?date=${encodeURIComponent(date)}`
    );
    let data = [];

    try {
      data = await res.json();
    } catch (e) {
      data = [];
    }

    if (!res.ok) {
      msg.textContent =
        (data && data.error) ||
        `예약 조회 실패 (status ${res.status})`;
      renderAdminTimetable(date, []);
      return;
    }

    renderAdminTimetable(date, data);

    if (!data || data.length === 0) {
      msg.textContent = '해당 날짜에 예약이 없습니다.';
    } else {
      msg.textContent = '';
    }
  } catch (err) {
    console.error(err);
    msg.textContent = '예약을 불러오는 중 알 수 없는 오류가 발생했습니다.';
  }
}

// 시간표 칸 클릭 → 강제 취소
async function onSlotClick(event) {
  const msg = document.getElementById('admin-message');
  const td = event.currentTarget;

  const id = td.dataset.id;
  const name = td.dataset.name;
  const timeLabel = td.dataset.time;

  if (!id) return;

  if (!adminCode) {
    alert('관리자 코드가 없습니다. 페이지를 새로고침해서 다시 로그인해 주세요.');
    return;
  }

  const ok = confirm(
    `${timeLabel} ${name} 예약을 취소할까요?`
  );
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
    loadAdminReservations();
  } catch (err) {
    console.error(err);
    msg.textContent = '취소 요청 중 오류가 발생했습니다.';
  }
}

// 초기화: 페이지 들어올 때 한 번만 관리자 코드 입력
window.addEventListener('DOMContentLoaded', () => {
  adminCode = prompt('관리자 코드를 입력하세요:');
  if (!adminCode) {
    alert('관리자 코드가 없으면 취소 기능을 사용할 수 없습니다.');
  }

  const dateInput = document.getElementById('admin-date');
  dateInput.value = getToday();

  dateInput.addEventListener('change', loadAdminReservations);

  loadAdminReservations();
});
