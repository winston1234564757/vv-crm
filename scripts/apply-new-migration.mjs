import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = "https://oihiryfvnsxdchwymbge.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9paGlyeWZ2bnN4ZGNod3ltYmdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDg1MzE0OSwiZXhwIjoyMDk2NDI5MTQ5fQ.5oaDlsN_w3ewRavntgD6JZuXeCToilObb5WqqL6JdgE";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const migrations = [
  "20260614030000_atomic_stock_functions.sql"
];

async function runMigration(fileName) {
  const sqlPath = resolve(__dirname, "../supabase/migrations", fileName);
  console.log(`\nReading SQL from: ${sqlPath}`);
  const sql = readFileSync(sqlPath, "utf8");
  
  console.log(`Applying migration: ${fileName}...`);
  
  // Try calling exec_sql first
  const { error } = await supabase.rpc("exec_sql", { sql });
  
  if (error) {
    console.log("RPC exec_sql returned error:", error);
    console.log("trying pg_exec_sql...");
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pg_exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ query_text: sql }),
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ Error applying migration ${fileName}:`, response.status, text);
      throw new Error(`Migration ${fileName} failed`);
    } else {
      console.log(`✅ Migration ${fileName} applied successfully via pg_exec_sql!`);
    }
  } else {
    console.log(`✅ Migration ${fileName} applied successfully via exec_sql!`);
  }
}

async function main() {
  for (const migration of migrations) {
    await runMigration(migration);
  }
  console.log("\n=== ALL MIGRATIONS COMPLETED SUCCESSFULLY ===");
}

main().catch((err) => {
  console.error("Uncaught error during migration process:", err);
  process.exit(1);
});
