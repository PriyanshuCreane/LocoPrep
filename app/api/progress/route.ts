import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { getLessonProgress, saveLessonProgress } from "@/lib/progress-db";

export async function GET(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lessonId = request.nextUrl.searchParams.get("lessonId")?.trim();

  if (!lessonId) {
    return NextResponse.json({ error: "lessonId is required" }, { status: 400 });
  }

  const progress = await getLessonProgress(userId, lessonId);
  return NextResponse.json(progress ?? { lessonId, courseId: "", lastWatchedTime: 0, completed: false, xpEarned: 0 });
}

export async function POST(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    lessonId?: unknown;
    courseId?: unknown;
    lastWatchedTime?: unknown;
    completed?: unknown;
  };

  if (typeof body.lessonId !== "string" || body.lessonId.trim() === "") {
    return NextResponse.json({ error: "lessonId must be a non-empty string" }, { status: 400 });
  }

  if (typeof body.courseId !== "string" || body.courseId.trim() === "") {
    return NextResponse.json({ error: "courseId must be a non-empty string" }, { status: 400 });
  }

  if (typeof body.lastWatchedTime !== "number") {
    return NextResponse.json({ error: "lastWatchedTime must be a number" }, { status: 400 });
  }

  const record = await saveLessonProgress({
    userId,
    lessonId: body.lessonId,
    courseId: body.courseId,
    lastWatchedTime: body.lastWatchedTime,
    completed: body.completed === true,
  });

  return NextResponse.json(record);
}
