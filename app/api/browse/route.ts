import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import nodePath from "node:path";
import os from "node:os";
import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";

type BrowseDirectory = {
  name: string;
  path: string;
  mediaFiles: number;
  isCourseCandidate: boolean;
};

const MEDIA_EXTENSIONS = new Set([
  ".mp4", ".mkv", ".webm", ".mov", ".avi", ".m4v",
  ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac",
  ".txt", ".md", ".html", ".htm", ".pdf",
]);

async function countMediaFilesQuick(dirPath: string): Promise<number> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    let count = 0;

    for (const entry of entries) {
      if (entry.isFile() && MEDIA_EXTENSIONS.has(nodePath.extname(entry.name).toLowerCase())) {
        count += 1;
      }
    }

    return count;
  } catch {
    return 0;
  }
}

function getWindowsDrives(): BrowseDirectory[] {
  const drives: BrowseDirectory[] = [];
  for (let code = 67; code <= 90; code += 1) {
    const letter = String.fromCharCode(code);
    const drivePath = `${letter}:\\`;
    drives.push({
      name: `Drive ${letter}:`,
      path: drivePath,
      mediaFiles: 0,
      isCourseCandidate: false,
    });
  }

  return drives;
}

export async function GET(request: NextRequest): Promise<Response> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pathParam = request.nextUrl.searchParams.get("path")?.trim() ?? "";

  try {
    if (!pathParam) {
      if (process.platform === "win32") {
        const drives = getWindowsDrives().filter((drive) => existsSync(drive.path));

        return NextResponse.json({
          currentPath: "Select a Drive",
          parentPath: null,
          directories: drives,
        });
      }

      const home = os.homedir();
      return NextResponse.json({
        currentPath: home,
        parentPath: nodePath.dirname(home) !== home ? nodePath.dirname(home) : null,
        directories: [],
      });
    }

    const currentPath = nodePath.resolve(pathParam);
    const stat = await fs.stat(currentPath);

    if (!stat.isDirectory()) {
      return NextResponse.json({ error: "Path is not a directory." }, { status: 400 });
    }

    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    const directoriesRaw = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .sort((a, b) => a.name.localeCompare(b.name));

    const directories: BrowseDirectory[] = [];
    for (const entry of directoriesRaw) {
      const fullPath = nodePath.join(currentPath, entry.name);
      const mediaFiles = await countMediaFilesQuick(fullPath);
      directories.push({
        name: entry.name,
        path: fullPath,
        mediaFiles,
        isCourseCandidate: mediaFiles > 0,
      });
    }

    const parentPath = nodePath.dirname(currentPath) !== currentPath ? nodePath.dirname(currentPath) : null;

    return NextResponse.json({
      currentPath,
      parentPath,
      directories,
    });
  } catch {
    return NextResponse.json({ error: "Unable to browse path." }, { status: 400 });
  }
}
