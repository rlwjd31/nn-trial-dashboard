// 계약 검증 러너 — 응답 JSON 을 docs/contract/openapi.yaml 과 대조한다.
//
//   pnpm test:contract                 # mock 응답을 스펙과 대조 (기본, 서버 불필요)
//   pnpm test:contract -- --base http://localhost:3000/api
//                                      # 실행 중인 Next Route Handler 를 대조
//   pnpm test:contract -- --base https://<host>/webhook --n8n
//                                      # n8n 웹훅을 직접 대조. 목록은 /trials 지만
//                                      # 나머지는 /<webhookId>/trials/<trial_id>/... 이므로
//                                      # N8N_WEBHOOK_ID_* env 3개가 필요하다.
//
// 의존성 0개. Node 22+ 의 TypeScript strip 실행을 쓴다 (`node test/contract-check.ts`).
// openapi.yaml 은 아래 minimal YAML 파서로 읽는다 — 스펙을 사본으로 복제하지 않기 위함이다.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = join(HERE, "..", "docs", "contract", "openapi.yaml");

// ── 1. YAML (openapi.yaml 이 쓰는 부분집합) ────────────────────────────────
// 지원: 블록 매핑/시퀀스, 플로우 매핑 {a: b}, 플로우 시퀀스 [a, b], 접힌 스칼라 > / |,
// 따옴표 문자열, 숫자/불리언/null. 주석(#)은 따옴표 밖에서만 제거.
type Yaml = string | number | boolean | null | Yaml[] | { [k: string]: Yaml };

function stripComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === "#" && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function parseScalar(raw: string): Yaml {
  const s = raw.trim();
  if (s === "" || s === "~" || s === "null") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, "\n");
  }
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  if (s.startsWith("[") || s.startsWith("{")) return parseFlow(s);
  return s;
}

/** 플로우 스타일 `[a, b]` / `{a: b, c: d}` — 중첩·따옴표 고려해 최상위 콤마로만 자른다. */
function parseFlow(src: string): Yaml {
  const body = src.slice(1, -1);
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let cur = "";
  for (const c of body) {
    if (quote) {
      cur += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      cur += c;
      continue;
    }
    if (c === "[" || c === "{") depth++;
    if (c === "]" || c === "}") depth--;
    if (c === "," && depth === 0) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim() !== "") parts.push(cur);

  if (src.startsWith("[")) return parts.map((p) => parseScalar(p));

  const obj: { [k: string]: Yaml } = {};
  for (const p of parts) {
    const idx = splitKey(p);
    if (idx < 0) continue;
    obj[unquoteKey(p.slice(0, idx))] = parseScalar(p.slice(idx + 1));
  }
  return obj;
}

/** 따옴표 밖의 첫 ": " (또는 줄 끝 ":") 위치 */
function splitKey(line: string): number {
  let quote: string | null = null;
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === "[" || c === "{") depth++;
    if (c === "]" || c === "}") depth--;
    if (c === ":" && depth === 0) {
      const next = line[i + 1];
      if (next === undefined || next === " ") return i;
    }
  }
  return -1;
}

function unquoteKey(k: string): string {
  const s = k.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

interface Line {
  indent: number;
  text: string;
}

function parseYaml(src: string): Yaml {
  const lines: Line[] = [];
  const rawLines = src.split("\n");
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    const stripped = stripComment(raw);
    if (stripped.trim() === "") continue;
    lines.push({ indent: raw.length - raw.trimStart().length, text: stripped.trimEnd() });
  }
  const [value] = parseBlock(lines, 0, lines[0]?.indent ?? 0);
  return value;
}

