import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const ok = await verifySession();
  return NextResponse.json({ ok, headers: Object.fromEntries(request.headers) });
}
