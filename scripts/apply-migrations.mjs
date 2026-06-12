import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = "https://oihiryfvnsxdchwymbge.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9paGlyeWZ2bnN4ZGNod3ltYmdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDg1MzE0OSwiZXhwIjoyMDk2NDI5MTQ5fQ.5oaDlsN_w3ewRavntgD6JZuXeCToilObb5WqqL6JdgE";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
  const sql = readFileSync(resolve(__dirname, "../supabase/migrations/20260608190000_vv_crm_expansions.sql"), "utf8");
  
  console.log("Running migration SQL...");
  
  const { error } = await supabase.rpc("exec_sql", { sql });
  
  if (error) {
    console.log("RPC method not available, trying direct SQL via fetch...");
    
    // Fallback: use pg-sql endpoint
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
      console.error("Error:", response.status, text);
    } else {
      console.log("Migration applied successfully!");
    }
  } else {
    console.log("Migration applied successfully!");
  }
}

run().catch(console.error);