/** lines[i..] 중 indent 이상인 블록을 파싱. [값, 다음 인덱스] 반환. */
function parseBlock(lines: Line[], i: number, indent: number): [Yaml, number] {
  if (i >= lines.length) return [null, i];

  if (lines[i].text.trimStart().startsWith("- ") || lines[i].text.trim() === "-") {
    const arr: Yaml[] = [];
    while (i < lines.length && lines[i].indent === indent) {
      const t = lines[i].text.trim();
      if (!t.startsWith("-")) break;
      const rest = t.slice(1).trim();
      if (rest === "") {
        const [v, next] = parseBlock(lines, i + 1, lines[i + 1]?.indent ?? indent + 2);
        arr.push(v);
        i = next;
        continue;
      }
      // "- key: value" → 항목 자체가 매핑. 가상 들여쓰기로 재파싱.
      if (splitKey(rest) >= 0) {
        const itemIndent = lines[i].indent + 2;
        const synthetic: Line[] = [{ indent: itemIndent, text: " ".repeat(itemIndent) + rest }];
        let j = i + 1;
        while (j < lines.length && lines[j].indent >= itemIndent) {
          synthetic.push(lines[j]);
          j++;
        }
        const [v] = parseBlock(synthetic, 0, itemIndent);
        arr.push(v);
        i = j;
        continue;
      }
      arr.push(parseScalar(rest));
      i++;
    }
    return [arr, i];
  }

  const obj: { [k: string]: Yaml } = {};
  while (i < lines.length && lines[i].indent === indent) {
    const t = lines[i].text.trim();
    if (t.startsWith("- ")) break;
    const idx = splitKey(t);
    if (idx < 0) {
      i++;
      continue;
    }
    const key = unquoteKey(t.slice(0, idx));
    const inline = t.slice(idx + 1).trim();

    if (inline === ">" || inline === "|" || inline === ">-" || inline === "|-") {
      // 접힌/리터럴 블록 스칼라: 더 깊은 들여쓰기 줄을 모두 흡수 (내용은 검증에 쓰지 않음)
      const parts: string[] = [];
      let j = i + 1;
      while (j < lines.length && lines[j].indent > indent) {
        parts.push(lines[j].text.trim());
        j++;
      }
      obj[key] = parts.join(inline.startsWith(">") ? " " : "\n");
      i = j;
      continue;
    }

    if (inline === "") {
      const childIndent = lines[i + 1]?.indent ?? -1;
      if (childIndent > indent) {
        const [v, next] = parseBlock(lines, i + 1, childIndent);
        obj[key] = v;
        i = next;
      } else {
        obj[key] = null;
        i++;
      }
      continue;
    }

    obj[key] = parseScalar(inline);
    i++;
  }
  return [obj, i];
}

// ── 2. 스펙 로딩 & $ref 해석 ───────────────────────────────────────────────
/** 검증에 실제로 쓰는 JSON Schema 키워드만 명시. 나머지(description 등)는 index signature. */
interface Schema {
  $ref?: string;
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
  minItems?: number;
  maxItems?: number;
  [k: string]: unknown;
}

const spec = parseYaml(readFileSync(SPEC_PATH, "utf8")) as Record<string, unknown>;

/** 점(.) 대신 경로 배열로 중첩 객체를 따라간다 */
function dig(root: unknown, path: string[]): unknown {
  let cur: unknown = root;
  for (const p of path) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function resolve(schema: Schema): Schema {
  if (schema && typeof schema === "object" && typeof schema.$ref === "string") {
    const target = dig(spec, schema.$ref.replace(/^#\//, "").split("/"));
    if (!target) throw new Error(`$ref 해석 실패: ${schema.$ref}`);
    return resolve(target as Schema);
  }
  return schema;
}

function schemaFor(path: string, method: string, status: string): Schema {
  const op = dig(spec, ["paths", path, method]);
  if (!op) throw new Error(`스펙에 ${method.toUpperCase()} ${path} 없음`);
  const s = dig(op, ["responses", status, "content", "application/json", "schema"]);
  if (!s) throw new Error(`스펙에 ${method.toUpperCase()} ${path} ${status} 응답 스키마 없음`);
  return resolve(s as Schema);
}

// ── 3. 검증기 ──────────────────────────────────────────────────────────────
const problems: string[] = [];
let checks = 0;

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}

function validate(value: unknown, schemaIn: Schema, where: string): void {
  const schema = resolve(schemaIn);
  checks++;

  const expected: string[] = Array.isArray(schema.type)
    ? schema.type.map(String)
    : schema.type
      ? [String(schema.type)]
      : [];

  if (expected.length) {
    const actual = typeOf(value);
    const ok =
      expected.includes(actual) ||
      (actual === "integer" && expected.includes("number"));
    if (!ok) {
      problems.push(`${where}: type 불일치 — 스펙 ${expected.join("|")}, 실제 ${actual} (${JSON.stringify(value)})`);
      return;
    }
  }

  if (schema.const !== undefined && value !== schema.const) {
    problems.push(`${where}: const 불일치 — 스펙 ${JSON.stringify(schema.const)}, 실제 ${JSON.stringify(value)}`);
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value as never)) {
    problems.push(`${where}: enum 밖의 값 — 스펙 [${schema.enum.join(", ")}], 실제 ${JSON.stringify(value)}`);
  }

  if (expected.includes("array") && Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      problems.push(`${where}: 길이 ${value.length} < minItems ${schema.minItems}`);
    }
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      problems.push(`${where}: 길이 ${value.length} > maxItems ${schema.maxItems}`);
    }
    const items = schema.items;
    if (items) {
      value.forEach((item, i) => validate(item, items, `${where}[${i}]`));
    }
  }

  if (expected.includes("object") && value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    for (const key of (schema.required ?? []) as string[]) {
      if (!(key in obj)) problems.push(`${where}: 필수 필드 누락 — ${key}`);
    }
    const props = (schema.properties ?? {}) as Record<string, Schema>;
    for (const [key, sub] of Object.entries(props)) {
      if (key in obj) validate(obj[key], sub, `${where}.${key}`);
    }
    for (const key of Object.keys(obj)) {
      if (!(key in props)) {
        problems.push(`${where}: 스펙에 없는 필드 — ${key} (${JSON.stringify(obj[key])})`);
      }
    }
  }
}

