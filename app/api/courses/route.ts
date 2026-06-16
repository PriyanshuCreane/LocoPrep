import fs from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { readCourseRootsFromConfig, type CourseRootSetting } from "@/lib/config";
import { scanCourses } from "@/lib/course-scanner";

export async function GET(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const courseRoots = await readCourseRootsFromConfig();

  if (!courseRoots.length) {
    return NextResponse.json([]);
  }

  try {
    const validRoots: CourseRootSetting[] = [];

    for (const root of courseRoots) {
      try {
        const stat = await fs.stat(root.path);
        if (stat.isDirectory()) {
          validRoots.push(root);
        }
      } catch {
        // Ignore missing roots so other configured libraries still load.
      }
    }

    if (!validRoots.length) {
      return NextResponse.json(
        { error: "At least one COURSES_ROOT_PATH must point to a directory." },
        { status: 400 },
      );
    }

    const courses = await scanCourses(validRoots);
    return NextResponse.json(courses);
  } catch {
    return NextResponse.json(
      { error: "Unable to scan courses. Check COURSES_ROOT_PATH values." },
      { status: 400 },
    );
  }
}
