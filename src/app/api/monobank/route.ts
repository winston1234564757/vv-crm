import { getMonobankStatement } from "@/lib/services/monobank";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Enforce authentication context
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Load statements from the last 3 days
    const threeDaysAgo = Math.floor(Date.now() / 1000) - 3 * 24 * 60 * 60;
    const statements = await getMonobankStatement(threeDaysAgo);

    return NextResponse.json(statements);
  } catch (error) {
    console.error("Помилка API Monobank route:", error);
    return NextResponse.json({ error: "Внутрішня помилка сервера" }, { status: 500 });
  }
}
