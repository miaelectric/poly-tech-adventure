-- 폴리의 테크 모험 DB 스키마 (Neon Postgres)
-- 여러 번 실행해도 안전하다 (IF NOT EXISTS). 적용: npm run db:schema / npm run db:schema:prod
-- 다른 게임과 같은 DB를 써도 겹치지 않도록 모든 테이블에 poly_tech_ 접두사를 붙인다.

-- 게임 세션: POST /api/games 가 발급한 game_id 와 시작 시각 (플레이 시간 검증용)
CREATE TABLE IF NOT EXISTS poly_tech_games (
  game_id      UUID PRIMARY KEY,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_poly_tech_games_started ON poly_tech_games (started_at);

-- 점수 기록 (docs/TRD.md §2)
CREATE TABLE IF NOT EXISTS poly_tech_scores (
  id           SERIAL PRIMARY KEY,
  player_name  VARCHAR(50) NOT NULL,
  score        INTEGER NOT NULL CHECK (score > 0),
  character_id VARCHAR(30) NOT NULL DEFAULT 'e_human',
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- game_id: 한 게임당 기록 1개 (이전 버전에서 만든 테이블에도 컬럼 추가)
ALTER TABLE poly_tech_scores ADD COLUMN IF NOT EXISTS game_id UUID REFERENCES poly_tech_games (game_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_poly_tech_scores_game_id ON poly_tech_scores (game_id);

-- 랭킹 정렬(점수 내림차순, 동점이면 먼저 달성한 순)과 같은 순서의 인덱스
CREATE INDEX IF NOT EXISTS idx_poly_tech_scores_score ON poly_tech_scores (score DESC, created_at ASC, id ASC);
