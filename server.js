// server.js

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// JSON 형식(body) 읽기
app.use(express.json());

// public 폴더 정적 파일 서비스
app.use(express.static(path.join(__dirname, 'public')));

// ------------------------------
//  파일에 저장해서 예약 유지하기
// ------------------------------
const DATA_FILE = path.join(__dirname, 'reservations.json');

let reservations = []; // {id, room, date, start, end, student}
let nextId = 1;

// 서버 시작할 때 파일에서 예약 불러오기
function loadReservations() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      if (raw.trim().length > 0) {
        const parsed = JSON.parse(raw);

        // { reservations: [...], nextId: 3 } 형식으로 저장할 예정
        if (Array.isArray(parsed.reservations)) {
          reservations = parsed.reservations;
        } else if (Array.isArray(parsed)) {
          // 혹시 옛날 형식으로 저장돼 있으면
          reservations = parsed;
        }

        if (typeof parsed.nextId === 'number') {
          nextId = parsed.nextId;
        } else {
          // id 최대값 + 1 로 추정
          nextId =
            reservations.reduce((max, r) => Math.max(max, r.id || 0), 0) + 1;
        }
      }
    } else {
      // 파일이 없으면 처음 시작하는 것 → 그냥 빈 배열
      reservations = [];
      nextId = 1;
    }
    console.log(
      `예약 ${reservations.length}개 로드됨 (다음 id: ${nextId})`
    );
  } catch (err) {
    console.error('예약 파일 읽는 중 오류:', err);
    reservations = [];
    nextId = 1;
  }
}

// 예약을 파일에 저장하기
function saveReservations() {
  const dataToSave = {
    reservations,
    nextId,
  };
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave, null, 2), 'utf8');
    console.log('예약 데이터 저장 완료');
  } catch (err) {
    console.error('예약 파일 저장 중 오류:', err);
  }
}

// 서버 시작 시 한 번 불러오기
loadReservations();

// ------------------------------
//  API 라우트
// ------------------------------

// 날짜별 예약 목록 가져오기
// 예: GET /api/reservations?date=2025-12-04
app.get('/api/reservations', (req, res) => {
  const date = req.query.date;
  if (!date) {
    return res
      .status(400)
      .json({ error: 'date 파라미터가 필요합니다. (예: ?date=2025-12-04)' });
  }

  const list = reservations.filter((r) => r.date === date);
  res.json(list);
});

// 새 예약 추가
// body: { room, date, start, end, student }
app.post('/api/reservations', (req, res) => {
  const { room, date, start, end, student } = req.body;

  if (!room || !date || !start || !end || !student) {
    return res.status(400).json({
      error:
        '모든 항목(연습실, 날짜, 시작시간, 끝시간, 학생이름)을 입력해주세요.',
    });
  }

  // 같은 연습실, 같은 날짜에서 시간 겹치는지 체크
  const conflict = reservations.some((r) => {
    if (r.room !== room || r.date !== date) return false;
    // 겹치지 않는 경우: 기존.end <= 새.start  또는  기존.start >= 새.end
    return !(r.end <= start || r.start >= end);
  });

  if (conflict) {
    return res.status(400).json({ error: '이미 예약이 있는 시간입니다.' });
  }

  const newRes = {
    id: nextId++,
    room,
    date,
    start,
    end,
    student,
  };

  reservations.push(newRes);
  // 👉 새 예약 추가할 때마다 파일로 저장
  saveReservations();

  res.json(newRes);
});

// ------------------------------
// 서버 실행
// ------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버 실행 중: 포트 ${PORT}에서 서버 실행 중`);
});
