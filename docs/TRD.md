# TRD: 폴리의 테크 모험 (Poly's Tech Adventure)

## 1. 시스템 아키텍처 및 기술 스택
기존 검증된 풀스택 웹 게임 아키텍처를 그대로 승계하여 개발 속도와 안정성을 극대화합니다.
- **Frontend:** Next.js 14+ (App Router), React, TypeScript, Tailwind CSS
- **Rendering:** HTML5 Canvas API 또는 DOM 기반 고프레임 애니메이션 (60fps 유지)
- **Backend:** Next.js Route Handlers (`app/api/scores/route.ts`)
- **Database:** Neon Serverless Postgres (`@neondatabase/serverless`)
- **Deployment:** Vercel

## 2. 데이터베이스 설계 (Neon Postgres)
기존 게임 데이터와 분리하기 위해 신규 테이블 `poly_tech_scores`를 생성하여 사용합니다.

### Table: `poly_tech_scores`
```sql
CREATE TABLE IF NOT EXISTS poly_tech_scores (
  id SERIAL PRIMARY KEY,
  player_name VARCHAR(50) NOT NULL,
  score INTEGER NOT NULL,
  character_id VARCHAR(30) NOT NULL DEFAULT 'e_human',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_poly_tech_scores_score ON poly_tech_scores(score DESC);

export type CharacterId =
  | 'e_human'     // E조인간 (기본)
  | 'lim_junga'   // 임정아 (20)
  | 'park_jy'     // 박정용 (40)
  | 'gil_wj'      // 길완제 (60)
  | 'ahn_yh'      // 안영휘 (80)
  | 'koo_bm';     // 구병모 (100)

export interface CharacterSpec {
  id: CharacterId;
  name: string;
  role: 'robot' | 'female_prof' | 'male_prof';
  unlockScore: number;
  skillName: string;
  skillDescription: string;
  themeColor: string;
}

3.2 해금 상태 저장 (Client Storage)
브라우저 localStorage 키 poly_tech_best_score에 사용자의 최고 도달 섹터를 저장.

bestScore >= character.unlockScore 조건 충족 시 캐릭터 선택 UI에서 잠금 해제(Unlock) 처리. (테스트 편의를 위해 개발 모드에서는 전체 해금 토글 지원 권장)

3.3 스킬 엔진 로직 구현 명세 (hooks/useGameEngine.ts)
E조인간 (e_human) - 프로토콜 안정화:

기본 프레임당 에너지 감소량 decayRate에 0.9 가중치 적용 (decayRate * 0.9).

임정아 (lim_junga) - 데이터 최적화:

발판 생성 시 15% 확률로 hasDataChip: true 속성 부여. 해당 발판 도달 시 score += 2 보너스 가산.

박정용 (park_jy) - 경로 예측 알고리즘:

렌더링 레이어에서 현재 위치 기준 index + 1 ~ index + 5 발판 사이에 발광하는 점선(SVG/Canvas Line)으로 이동 경로 가이드 렌더링.

길완제 (gil_wj) - 긴급 백업 시스템:

게임 시작 시 hasShield = true 초기화.

사용자의 입력 방향(TURN vs CLIMB)이 다음 발판 방향과 불일치할 때, hasShield === true이면 게임 오버를 취소하고 자동으로 올바른 방향으로 보정 이동한 뒤 hasShield = false로 전환 (실드 파괴 이펙트 출력).

안영휘 (ahn_yh) - 하이퍼 부스트:

연속 입력 카운터 combo 추적 (입력 간격 0.4초 이내 유지 시 증가).

combo >= 15 도달 시 isFeverMode = true (3초간 유지). 피버 모드 중에는 어떤 버튼(좌/우)을 눌러도 자동으로 정답 방향으로 초고속 전진하며 에너지 감소 중지.

구병모 (koo_bm) - 마스터 오버클럭:

한 칸 이동 시 에너지 회복량 healAmount * 1.3 적용.

퀴즈 게이트에서 오답 선택 시 패널티(시간 감소 또는 정지) 스킵 후 즉시 정상 진행.

4. 스마트 물류 컨베이어 비주얼 구현 가이드
발판(Node) 디자인: 단순 계단 블록 대신, 금속 프레임 + 내부 네온 스트립 + 방향 화살표(LED)가 표시된 스마트 물류 컨베이어 패드 형태로 스타일링.

배경 레이어: 패럴랙스(Parallax) 스크롤을 적용하여 층수가 올라갈수록 1층 입출고장 → 자동화 분류 라인 → 고공 AGV 허브 → 중앙 AI 관제탑 순으로 배경 톤과 구조물이 변화하도록 구현.

캐릭터 그래픽: 초기 MVP 단계에서는 각 캐릭터의 특징(로봇 바이저, 여교수/남교수 헤어스타일·안경·정장·소품)이 뚜렷하게 구분되는 고해상도 2D SVG 또는 픽셀/벡터 스프라이트로 컴포넌트화(components/CharacterAvatar.tsx)하여 렌더링.

## 5. 랭킹 DB · API 명세

### 5-1. 테이블 (`db/schema.sql`)
다른 게임과 같은 DB를 써도 겹치지 않도록 `poly_tech_` 접두사를 사용한다. 여러 번 실행해도 안전(`IF NOT EXISTS`).

| 테이블 | 컬럼 | 비고 |
| :--- | :--- | :--- |
| `poly_tech_games` | `game_id UUID PK`, `started_at TIMESTAMPTZ`, `submitted_at TIMESTAMPTZ NULL` | 게임 시작 시 발급, 제출 시각 기록 |
| `poly_tech_scores` | `id`, `player_name`, `score`, `character_id`, `created_at`, `game_id UUID UNIQUE → poly_tech_games` | 한 게임당 기록 1개 |

인덱스: `idx_poly_tech_scores_score (score DESC, created_at ASC, id ASC)`, `uq_poly_tech_scores_game_id`, `idx_poly_tech_games_started`.

적용: `npm run db:schema`(개발, `.env.local`) / `npm run db:schema:prod`(운영, `.env.prod.local`) / Vercel 빌드 시 자동(`--if-db`).

### 5-2. `POST /api/games`
게임 시작 시 호출. 응답 `201 { "game_id": "<uuid v4>" }`. 저장소 미설정 시 503.

### 5-3. `GET /api/scores` — 명예의 전당 TOP 20 (PRD S4)
```sql
SELECT id, player_name, score, character_id, created_at
FROM poly_tech_scores
ORDER BY score DESC, created_at ASC, id ASC
LIMIT 20;
```

### 5-4. 플레이 시간 검증 (`lib/game_rules.js`)
- 경과 시간 = DB 시계 `now() - started_at`
- 최소 플레이 시간 = `max(1.5초, (score − 30) / 8 × 1초)` → 미달이면 `too_fast`
- 발급 후 1시간 초과 → `expired`

### 5-5. `POST /api/scores` 처리 순서
요청: `{ game_id, player_name, character_id, score }`

1. JSON 본문 파싱
2. 형식 검증: `game_id`(UUID v4) · 이름 · 캐릭터 · 점수(1 이상 정수) — 화면과 같은 `lib/game_rules.js`
3. 트랜잭션 시작 + `pg_advisory_xact_lock(hashtextextended('poly_tech:'||game_id, 0))`
4. `game_id` 조회 (`FOR UPDATE`)
5. 이미 제출된 게임인지 확인
6. 플레이 시간 검증 (5-4)
7. 점수 INSERT + `submitted_at` 기록
8. 순위 계산(`score >=` 개수) 후 COMMIT

| 코드 | error | 의미 |
| :--- | :--- | :--- |
| 201 | — | 등록 성공 `{ id, rank }` |
| 400 | `invalid_json` / `invalid_game_id` / `invalid_player_name` / `invalid_character` / `invalid_score` | 입력 오류 |
| 404 | `game_not_found` | 발급되지 않은 game_id |
| 409 | `already_submitted` | 이미 기록이 등록된 게임 (유니크 인덱스 위반 포함) |
| 410 | `expired` | game_id 발급 후 1시간 초과 |
| 422 | `too_fast` | 플레이 시간 부족 |
| 500 | `db_error` | DB 오류 |
| 503 | `ranking_unavailable` | 운영 환경에 DATABASE_URL 없음 |

모든 API 응답에 `Cache-Control: no-store`. DB 접근은 `lib/score_store.js` 한 곳에서만 한다(개발 모드 + DB 없음 → 메모리 저장소, 파일 저장 없음).
