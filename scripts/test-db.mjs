// Runs each supabase/tests/*.sql file against the linked Supabase project
// (via `supabase db query --linked`) and fails if any check returns ok = false.
// Every test file wraps its work in a transaction that is rolled back.
//
// Usage: npm run test:db             (all files)
//        npm run test:db -- 02_rls   (files whose name contains "02_rls")

import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const dir = "supabase/tests";
const filter = process.argv[2] ?? "";
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql") && f.includes(filter))
  .sort();

let failures = 0;

for (const file of files) {
  let out;
  try {
    out = execFileSync(
      "npx",
      ["supabase", "db", "query", "--linked", "--output-format", "json", "-f", join(dir, file)],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" },
    );
  } catch (err) {
    console.error(`\n✗ ${file}: query failed\n${err.stdout ?? ""}${err.stderr ?? ""}`);
    failures++;
    continue;
  }

  const json = JSON.parse(out.slice(out.indexOf("{")));
  const rows = json.rows ?? [];
  const failed = rows.filter((r) => r.ok !== true);
  failures += failed.length;

  console.log(`\n${failed.length ? "✗" : "✓"} ${file}: ${rows.length - failed.length}/${rows.length} passed`);
  for (const r of failed) console.log(`   FAIL  ${r.test}${r.detail ? ` (${r.detail})` : ""}`);
  if (rows.length === 0) {
    console.log("   FAIL  no results returned");
    failures++;
  }
}

process.exit(failures ? 1 : 0);
