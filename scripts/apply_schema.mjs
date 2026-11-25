// db/schema.sql 을 DB에 적용한다. 여러 번 실행해도 안전하다.
//
//   npm run db:schema        → .env.local      의 DATABASE_URL (개발 DB)
//   npm run db:schema:prod   → .env.prod.local 의 DATABASE_URL (운영 DB)
//   node scripts/apply_schema.mjs --if-db   → 환경변수 DATABASE_URL (Vercel 빌드 시, 없으면 건너뜀)
//
// --env-file 을 주면 그 파일의 값만 사용한다 (셸에 남아 있는 DATABASE_URL 로 엉뚱한 DB에 적용하는 것 방지).
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { Pool } from "@neondatabase/serverless";

const args = process.argv.slice(2);
const envFileArg = args.find((a) => a.startsWith("--env-file="));
const ifDb = args.includes("--if-db");

let url = "";
let source = "";
if (envFileArg) {
  const file = envFileArg.slice("--env-file=".length);
  try {
    url = parseEnv(readFileSync(file, "utf8")).DATABASE_URL ?? "";
  } catch {
    console.error(`apply_schema: ${file} 파일이 없습니다. 먼저 npm run env:pull 을 실행하세요.`);
    process.exit(1);
  }
  source = file;
} else {
  url = process.env.DATABASE_URL ?? "";
  source = "환경변수";
}

if (!/^postgres(ql)?:\/\//.test(url)) {
  if (ifDb) {
    console.log("apply_schema: DATABASE_URL이 없어 건너뜀");
    process.exit(0);
  }
  console.error(`apply_schema: ${source}에 Postgres DATABASE_URL이 없습니다.`);
  process.exit(1);
}

if (typeof WebSocket === "undefined") {
  console.error("apply_schema: Node.js 22 이상이 필요합니다 (전역 WebSocket).");
  process.exit(1);
}

const host = new URL(url.replace(/^postgres(ql)?:/, "http:")).hostname;
const schema = readFileSync(fileURLToPath(new URL("../db/schema.sql", import.meta.url)), "utf8");

const pool = new Pool({ connectionString: url });
try {
  // 파라미터 없는 단순 쿼리 → 여러 문장을 한 번에 실행 (하나라도 실패하면 이후 중단)
  await pool.query(schema);
  console.log(`apply_schema: ${host} (${source}) 에 db/schema.sql 적용 완료`);
} catch (e) {
  console.error(`apply_schema: ${host} 적용 실패 —`, e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
