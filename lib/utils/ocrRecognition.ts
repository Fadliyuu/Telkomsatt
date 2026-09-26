import type { ImageLike, LoggerMessage, Worker } from "tesseract.js";

/** Load the browser OCR engine only when requested and always release an initialized worker. */
export async function recognizeInventoryImage(
  image: ImageLike,
  options: { signal?: AbortSignal; onProgress?: (message: LoggerMessage) => void } = {}
): Promise<{ text: string; confidence: number }> {
  let worker: Worker | undefined;
  let finished = false;
  let rejectFailure: (error: Error) => void = () => {};
  const failure = new Promise<never>((_resolve, reject) => { rejectFailure = reject; });
  const abort = () => rejectFailure(new DOMException("OCR dibatalkan", "AbortError"));
  const timeout = setTimeout(() => rejectFailure(new Error("OCR terlalu lama. Periksa koneksi internet lalu coba gambar yang lebih kecil.")), 180_000);
  options.signal?.addEventListener("abort", abort, { once: true });

  try {
    if (options.signal?.aborted) throw new DOMException("OCR dibatalkan", "AbortError");
    const task = (async () => {
      const { createWorker } = await import("tesseract.js");
      if (finished) return null;
      const created = await createWorker("ind+eng", 1, {
        logger: (message) => { if (!finished) options.onProgress?.(message); },
        // Tesseract may report language-download errors through this callback during startup.
        errorHandler: (error: unknown) => rejectFailure(error instanceof Error ? error : new Error(String(error))),
      });
      if (finished) { await created.terminate(); return null; }
      worker = created;
      await worker.setParameters({ preserve_interword_spaces: "1" });
      const { data } = await worker.recognize(image);
      return { text: data.text, confidence: data.confidence };
    })();
    const result = await Promise.race([task, failure]);
    if (!result) throw new DOMException("OCR dibatalkan", "AbortError");
    return result;
  } finally {
    finished = true;
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
    await worker?.terminate().catch(() => {});
  }
}
