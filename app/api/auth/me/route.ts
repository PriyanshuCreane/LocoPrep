import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { findUserById } from "@/lib/users-db";

export async function GET(request: NextRequest): Promise<Response> {
  const userId = getUserIdFromRequest(request);

  if (!userId) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const user = await findUserById(userId);

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user: { id: user.id, email: user.email } });
}
