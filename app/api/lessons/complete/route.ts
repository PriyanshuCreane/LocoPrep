import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { saveLessonProgress, updateStreakForUser } from "@/lib/progress-db";

export async function POST(request: NextRequest): Promise<Response> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    lessonId?: unknown;
    courseId?: unknown;
  };

  if (typeof body.lessonId !== "string" || body.lessonId.trim() === "") {
    return NextResponse.json({ error: "lessonId is required" }, { status: 400 });
  }

  if (typeof body.courseId !== "string" || body.courseId.trim() === "") {
    return NextResponse.json({ error: "courseId is required" }, { status: 400 });
  }

  try {
    await saveLessonProgress({
      userId,
      lessonId: body.lessonId,
      courseId: body.courseId,
      lastWatchedTime: 0,
      completed: true,
    });

    const streakData = await updateStreakForUser(userId);

    return NextResponse.json({
      success: true,
      xpEarned: 100,
      streak: streakData,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to complete lesson" },
      { status: 500 },
    );
  }
}
