"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";

type PdfDocumentProxy = {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxy>;
  destroy(): Promise<void> | void;
};

type PdfPageProxy = {
  getViewport(options: { scale: number }): { width: number; height: number };
  render(options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }): { promise: Promise<void>; cancel(): void };
};

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

function buildTitle(url: string | null): string {
  if (!url) {
    return "PDF viewer";
  }

  try {
    const parsed = new URL(url, window.location.origin);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1] ?? "PDF viewer";
    return decodeURIComponent(lastSegment).replace(/\.[^.]+$/, "") || "PDF viewer";
  } catch {
    return "PDF viewer";
  }
}

function PdfPageCanvas({
  pdfDocument,
  pageNumber,
  scale,
}: {
  pdfDocument: PdfDocumentProxy;
  pageNumber: number;
  scale: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const renderPage = async () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }

        const page = await pdfDocument.getPage(pageNumber);
        if (cancelled) {
          return;
        }

        const viewport = page.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;
        const context = canvas.getContext("2d");

        if (!context) {
          setPageError("Canvas rendering is not supported in this browser.");
          return;
        }

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

        const renderTask = page.render({
          canvasContext: context,
          viewport,
        });

        await renderTask.promise;
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Failed to render PDF page.";
          setPageError(message);
        }
      }
    };

    void renderPage();

    return () => {
      cancelled = true;
    };
  }, [pdfDocument, pageNumber, scale]);

  return (
    <div className="glass-luxe-soft edge-glow-violet rounded-2xl p-3 sm:p-4">
      {pageError ? (
        <div className="flex min-h-[20rem] items-center justify-center rounded-xl border border-white/10 bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] p-6 text-sm text-[var(--foreground)]/75">
          {pageError}
        </div>
      ) : (
        <canvas ref={canvasRef} className="block h-auto w-full rounded-xl bg-white" />
      )}
    </div>
  );
}

export default function PdfViewerPage() {
  const searchParams = useSearchParams();
  const rawPath = searchParams.get("path");
  const sourceFromPath = rawPath ? `/api/pdf/${rawPath}` : null;
  const legacySource = searchParams.get("src");
  const sourceUrl = sourceFromPath ?? legacySource;
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [pdfDocument, setPdfDocument] = useState<PdfDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [basePageWidth, setBasePageWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => buildTitle(sourceUrl), [sourceUrl]);
  const scale = useMemo(() => {
    if (!basePageWidth || !containerWidth) {
      return 1;
    }

    return Math.max(0.5, (containerWidth - 32) / basePageWidth);
  }, [basePageWidth, containerWidth]);

  useEffect(() => {
    if (!viewerRef.current || typeof ResizeObserver === "undefined") {
      setContainerWidth(viewerRef.current?.clientWidth ?? 0);
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(viewerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let currentDocument: PdfDocumentProxy | null = null;

    const loadPdf = async () => {
      if (!sourceUrl) {
        setError("Missing PDF source URL.");
        return;
      }

      try {
        setError(null);
        setPdfDocument(null);
        setPageCount(0);
        setBasePageWidth(0);

        const response = await fetch(sourceUrl, { credentials: "include" });

        // Fallback for older links that still point to /api/files?inline=1
        const secondaryUrl =
          rawPath && !sourceUrl.startsWith("/api/files/") ? `/api/files/${rawPath}?inline=1` : null;

        const activeResponse =
          response.ok || !secondaryUrl
            ? response
            : await fetch(secondaryUrl, { credentials: "include" });

        if (activeResponse.status === 401) {
          throw new Error("Session expired. Please login again to view this PDF.");
        }

        if (!activeResponse.ok) {
          throw new Error(`Failed to load PDF (${activeResponse.status})`);
        }

        const bytes = new Uint8Array(await activeResponse.arrayBuffer());

        if (bytes.byteLength === 0) {
          throw new Error("PDF response was empty.");
        }

        const loadingTask = pdfjsLib.getDocument({ data: bytes });

        const documentProxy = await loadingTask.promise;
        if (cancelled) {
          await documentProxy.destroy();
          return;
        }

        currentDocument = documentProxy;
        setPdfDocument(documentProxy);
        setPageCount(documentProxy.numPages);

        const firstPage = await documentProxy.getPage(1);
        const viewport = firstPage.getViewport({ scale: 1 });
        if (!cancelled) {
          setBasePageWidth(viewport.width);
        }
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Failed to load PDF.";
        if (!cancelled) {
          setError(message);
        }
      }
    };

    void loadPdf();

    return () => {
      cancelled = true;
      void currentDocument?.destroy();
    };
  }, [rawPath, sourceUrl]);

  useEffect(() => {
    if (sourceUrl) {
      setObjectUrl(sourceUrl);
    }
  }, [sourceUrl]);

  return (
    <main className="min-h-screen bg-[var(--background)] p-4 text-[var(--foreground)] sm:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col gap-4 sm:min-h-[calc(100vh-3rem)]">
        <header className="glass-luxe edge-glow-violet flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 sm:px-5">
          <div>
            <p className="accent-script text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">PDF viewer</p>
            <h1 className="text-lg font-semibold text-[var(--foreground)]">{title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {objectUrl ? (
              <a
                className="btn btn-ghost px-4 py-2 text-sm font-semibold"
                href={objectUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open raw file
              </a>
            ) : null}
            {sourceUrl ? (
              <a
                className="btn btn-primary px-4 py-2 text-sm font-bold"
                href={sourceUrl}
                rel="noreferrer"
                target="_blank"
              >
                Download
              </a>
            ) : null}
          </div>
        </header>

        <section ref={viewerRef} className="glass-luxe-soft edge-glow-violet min-h-0 flex-1 overflow-auto rounded-2xl p-3 sm:p-4">
          {error ? (
            <div className="flex min-h-[60vh] items-center justify-center rounded-xl border border-white/10 bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] p-6 text-center text-sm text-[var(--foreground)]/75">
              {error}
            </div>
          ) : pdfDocument ? (
            <div className="space-y-4">
              {Array.from({ length: pageCount }, (_, index) => (
                <PdfPageCanvas
                  key={index + 1}
                  pdfDocument={pdfDocument}
                  pageNumber={index + 1}
                  scale={scale}
                />
              ))}
            </div>
          ) : (
            <div className="flex min-h-[60vh] items-center justify-center rounded-xl border border-white/10 bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] p-6 text-center text-sm text-[var(--foreground)]/75">
              Loading PDF...
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
