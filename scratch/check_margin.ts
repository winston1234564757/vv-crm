import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Manually parse .env.local to avoid using external dotenv package
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (!fs.existsSync(envPath)) return;
    
    const content = fs.readFileSync(envPath, "utf-8");
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      
      const parts = trimmed.split("=");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        let value = parts.slice(1).join("=").trim();
        
        // Remove surrounding quotes if they exist
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    });
  } catch (err) {
    console.error("Error reading env file:", err);
  }
}

async function main() {
  loadEnv();
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseKey) {
    console.error("Error: Supabase credentials not found in environment.");
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from("devices")
    .select("brand, model, imei, status, repair_cost, updated_at")
    .in("status", ["in_stock", "sold"])
    .gt("repair_cost", 0)
    .gte("updated_at", thirtyDaysAgo.toISOString());

  if (error) {
    console.error("DB Error:", error);
    return;
  }

  console.log("\n=== DEVICES CONTRIBUTING TO ADDED VALUE ===");
  let total = 0;
  data?.forEach((d) => {
    console.log(`- ${d.brand} ${d.model} (IMEI: ${d.imei || "N/A"}) | Status: ${d.status} | Repair Cost: ${d.repair_cost} ₴ | Updated: ${d.updated_at}`);
    total += d.repair_cost;
  });
  console.log(`\nTOTAL SUM OF REPAIR COSTS: ${total} ₴\n`);
}

main();
