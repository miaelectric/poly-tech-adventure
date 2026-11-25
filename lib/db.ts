import { neon } from "@neondatabase/serverless";

/** DATABASE_URL이 Postgres 연결 문자열인지 */
export function hasDatabase(): boolean {
  return /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "");
}

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

// 테이블 생성은 요청마다 하지 않고 배포 시 1회: `npm run db:migrate` (scripts/migrate.mjs)
