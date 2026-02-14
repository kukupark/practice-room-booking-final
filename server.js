// server.js
const ADMIN_CODE = process.env.ADMIN_CODE || '9999';

const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();

// ------------------------------
//  PostgreSQL 연결 설정
// ------------------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// ------------------------------
//  주간 수업 시간표 (class_schedule.csv에서 읽기)
//  weekday: 1=월, ..., 7=일
//  room: 연습실 번호
//  start, end: "HH:MM"
// ------------------------------
let weeklyLessons = []; // { weekday, room, start, end }

function loadWeeklyLessons() {
  const filePath = path.join(__dirname, 'class_schedule.csv');

  if (!fs.existsSync(filePath)) {
    console.log(
      'class_schedule.csv 파일이 없어 수업 블록 없이 동작합니다. (검은 칸 없음)'
    );
    weeklyLessons = [];
    return;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8').trim();
    if (!content) {
      weeklyLessons = [];
      console.log('class_schedule.csv 내용이 비어 있습니다.');
      return;
    }

    const lines = content.split(/\r?\n/);

    // 첫 줄은 헤더(weekday,room,start,end)
    weeklyLessons = lines
      .slice(1)
      .map((line) => line.split(','))
      .map(([weekdayStr, roomStr, start, end]) => {
        const weekday = parseInt((weekdayStr || '').trim(), 10);
        const room = parseInt((roomStr || '').trim(), 10);
        return {
          weekday,
          room,
          start: (start || '').trim(),
          end: (end || '').trim(),
        };
      })
      .filter(
        (item) =>
          !Number.isNaN(item.weekday) &&
          !Number.isNaN(item.room) &&
          item.start &&
          item.end
      );

    console.log('주간 수업 시간표 로드 완료:', weeklyLessons);
  } catch (err) {
    console.error('class_schedule.csv 읽기 중 오류:', err);
    weeklyLessons = [];
  }
}

// 특정 날짜(YYYY-MM-DD)에 해당하는 수업 블록 가져오기
function getLessonsForDate(dateStr) {
  if (!weeklyLessons.length) return [];

  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return [];

  // JS: 0=일, 1=월, ... 6=토 → 우리가 쓰는 1~7로 변환
  const jsDay = d.getDay(); // 0~6
  const weekday = jsDay === 0 ? 7 : jsDay; // 1=월 ... 7=일

  return weeklyLessons.filter((l) => l.weekday === weekday);
}

// ------------------------------
//  DB 초기화 (테이블/컬럼 준비)
// ------------------------------
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reservations (
      id SERIAL PRIMARY KEY,
      room TEXT NOT NULL,
      date TEXT NOT NULL,   -- 'YYYY-MM-DD'
      start TEXT NOT NULL,  -- 'HH:MM'
      "end" TEXT NOT NULL,  -- 'HH:MM'
      student TEXT NOT NULL
    );
  `);

  await pool.query(`
    ALTER TABLE reservations
    ADD COLUMN IF NOT EXISTS manage_code TEXT;
  `);

  console.log('DB 초기화 완료 (reservations 테이블 + manage_code 컬럼)');
}

// ------------------------------
//  미들웨어 / 정적 파일
// ------------------------------
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 관리자 페이지 HTML
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ------------------------------
//  관리자 API
// ------------------------------

// 날짜별 예약 조회 (관리자용)
app.get('/api/admin/reservations', async (req, res) => {
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ error: 'date 파라미터가 필요합니다.' });
  }

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM reservations
      WHERE date = $1
      ORDER BY room, start
      `,
      [date]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('관리자 예약 조회 오류:', err);
    res.status(500).json({ error: '예약 조회 중 오류가 발생했습니다.' });
  }
});

