import { itemsToLines, type TextItem } from './prior-return';

/**
 * Reads the text of a PDF in the browser. The file is opened from memory;
 * nothing is uploaded. Loaded on demand so the PDF library only downloads when used.
 */
export async function readPdfLines(file: File): Promise<{ lines: string[]; creator?: string }> {
  // The legacy build runs on older phones and browsers.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url,
  ).toString();

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const doc = await task.promise;
    const meta = await doc.getMetadata().catch(() => null);
    const creator = (meta?.info as { Creator?: string } | undefined)?.Creator;
    const lines: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const items: TextItem[] = [];
      for (const item of content.items) {
        if ('str' in item) items.push({ str: item.str, x: item.transform[4], y: item.transform[5], width: item.width });
      }
      lines.push(...itemsToLines(items));
    }
    return { lines, creator };
  } finally {
    await task.destroy();
  }
}
