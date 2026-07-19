import { trackTTN } from "@/lib/services/nova-poshta";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Захист: роут використовує серверний ключ Нової Пошти, тож доступний лише
  // автентифікованим користувачам (щоб не був відкритим проксі).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(null, { status: 401 });

  const ttn = request.nextUrl.searchParams.get("ttn");
  if (!ttn) return NextResponse.json(null, { status: 400 });
  const status = await trackTTN(ttn);
  return NextResponse.json(status);
}
