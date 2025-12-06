// admin.js

// 오늘 날짜를 YYYY-MM-DD 형식으로 리턴
function getToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function loadAdminReservations() {
  const dateInput = document.getElementById('admin-date');
  const date = dateInput.value;
  const tbody = document.getElementById('admin-reservations-body');
  const msg = document.getElementById('admin-message');

  if (!date) return;

  tbody.innerHTML = '';
  msg.textContent = '예약을 불러오는 중입니다...';

  try {
    const res = await fetch(`/api/admin/reservations?date=${encodeURIComponent(date)}`);
    if (!res.ok) {
      throw new Error('예약 조회 실패');
    }
    const data = await res.json();

    if (!data || data.length === 0) {
      msg.textContent = '해당 날짜에 예약이 없습니다.';
      return;
    }

    msg.textContent = '';
    data.forEach((item) => {
      const tr = document.createElement('tr');

      // 시간 문자열 예쁘게
      const start = item.start_time?.slice(0, 5);
      const end = item.end_time?.slice(0, 5);

      tr.innerHTML = `
        <td>${start} ~ ${end}</td>
        <td>연습실 ${item.room}</td>
        <td>${item.student_name}</td>
        <td>${item.manage_code}</td>
        <td>
          <button class="btn btn-primary btn-sm" data-id="${item.id}">
            강제 취소
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // 강제 취소 버튼 이벤트 연결
    tbody.querySelectorAll('button[data-id]').forEach((btn) => {
      btn.addEventListener('click', onForceCancel);
    });
  } catch (err) {
    console.error(err);
    msg.textContent = '예약을 불러오는 중 오류가 발생했습니다.';
  }
}

async function onForceCancel(event) {
  const id = event.currentTarget.getAttribute('data-id');
  const msg = document.getElementById('admin-message');

  const adminCode = prompt('관리자 코드를 입력하세요:');
  if (!adminCode) return;

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
    // 다시 목록 새로고침
    loadAdminReservations();
  } catch (err) {
    console.error(err);
    msg.textContent = '취소 요청 중 오류가 발생했습니다.';
  }
}

// 초기화
window.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('admin-date');
  dateInput.value = getToday();

  // 날짜 바뀌면 자동으로 목록 다시 로드
  dateInput.addEventListener('change', loadAdminReservations);

  // 첫 로딩 때도 오늘 날짜로 조회
  loadAdminReservations();
});
