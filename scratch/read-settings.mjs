import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Manually parse .env.local
const envPath = path.resolve(".env.local");
let supabaseUrl = "";
let supabaseKey = "";

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach(line => {
    const parts = line.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim();
      if (key === "NEXT_PUBLIC_SUPABASE_URL") {
        supabaseUrl = val;
      } else if (key === "SUPABASE_SERVICE_ROLE_KEY") {
        supabaseKey = val;
      }
    }
  });
}

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Environment variables NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are missing from .env.local!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching settings from DB...");
  const { data, error } = await supabase.from("settings").select("*");
  if (error) {
    console.error("❌ Error fetching settings:", error);
    return;
  }

  console.log("\n--- Settings Rows ---");
  data.forEach(row => {
    console.log(`Key: "${row.key}"`);
    console.log("Value:", JSON.stringify(row.value, null, 2));
    console.log("------------------------");
  });
}

run().catch(console.error);
