import fs from "node:fs";
import fsPromises from "node:fs/promises";
import nodePath from "node:path";
import { Readable } from "node:stream";
import { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { readCoursesRootPathFromConfig } from "@/lib/config";

const VIDEO_MIME_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/x-m4v",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
};

function getContentType(filePath: string): string {
  const ext = nodePath.extname(filePath).toLowerCase();
  return VIDEO_MIME_TYPES[ext] ?? "application/octet-stream";
}

function parseRangeHeader(rangeHeader: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());

  if (!match) {
    return null;
  }

  const startRaw = match[1];
  const endRaw = match[2];

  if (startRaw === "" && endRaw === "") {
    return null;
  }

  if (startRaw === "") {
    const suffixLength = Number.parseInt(endRaw, 10);

    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }

    const start = Math.max(size - suffixLength, 0);
    const end = size - 1;
    return { start, end };
  }

  const start = Number.parseInt(startRaw, 10);
  const end = endRaw === "" ? size - 1 : Number.parseInt(endRaw, 10);

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }

  if (start < 0 || end < start || start >= size) {
    return null;
  }

  return { start, end: Math.min(end, size - 1) };
}

function outOfRangeResponse(size: number): Response {
  return new Response("Requested range not satisfiable", {
    status: 416,
    headers: {
      "Content-Range": `bytes */${size}`,
      "Accept-Ranges": "bytes",
    },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const envPath = (process.env.COURSES_ROOT_PATH ?? "").trim();
    const configPath = await readCoursesRootPathFromConfig();
    const coursesRootPath = envPath || configPath;

    if (!coursesRootPath) {
      return new Response("COURSES_ROOT_PATH is not configured", { status: 400 });
    }

    const { path: rawSegments } = await context.params;
    const segments = (rawSegments ?? []).map((segment) => decodeURIComponent(segment));

    if (segments.length === 0) {
      return new Response("Video path is required", { status: 400 });
    }

    const resolvedRoot = nodePath.resolve(coursesRootPath);
    const resolvedFilePath = nodePath.resolve(resolvedRoot, ...segments);

    if (
      resolvedFilePath !== resolvedRoot &&
      !resolvedFilePath.startsWith(`${resolvedRoot}${nodePath.sep}`)
    ) {
      return new Response("Invalid video path", { status: 400 });
    }

    const stat = await fsPromises.stat(resolvedFilePath);

    if (!stat.isFile()) {
      return new Response("Video file not found", { status: 404 });
    }

    const totalSize = stat.size;
    const contentType = getContentType(resolvedFilePath);
    const rangeHeader = request.headers.get("range");

    if (rangeHeader) {
      const parsedRange = parseRangeHeader(rangeHeader, totalSize);

      if (!parsedRange) {
        return outOfRangeResponse(totalSize);
      }

      const { start, end } = parsedRange;
      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(resolvedFilePath, { start, end });

      return new Response(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(chunkSize),
          "Content-Range": `bytes ${start}-${end}/${totalSize}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-cache",
        },
      });
    }

    const fullStream = fs.createReadStream(resolvedFilePath);

    return new Response(Readable.toWeb(fullStream) as ReadableStream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(totalSize),
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Response("Video file not found", { status: 404 });
    }

    return new Response("Unable to stream video", { status: 500 });
  }
}
