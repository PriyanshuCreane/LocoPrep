import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { getGlobalStatsForUser } from "@/lib/progress-db";

export async function GET(request: NextRequest): Promise<Response> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = await getGlobalStatsForUser(userId);
  return NextResponse.json(stats);
}
