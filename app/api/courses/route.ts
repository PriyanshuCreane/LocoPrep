import fs from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { readCoursesRootPathFromConfig } from "@/lib/config";
import { scanCourses } from "@/lib/course-scanner";

export async function GET(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const envPath = (process.env.COURSES_ROOT_PATH ?? "").trim();
  const configPath = await readCoursesRootPathFromConfig();
  const coursesRootPath = envPath || configPath;

  if (!coursesRootPath) {
    return NextResponse.json([]);
  }

  try {
    const stat = await fs.stat(coursesRootPath);

    if (!stat.isDirectory()) {
      return NextResponse.json(
        { error: "COURSES_ROOT_PATH must point to a directory." },
        { status: 400 },
      );
    }

    const courses = await scanCourses(coursesRootPath);
    return NextResponse.json(courses);
  } catch {
    return NextResponse.json(
      { error: "Unable to scan courses. Check COURSES_ROOT_PATH." },
      { status: 400 },
    );
  }
}
