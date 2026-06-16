import fs from "node:fs";
import fsPromises from "node:fs/promises";
import nodePath from "node:path";
import { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { resolveConfiguredCourseRootPath } from "@/lib/config";

const MIME_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/x-m4v",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".rtf": "application/rtf",
};

function getContentType(filePath: string): string {
  const ext = nodePath.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

async function isPdfFile(filePath: string): Promise<boolean> {
  let handle: fsPromises.FileHandle | null = null;

  try {
    handle = await fsPromises.open(filePath, "r");
    const buffer = Buffer.alloc(5);
    const result = await handle.read(buffer, 0, 5, 0);

    if (result.bytesRead < 5) {
      return false;
    }

    return buffer.toString("utf8", 0, 5) === "%PDF-";
  } catch {
    return false;
  } finally {
    await handle?.close();
  }
}

function getContentDisposition(filePath: string, forceInline: boolean): string | undefined {
  if (forceInline) {
    const fileName = nodePath.basename(filePath).replace(/"/g, "");
    return `inline; filename="${fileName}"`;
  }

  const ext = nodePath.extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    const fileName = nodePath.basename(filePath).replace(/"/g, "");
    return `inline; filename="${fileName}"`;
  }

  return undefined;
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
    const coursesRootPath = await resolveConfiguredCourseRootPath(request.nextUrl.searchParams.get("root"));

    if (!coursesRootPath) {
      return new Response("COURSES_ROOT_PATH is not configured", { status: 400 });
    }

    const { path: rawSegments } = await context.params;
    const segments = (rawSegments ?? []).map((segment) => decodeURIComponent(segment));

    if (segments.length === 0) {
      return new Response("File path is required", { status: 400 });
    }

    const resolvedRoot = nodePath.resolve(coursesRootPath);
    const resolvedFilePath = nodePath.resolve(resolvedRoot, ...segments);

    if (
      resolvedFilePath !== resolvedRoot &&
      !resolvedFilePath.startsWith(`${resolvedRoot}${nodePath.sep}`)
    ) {
      return new Response("Invalid file path", { status: 400 });
    }

    const stat = await fsPromises.stat(resolvedFilePath);

    if (!stat.isFile()) {
      return new Response("File not found", { status: 404 });
    }

    const totalSize = stat.size;
    const forceInline = request.nextUrl.searchParams.get("inline") === "1";
    const inferredContentType = getContentType(resolvedFilePath);
    const shouldUsePdfType =
      forceInline &&
      (inferredContentType === "application/pdf" ||
        (inferredContentType === "application/octet-stream" && (await isPdfFile(resolvedFilePath))));
    const contentType = shouldUsePdfType ? "application/pdf" : inferredContentType;
    const contentDisposition = getContentDisposition(resolvedFilePath, forceInline);
    const rangeHeader = request.headers.get("range");

    if (rangeHeader) {
      const parsedRange = parseRangeHeader(rangeHeader, totalSize);

      if (!parsedRange) {
        return outOfRangeResponse(totalSize);
      }

      const { start, end } = parsedRange;
      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(resolvedFilePath, { start, end });

      const webStream = new ReadableStream({
        start(controller) {
          stream.on("data", (chunk) => {
            try {
              controller.enqueue(chunk);
            } catch {}
          });
          stream.on("end", () => {
            try {
              controller.close();
            } catch {}
          });
          stream.on("error", () => {
            try {
              controller.close();
            } catch {}
          });
        },
        cancel() {
          stream.destroy();
        },
      });

      return new Response(webStream, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(chunkSize),
          "Content-Range": `bytes ${start}-${end}/${totalSize}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-cache",
          ...(contentDisposition ? { "Content-Disposition": contentDisposition } : {}),
        },
      });
    }

    const fullStream = fs.createReadStream(resolvedFilePath);

    const webStream = new ReadableStream({
      start(controller) {
        fullStream.on("data", (chunk) => {
          try {
            controller.enqueue(chunk);
          } catch {}
        });
        fullStream.on("end", () => {
          try {
            controller.close();
          } catch {}
        });
        fullStream.on("error", () => {
          try {
            controller.close();
          } catch {}
        });
      },
      cancel() {
        fullStream.destroy();
      },
    });

    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(totalSize),
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
        ...(contentDisposition ? { "Content-Disposition": contentDisposition } : {}),
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Response("File not found", { status: 404 });
    }

    return new Response("Unable to serve file", { status: 500 });
  }
}
