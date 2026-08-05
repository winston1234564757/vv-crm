/**
 * Шукає порушення межі клієнт/сервер: серверний модуль імпортує ЗНАЧЕННЯ
 * (не тип і не компонент) з модуля, позначеного «use client».
 *
 * НАВІЩО ОКРЕМИЙ СКРИПТ. Саме ця помилка поклала /admin/finance цілком:
 *
 *   Attempted to call resolveViewMode() from the server but resolveViewMode
 *   is on the client.
 *
 * `resolveViewMode` лежав у `ViewToggle.tsx` з «use client», а кликала його
 * серверна сторінка. І `tsc`, і `next build` пройшли без єдиного зауваження —
 * помилка рантаймова, вона проявляється лише на рендері сторінки. Тобто
 * «збирається» тут не є доказом працездатності, і потрібна окрема перевірка.
 *
 * Компоненти (імена з великої літери) не рахуються порушенням: серверний код
 * їх лише рендерить, а не викликає.
 *
 * Запуск: node scripts/check-client-boundary.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

const ROOT = resolve(process.cwd(), "src");

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(p)) files.push(p);
  }
})(ROOT);

const isClient = new Map();
for (const f of files) {
  isClient.set(f, /^\s*["']use client["']/.test(readFileSync(f, "utf8")));
}

/** Розв'язує `@/…` та відносні шляхи у справжній файл. */
function resolveImport(fromFile, spec) {
  let base;
  if (spec.startsWith("@/")) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null;

  for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const cand = base + ext;
    if (isClient.has(cand)) return cand;
  }
  return isClient.has(base) ? base : null;
}

const violations = [];
for (const f of files) {
  if (isClient.get(f)) continue;

  const src = readFileSync(f, "utf8");
  const re = /import\s+(type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) {
    const [, typeOnly, names, spec] = m;
    if (typeOnly) continue;

    const target = resolveImport(f, spec);
    if (!target || !isClient.get(target)) continue;

    for (const raw of names.split(",")) {
      const n = raw.trim();
      if (!n || n.startsWith("type ")) continue;
      const local = (n.split(/\s+as\s+/)[1] ?? n).trim();
      if (/^[A-Z]/.test(local)) continue; // компонент — рендерити можна
      violations.push({ file: f.replace(ROOT, "src"), spec, name: local });
    }
  }
}

if (violations.length === 0) {
  console.log("ЧИСТО — жодного виклику клієнтської функції з сервера");
} else {
  console.log(`ПОРУШЕНЬ: ${violations.length}`);
  for (const v of violations) console.log(`  ${v.file}\n    ${v.name}  <-  ${v.spec}`);
  process.exitCode = 1;
}
