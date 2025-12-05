// server.js

const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();

// ------------------------------
//  PostgreSQL 연결 설정
// ------------------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false } // Render 같은 클라우드 환경용
    : false, // 로컬(내 컴퓨터)에서 테스트할 땐 ssl 안 써도 됨
});

// 서버 시작 시 테이블이 없으면 만드는 함수
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reservations (
      id SERIAL PRIMARY KEY,
      room TEXT NOT NULL,
      date TEXT NOT NULL,   -- 'YYYY-MM-DD'
      start TEXT NOT NULL,  -- 'HH:MM'
      "end" TEXT NOT NULL,  -- 'HH:MM' (end는 예약어라서 쌍따옴표)
      student TEXT NOT NULL
    );
  `);
  console.log('DB 초기화 완료 (reservations 테이블 준비됨)');
}

// JSON 형식(body) 읽기
app.use(express.json());

// public 폴더 정적 파일 서비스
app.use(express.static(path.join(__dirname, 'public')));

// ------------------------------
//  API 라우트 (DB 사용)
// ------------------------------

// 날짜별 예약 목록 가져오기
// 예: GET /api/reservations?date=2025-12-05
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
    // 같은 연습실, 같은 날짜에서 시간 겹치는지 체크
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

    // 예약 저장
    const insertResult = await pool.query(
      `
      INSERT INTO reservations (room, date, start, "end", student)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, room, date, start, "end", student
      `,
      [room, date, start, end, student]
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

// ------------------------------
// 서버 실행
// ------------------------------
const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`서버 실행 중: 포트 ${PORT}에서 서버 실행 중`);
    });
  })
  .catch((err) => {
    console.error('DB 초기화 중 치명적 오류:', err);
    process.exit(1);
  });
