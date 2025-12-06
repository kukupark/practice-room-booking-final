// admin.js

// 전역 관리자 코드 (페이지 들어올 때 한 번만 입력)
let adminCode = null;

// 시간표 범위 (예: 9시~21시)
const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
// 연습실 번호
const ROOMS = [1, 2, 3, 4, 5];

// 오늘 날짜 YYYY-MM-DD
function getToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// 예약 목록을 이용해 관리자용 시간표 테이블 렌더링
function renderAdminTimetable(date, reservations) {
  const table = document.getElementById('admin-timetable');
  table.innerHTML = '';

  // th: 시간 + 방 헤더
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');

  const timeTh = document.createElement('th');
  timeTh.textContent = '시간';
  headRow.appendChild(timeTh);

  ROOMS.forEach((room) => {
    const th = document.createElement('th');
    th.textContent = `연습실 ${room}`;
    headRow.appendChild(th);
  });

  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  // (room-hour) → reservation 매핑
  const slotMap = {};

  reservations.forEach((item) => {
    const room = item.room;

    // 시작/끝 시간 컬럼 여러 패턴 지원
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

    if (!rawStart || !rawEnd || !room) return;

    const startHour = parseInt(String(rawStart).slice(0, 2), 10);
    const endHour = parseInt(String(rawEnd).slice(0, 2), 10);

    for (let h = startHour; h < endHour; h++) {
      const key = `${room}-${h}`;
      slotMap[key] = item;
    }
  });

  HOURS.forEach((hour) => {
    const tr = document.createElement('tr');

    // 왼쪽 시간 표시 칸
    const timeTd = document.createElement('td');
    timeTd.className = 'time-cell';
    timeTd.textContent = `${String(hour).padStart(2, '0')}:00`;
    tr.appendChild(timeTd);

    ROOMS.forEach((room) => {
      const td = document.createElement('td');
      td.className = 'slot-cell';

      const key = `${room}-${hour}`;
      const item = slotMap[key];

      if (item) {
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
          typeof rawStart === 'string'
            ? rawStart.slice(0, 5)
            : '';
        const endText =
          typeof rawEnd === 'string'
            ? rawEnd.slice(0, 5)
            : '';

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
      // JSON 파싱 실패 시 빈 배열로
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

// 시간표 칸 클릭 → 예약 취소
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
    // 다시 시간표 새로고침
    loadAdminReservations();
  } catch (err) {
    console.error(err);
    msg.textContent = '취소 요청 중 오류가 발생했습니다.';
  }
}

// 초기화: 페이지 들어올 때 한 번 관리자 코드 입력
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