// ── 4. 대상 응답 수집 ──────────────────────────────────────────────────────
interface Args {
  base: string | null;
  n8n: boolean;
  selftest: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let base: string | null = null;
  let n8n = false;
  let selftest = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--base") base = argv[++i] ?? null;
    else if (argv[i] === "--n8n") n8n = true;
    else if (argv[i] === "--selftest") selftest = true;
  }
  return { base, n8n, selftest };
}

/**
 * 검증기가 비어 있지 않음을 증명한다 — 일부러 망가뜨린 응답을 넣어
 * 기대한 위반이 전부 잡히는지 확인. "위반 0건"이 무의미한 통과가 아님을 보장.
 */
function selfTest(): number {
  const broken = {
    trials: [
      {
        trial_id: 48213, // string 이어야 함
        trial_time: "2026-07-25T18:00:00+09:00",
        student_id: "10432",
        // student_name 누락
        student_email: "a@b.com",
        student_phone_number: "+82 10-0000-0000",
        mentor_name: "Emma Wilson",
        mentor_tier: "basic", // enum 밖 (elite|normal)
        sales_rep_name: "Andrew",
        status: "scheduled", // enum 밖 (approved|canceled|completed|paid)
        pre_trial_call_checks: [true, false], // minItems 3 위반
        converted: false,
        legacy_field: 1, // 스펙에 없는 필드
      },
    ],
  };

  const expected = [
    "필수 필드 누락 — student_name",
    "type 불일치",
    "enum 밖의 값",
    "minItems",
    "스펙에 없는 필드 — legacy_field",
  ];

  const saved = problems.length;
  validate(broken, schemaFor("/trials", "get", "200"), "selftest");
  const found = problems.splice(saved);

  const missed = expected.filter((e) => !found.some((f) => f.includes(e)));
  console.log(`selftest — 일부러 망가뜨린 응답에서 위반 ${found.length}건 검출:`);
  for (const f of found) console.log(`  · ${f}`);
  if (missed.length) {
    console.log(`\n✗ selftest 실패 — 검출하지 못한 항목: ${missed.join(" / ")}`);
    return 1;
  }
  console.log(`\n✓ selftest 통과 — 기대한 위반 유형 ${expected.length}종 모두 검출`);
  return 0;
}

const args = parseArgs();

async function fromMock() {
  const mock = await import("../src/features/trials/mock/trials.mock.ts");
  const today = mock.getMockTrialsToday();
  const firstId = today.trials[0]?.trial_id;
  if (!firstId) throw new Error("mock 목록이 비어 있음");

  const detail = mock.getMockTrialDetail(firstId);
  mock.setMockPreTrialCallCheck(firstId, 2, true);
  mock.setMockNote(firstId, "contract-check 테스트 메모");

  return [
    { label: "GET /trials (mock)", spec: schemaFor("/trials", "get", "200"), body: today },
    { label: "GET /trials/{id} (mock)", spec: schemaFor("/trials/{id}", "get", "200"), body: detail },
    {
      label: "PATCH /trials/{id}/pre-trial-call-check (mock)",
      spec: schemaFor("/trials/{id}/pre-trial-call-check", "patch", "200"),
      body: { ok: true, trial_id: firstId, stage: 2, checked: true },
    },
    {
      label: "PATCH /trials/{id}/note (mock)",
      spec: schemaFor("/trials/{id}/note", "patch", "200"),
      body: { ok: true, trial_id: firstId, note: "contract-check 테스트 메모" },
    },
  ];
}

/**
 * 라이브 대조. 엔드포인트 하나가 실패해도 중단하지 않고 위반으로 기록한 뒤 계속한다
 * (n8n 미발행/테이블 부재처럼 일부만 깨진 상태를 전부 보고하기 위함).
 */