// 관리자: 관리코드로 전체 취소 (페이지 입장 시 한 번만 입력받는다고 가정)
app.delete('/api/admin/reservations/:id', async (req, res) => {
  const { adminCode } = req.body;
  const { id } = req.params;

  if (!adminCode) {
    return res.status(400).json({ error: '관리자 코드를 입력해 주세요.' });
  }

  if (adminCode !== ADMIN_CODE) {
    return res.status(403).json({ error: '관리자 코드가 올바르지 않습니다.' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM reservations WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: '해당 예약을 찾을 수 없습니다.' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('관리자 강제 취소 오류:', err);
    res.status(500).json({ error: '예약 취소 중 오류가 발생했습니다.' });
  }
});

// ------------------------------
//  학생/일반용 API
// ------------------------------

// 날짜별 예약 조회
app.get('/api/reservations', async (req, res) => {
  const date = req.query.date;
  if (!date) {
    return res
      .status(400)
      .json({ error: 'date 파라미터가 필요합니다. (예: ?date=2025-12-05)' });
  }

  try {
    const result = await pool.query(
      `SELECT id, room, date, start, "end", student
       FROM reservations
       WHERE date = $1
       ORDER BY room, start`,
      [date]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('예약 목록 조회 중 오류:', err);
    res.status(500).json({ error: '예약 목록을 불러오는 중 오류가 발생했습니다.' });
  }
});

// 날짜별 수업 블록(검은 칸) 조회
app.get('/api/blocks', (req, res) => {
  const date = req.query.date;
  if (!date) {
    return res
      .status(400)
      .json({ error: 'date 파라미터가 필요합니다. (예: ?date=2025-12-05)' });
  }

  const blocks = getLessonsForDate(date).map((b) => ({
    room: String(b.room),
    date,
    start: b.start,
    end: b.end,
  }));

  res.json(blocks);
});

// 새 예약 추가
// body: { room, date, start, end, student }
app.post('/api/reservations', async (req, res) => {
  const { room, date, start, end, student } = req.body;

  if (!room || !date || !start || !end || !student) {
    return res.status(400).json({
      error:
        '모든 항목(연습실, 날짜, 시작시간, 끝시간, 학생이름)을 입력해주세요.',
    });
  }

  try {
    // 1) 수업 블록과 겹치는지 체크
    const lessonBlocks = getLessonsForDate(date);
    const lessonConflict = lessonBlocks.find(
      (b) =>
        String(b.room) === String(room) &&
        !(end <= b.start || start >= b.end)
    );

    if (lessonConflict) {
      return res.status(400).json({
        error: '이 시간은 수업이 있어서 연습실을 예약할 수 없습니다.',
      });
    }

    // 2) 기존 예약과 겹치는지 체크
    const conflictResult = await pool.query(
      `
      SELECT 1
      FROM reservations
      WHERE room = $1
        AND date = $2
        AND NOT ("end" <= $3 OR start >= $4)
      LIMIT 1
      `,
      [room, date, start, end]
    );

    if (conflictResult.rowCount > 0) {
      return res.status(400).json({ error: '이미 예약이 있는 시간입니다.' });
    }

    // 4자리 관리코드 생성
    const manageCode = Math.floor(1000 + Math.random() * 9000).toString();

    // 예약 저장
    const insertResult = await pool.query(
      `
      INSERT INTO reservations (room, date, start, "end", student, manage_code)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, room, date, start, "end", student, manage_code
      `,
      [room, date, start, end, student, manageCode]
    );

    const newRes = insertResult.rows[0];
    res.json(newRes);
  } catch (err) {
    console.error('예약 저장 중 오류:', err);
    res
      .status(500)
      .json({ error: '예약을 저장하는 중 오류가 발생했습니다.' });
  }
});

// 예약 취소 (학생 측: 관리코드 필요)
app.delete('/api/reservations/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { manageCode } = req.body || {};

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: '잘못된 예약 ID입니다.' });
  }
  if (!manageCode) {
    return res.status(400).json({ error: '관리코드를 입력해주세요.' });
  }

  try {
    const result = await pool.query(
      `SELECT manage_code FROM reservations WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
    }

    const row = result.rows[0];

    if (!row.manage_code || row.manage_code !== manageCode) {
      return res
        .status(403)
        .json({ error: '관리코드가 일치하지 않습니다.' });
    }

    await pool.query(`DELETE FROM reservations WHERE id = $1`, [id]);

    res.json({ success: true });
  } catch (err) {
    console.error('예약 삭제 중 오류:', err);
    res
      .status(500)
      .json({ error: '예약을 삭제하는 중 오류가 발생했습니다.' });
  }
});

// ------------------------------
// 서버 실행
// ------------------------------
const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    loadWeeklyLessons();
    app.listen(PORT, () => {
      console.log(`서버 실행 중: 포트 ${PORT}에서 서버 실행 중`);
    });
  })
  .catch((err) => {
    console.error('초기화 중 치명적 오류:', err);
    process.exit(1);
  });
