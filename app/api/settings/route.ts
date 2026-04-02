import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import {
  readAppSettingsFromConfig,
  writeAppSettingsToConfig,
} from "@/lib/config";

export async function GET(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configSettings = await readAppSettingsFromConfig();

  return NextResponse.json({
    coursesRootPath: configSettings.coursesRootPath,
    autoplayVideos: configSettings.autoplayVideos,
    autoAdvanceOnEnd: configSettings.autoAdvanceOnEnd,
  });
}

export async function POST(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    coursesRootPath?: unknown;
    autoplayVideos?: unknown;
    autoAdvanceOnEnd?: unknown;
  };

  if (typeof body.coursesRootPath !== "string") {
    return NextResponse.json(
      { error: "coursesRootPath must be a string." },
      { status: 400 },
    );
  }

  const autoplayVideos = typeof body.autoplayVideos === "boolean" ? body.autoplayVideos : false;
  const autoAdvanceOnEnd = typeof body.autoAdvanceOnEnd === "boolean" ? body.autoAdvanceOnEnd : false;

  await writeAppSettingsToConfig({
    coursesRootPath: body.coursesRootPath,
    autoplayVideos,
    autoAdvanceOnEnd,
  });
  return NextResponse.json({ ok: true });
}