async function fromLive(base: string, viaN8n: boolean) {
  const root = base.replace(/\/+$/, "");
  const cases: { label: string; spec: Schema; body: unknown }[] = [];

  // n8n 직접 대조 모드에서는 엔드포인트마다 webhookId(UUID) 가 다르다.
  // 경로에 동적 값(:trial_id)이 있으면 n8n 이 webhookId 를 경로 앞에 강제로 붙이기 때문이다.
  function hookId(name: string): string {
    const v = process.env[name];
    if (!v) {
      throw new Error(
        `--n8n 모드는 env ${name} 가 필요하다 (n8n Webhook 노드의 Production URL 에서 UUID 를 읽어 .env.local 에 넣을 것)`,
      );
    }
    return v;
  }

  // 목록은 n8n 쪽에도 동적 값이 없어 webhookId 가 붙지 않는다 → 양쪽 모두 "/trials".
  const listPath = "/trials";

  async function json(path: string, init?: RequestInit) {
    const res = await fetch(`${root}${path}`, { ...init, cache: "no-store" });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} — ${JSON.stringify(body)?.slice(0, 300)}`);
    }
    return body;
  }

  /** 요청을 시도하고, 실패하면 위반으로 남기고 null 반환 */
  async function attempt<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (err) {
      problems.push(`${label}: 요청 실패 — ${err instanceof Error ? err.message : String(err)}`);
      console.log(`✗ ${label} — 요청 실패`);
      return null;
    }
  }

  const today = await attempt(`GET ${listPath}`, () => json(listPath));
  if (today) {
    cases.push({ label: `GET ${listPath}`, spec: schemaFor("/trials", "get", "200"), body: today });
  }

  const firstId = (today as { trials?: { trial_id?: string }[] } | null)?.trials?.[0]
    ?.trial_id;
  if (today && !firstId) {
    problems.push(`GET ${listPath}: trials[0] 없음 — 상세/쓰기 검증을 건너뜀`);
  }

  if (firstId) {
    const encId = encodeURIComponent(firstId);
    const detailPath = viaN8n
      ? `/${hookId("N8N_WEBHOOK_ID_TRIAL_DETAIL")}/trials/${encId}`
      : `/trials/${encId}`;
    const detail = await attempt(`GET ${detailPath}`, () => json(detailPath));
    if (detail) {
      cases.push({
        label: `GET ${detailPath}`,
        spec: schemaFor("/trials/{id}", "get", "200"),
        body: detail,
      });
    }

    const patch = (path: string, payload: unknown) =>
      json(path, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

    // ⚠ 라이브 모드의 쓰기 검증은 실제 저장소(mock 메모리 또는 DB)를 건드린다.
    // n8n 직접 모드는 trial_id 가 경로 파라미터라 body 에서 빠진다.
    // 프론트 프록시와 n8n 이 같은 REST 모양이다 — 경로에 trial_id, body 는 값만.
    const checkPath = viaN8n
      ? `/${hookId("N8N_WEBHOOK_ID_PRE_TRIAL_CALL_CHECK")}/trials/${encId}/pre-trial-call-check`
      : `/trials/${encId}/pre-trial-call-check`;
    const check = await attempt(`PATCH ${checkPath}`, () =>
      patch(checkPath, { stage: 2, checked: true }),
    );
    if (check) {
      cases.push({
        label: `PATCH ${checkPath}`,
        spec: schemaFor("/trials/{id}/pre-trial-call-check", "patch", "200"),
        body: check,
      });
    }

    const notePath = viaN8n
      ? `/${hookId("N8N_WEBHOOK_ID_NOTE")}/trials/${encId}/note`
      : `/trials/${encId}/note`;
    const note = await attempt(`PATCH ${notePath}`, () =>
      patch(notePath, { note: "contract-check" }),
    );
    if (note) {
      cases.push({
        label: `PATCH ${notePath}`,
        spec: schemaFor("/trials/{id}/note", "patch", "200"),
        body: note,
      });
    }
  }

  return cases;
}

// ── 5. 실행 ────────────────────────────────────────────────────────────────
if (args.selftest) process.exit(selfTest());

const source = args.base ? `live ${args.base}${args.n8n ? " (n8n 직접)" : ""}` : "mock";
console.log(`계약 검증 — 스펙: docs/contract/openapi.yaml · 대상: ${source}\n`);

const cases = args.base ? await fromLive(args.base, args.n8n) : await fromMock();

for (const c of cases) {
  const before = problems.length;
  validate(c.body, c.spec, c.label.split(" ").slice(0, 2).join(" "));
  const failed = problems.length - before;
  console.log(`${failed === 0 ? "✓" : "✗"} ${c.label}${failed ? ` — 위반 ${failed}건` : ""}`);
}

console.log();
if (problems.length === 0) {
  console.log(`통과 — ${checks}개 노드 검사, 위반 0건`);
  process.exit(0);
}
console.log(`실패 — ${checks}개 노드 검사, 위반 ${problems.length}건:`);
for (const p of problems) console.log(`  · ${p}`);
process.exit(1);
