import { trackTTN } from "@/lib/services/nova-poshta";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const ttn = request.nextUrl.searchParams.get("ttn");
  if (!ttn) return NextResponse.json(null, { status: 400 });
  const status = await trackTTN(ttn);
  return NextResponse.json(status);
}
