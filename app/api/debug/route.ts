import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const ok = await verifySession();
  let workout = null;
  let error = null;
  try {
    workout = await prisma.workout.create({
      data: { date: new Date(), notes: "debug" },
    });
  } catch (e: any) {
    error = e.message;
  }
  return NextResponse.json({ ok, workout, error });
}
