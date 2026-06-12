import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://oihiryfvnsxdchwymbge.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9paGlyeWZ2bnN4ZGNod3ltYmdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDg1MzE0OSwiZXhwIjoyMDk2NDI5MTQ5fQ.5oaDlsN_w3ewRavntgD6JZuXeCToilObb5WqqL6JdgE";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function runTests() {
  console.log("=== STARTING INTEGRATION TESTS ===");

  // 1. Test Customer vip_status Update (Verify TEXT conversion)
  console.log("\n1. Testing Customer vip_status field...");
  const { data: customers, error: fetchCustErr } = await supabase
    .from("customers")
    .select("id, name, vip_status")
    .limit(1);

  if (fetchCustErr) {
    console.error("Failed to fetch customers:", fetchCustErr.message);
  } else if (!customers || customers.length === 0) {
    console.log("No customers found in database to test status update.");
  } else {
    const customer = customers[0];
    const originalStatus = customer.vip_status;
    console.log(`Found customer: "${customer.name}" (ID: ${customer.id}) with status: "${originalStatus}"`);

    console.log("Attempting to update vip_status to 'silver'...");
    const { data: updatedCust, error: updateErr } = await supabase
      .from("customers")
      .update({ vip_status: "silver" })
      .eq("id", customer.id)
      .select();

    if (updateErr) {
      console.error("❌ Failed to update vip_status to 'silver':", JSON.stringify(updateErr, null, 2));
    } else {
      console.log("✅ Successfully updated vip_status to 'silver'!");
      
      // Revert to original
      const { error: revertErr } = await supabase
        .from("customers")
        .update({ vip_status: originalStatus })
        .eq("id", customer.id);
        
      if (revertErr) {
        console.error("Failed to revert customer vip_status:", revertErr.message);
      } else {
        console.log("Reverted customer status back to original.");
      }
    }
  }

  // 2. Test Atomic Transfer Funds RPC
  console.log("\n2. Testing transfer_funds RPC...");
  
  // Find a cash register
  const { data: registers, error: regErr } = await supabase
    .from("cash_registers")
    .select("id, name, balance")
    .limit(1);
    
  // Find a safe
  const { data: safes, error: safeErr } = await supabase
    .from("safes")
    .select("id, name, balance")
    .limit(1);

  // Find a user/profile to log the transaction
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, full_name")
    .limit(1);

  if (regErr || safeErr || profErr) {
    console.error("Failed to fetch test data:", { regErr, safeErr, profErr });
    return;
  }

  if (!registers?.length || !safes?.length || !profiles?.length) {
    console.log("Missing test data (cash register, safe, or profile). Transfer test skipped.");
    return;
  }

  const register = registers[0];
  const safe = safes[0];
  const profile = profiles[0];

  console.log(`Found register: "${register.name}" (ID: ${register.id}) with balance: ${register.balance} грн`);
  console.log(`Found safe: "${safe.name}" (ID: ${safe.id}) with balance: ${safe.balance} грн`);
  console.log(`Using profile: "${profile.full_name}" (ID: ${profile.id}) as creator`);

  // We will transfer 10 UAH from safe to register (ensure safe has enough money, or transfer the other way)
  let fromId = safe.id;
  let fromType = "safe";
  let toId = register.id;
  let toType = "cash_register";
  
  if (safe.balance < 10 && register.balance >= 10) {
    // If safe is low but register has cash, transfer from register to safe
    fromId = register.id;
    fromType = "cash_register";
    toId = safe.id;
    toType = "safe";
  }

  console.log(`Initiating transfer of 10 UAH from ${fromType} to ${toType}...`);
  
  const { error: rpcErr } = await supabase.rpc("transfer_funds", {
    from_id: fromId,
    from_type: fromType,
    to_id: toId,
    to_type: toType,
    amount: 10,
    desc_text: "Тестовий автоматичний переказ (10 грн)",
    user_id: profile.id
  });

  if (rpcErr) {
    console.error("❌ transfer_funds RPC failed:", JSON.stringify(rpcErr, null, 2));
  } else {
    console.log("✅ transfer_funds RPC completed successfully!");
    
    // Verify new balances
    const { data: updatedReg } = await supabase.from("cash_registers").select("balance").eq("id", register.id).single();
    const { data: updatedSafe } = await supabase.from("safes").select("balance").eq("id", safe.id).single();
    
    console.log(`New register balance: ${updatedReg?.balance} грн (was ${register.balance})`);
    console.log(`New safe balance: ${updatedSafe?.balance} (was ${safe.balance})`);
  }

  console.log("\n=== TESTS COMPLETED ===");
}

runTests().catch(console.error);
