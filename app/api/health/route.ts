import { connection, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/health -> { ok: true, db: "up" } (503 and db "down" when the database is unreachable)
export async function GET() {
  // Run at request time, never prerendered at build.
  await connection();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up" });
  } catch (error) {
    // Details go to the server log only: the message can contain connection info.
    console.error("health check: database ping failed", error);
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
