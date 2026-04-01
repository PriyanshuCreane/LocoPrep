import { NextRequest, NextResponse } from "next/server";
import { authCookie, getAuthCookieOptions } from "@/lib/auth";

export async function POST(request: NextRequest): Promise<Response> {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: authCookie.name,
    value: "",
    ...getAuthCookieOptions(request, { maxAge: 0 }),
  });

  return response;
}
