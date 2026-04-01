declare module "pdfjs-dist/build/pdf.mjs" {
  export const GlobalWorkerOptions: {
    workerSrc: string;
  };

  export function getDocument(options: {
    url?: string;
    data?: Uint8Array;
    withCredentials?: boolean;
  }): {
    promise: Promise<PdfDocumentProxy>;
  };

  export interface PdfViewport {
    width: number;
    height: number;
  }

  export interface PdfRenderTask {
    promise: Promise<void>;
    cancel(): void;
  }

  export interface PdfPageProxy {
    getViewport(options: { scale: number }): PdfViewport;
    render(options: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }): PdfRenderTask;
  }

  export interface PdfDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PdfPageProxy>;
    destroy(): Promise<void> | void;
  }
}
