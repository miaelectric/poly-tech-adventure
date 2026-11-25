// 사용법: npm run db:migrate  (수동)
//        node scripts/migrate.mjs --if-db  (빌드 시 자동: DB가 없으면 건너뜀)
// DATABASE_URL은 환경변수 또는 .env.local에서 읽는다. 여러 번 실행해도 안전하다.
// 기존 게임 테이블(game_scores)은 건드리지 않고, 신규 테이블 poly_tech_scores를 사용한다 (docs/TRD.md §2).
import { neon } from "@neondatabase/serverless";

try { process.loadEnvFile(".env.local"); } catch { /* 파일이 없으면 환경변수만 사용 */ }

const url = process.env.DATABASE_URL ?? "";
if (!/^postgres(ql)?:\/\//.test(url)) {
  if (process.argv.includes("--if-db")) {
    console.log("migrate: DATABASE_URL이 없어 건너뜀");
    process.exit(0);
  }
  console.error("DATABASE_URL이 없거나 Postgres 연결 문자열이 아닙니다.");
  process.exit(1);
}

const sql = neon(url);

await sql`
  CREATE TABLE IF NOT EXISTS poly_tech_scores (
    id SERIAL PRIMARY KEY,
    player_name VARCHAR(50) NOT NULL,
    score INTEGER NOT NULL CHECK (score > 0),
    character_id VARCHAR(30) NOT NULL DEFAULT 'e_human',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )
`;
// 랭킹 정렬(점수 내림차순, 동점이면 먼저 달성한 순)과 같은 순서의 인덱스
await sql`
  CREATE INDEX IF NOT EXISTS idx_poly_tech_scores_score ON poly_tech_scores (score DESC, created_at ASC, id ASC)
`;

console.log("migrate: poly_tech_scores 테이블과 idx_poly_tech_scores_score 인덱스 준비 완료");
