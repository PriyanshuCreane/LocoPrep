import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { usersTable } from "@/lib/schema";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password || password.length < 8) {
      return NextResponse.json(
        { error: "Valid email and a password of at least 8 characters are required." },
        { status: 400 },
      );
    }

    const [existingUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1);

    if (!existingUser) {
      // Return 404 so the user knows if the email is wrong
      return NextResponse.json(
        { error: "No account found with that email address." },
        { status: 404 },
      );
    }

    const hashedPassword = hashPassword(password);
    const now = new Date().toISOString();

    await db
      .update(usersTable)
      .set({
        passwordHash: hashedPassword,
      })
      .where(eq(usersTable.id, existingUser.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while resetting password." },
      { status: 500 },
    );
  }
}
