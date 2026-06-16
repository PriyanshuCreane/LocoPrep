import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import {
  readAppSettingsFromConfig,
  writeAppSettingsToConfig,
  normalizeCourseOrganizer,
} from "@/lib/config";

export async function GET(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configSettings = await readAppSettingsFromConfig();

  return NextResponse.json({
    coursesRootPath: configSettings.courseRoots[0]?.path ?? "",
    courseRoots: configSettings.courseRoots,
    courseOrganizer: configSettings.courseOrganizer,
    autoplayVideos: configSettings.autoplayVideos,
    autoAdvanceOnEnd: configSettings.autoAdvanceOnEnd,
    defaultPlaybackSpeed: configSettings.defaultPlaybackSpeed,
  });
}

export async function POST(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    coursesRootPath?: unknown;
    courseRoots?: unknown;
    courseOrganizer?: unknown;
    autoplayVideos?: unknown;
    autoAdvanceOnEnd?: unknown;
    defaultPlaybackSpeed?: unknown;
  };

  const autoplayVideos = typeof body.autoplayVideos === "boolean" ? body.autoplayVideos : false;
  const autoAdvanceOnEnd = typeof body.autoAdvanceOnEnd === "boolean" ? body.autoAdvanceOnEnd : false;
  const allowedSpeeds = new Set([0.5, 0.75, 1, 1.25, 1.5, 2]);
  const defaultPlaybackSpeed =
    typeof body.defaultPlaybackSpeed === "number" && allowedSpeeds.has(body.defaultPlaybackSpeed)
      ? body.defaultPlaybackSpeed
      : 1;

  const rootsInput = Array.isArray(body.courseRoots)
    ? body.courseRoots
    : typeof body.coursesRootPath === "string"
      ? [{ path: body.coursesRootPath, label: "" }]
      : [];

  const currentSettings = await readAppSettingsFromConfig();

  const incomingOrganizer = body.courseOrganizer
    ? normalizeCourseOrganizer(body.courseOrganizer)
    : currentSettings.courseOrganizer;

    const validatedRoots = rootsInput
      .map((root) => {
        if (!root || typeof root !== "object") {
          return null;
        }

        const candidate = root as { path?: unknown; label?: unknown };
        if (typeof candidate.path !== "string") {
          return null;
        }

        const trimmedPath = candidate.path.trim();
        if (!trimmedPath) {
          return null;
        }

        return {
          path: trimmedPath,
          label: typeof candidate.label === "string" ? candidate.label.trim() : "",
        };
      })
      .filter((root): root is { path: string; label: string } => root !== null);

    const nextCourseRoots = validatedRoots.length > 0 ? validatedRoots : currentSettings.courseRoots;

    await writeAppSettingsToConfig({
      ...currentSettings,
      courseRoots: nextCourseRoots,
      courseOrganizer: incomingOrganizer,
    autoplayVideos,
    autoAdvanceOnEnd,
    defaultPlaybackSpeed,
  });
  return NextResponse.json({ ok: true });
}
