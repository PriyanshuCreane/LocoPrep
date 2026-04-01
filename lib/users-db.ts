import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { usersTable } from "@/lib/schema";

export type AuthUser = {
  id: number;
  email: string;
  passwordHash: string;
};

export async function findUserByEmail(email: string): Promise<AuthUser | null> {
  const normalized = email.trim().toLowerCase();
  const rows = await db.select().from(usersTable).where(eq(usersTable.email, normalized)).limit(1);

  if (rows.length === 0) {
    return null;
  }

  const user = rows[0];
  return { id: user.id, email: user.email, passwordHash: user.passwordHash };
}

export async function findUserById(id: number): Promise<AuthUser | null> {
  const rows = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);

  if (rows.length === 0) {
    return null;
  }

  const user = rows[0];
  return { id: user.id, email: user.email, passwordHash: user.passwordHash };
}

export async function createUser(email: string, passwordHash: string): Promise<AuthUser> {
  const normalized = email.trim().toLowerCase();

  const inserted = await db
    .insert(usersTable)
    .values({
      email: normalized,
      passwordHash,
      createdAt: new Date().toISOString(),
    })
    .returning();

  const user = inserted[0];
  return { id: user.id, email: user.email, passwordHash: user.passwordHash };
}
