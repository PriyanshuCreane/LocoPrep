import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { getCourseLessonProgressForUser, resetCourseProgressForUser } from "@/lib/progress-db";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> },
): Promise<Response> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { courseId } = await context.params;

  if (!courseId || courseId.trim() === "") {
    return NextResponse.json({ error: "courseId is required" }, { status: 400 });
  }

  const progress = await getCourseLessonProgressForUser(userId, courseId);
  return NextResponse.json(progress);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> },
): Promise<Response> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { courseId } = await context.params;

  if (!courseId || courseId.trim() === "") {
    return NextResponse.json({ error: "courseId is required" }, { status: 400 });
  }

  const deletedCount = await resetCourseProgressForUser(userId, courseId);
  return NextResponse.json({ ok: true, deletedCount });
}
