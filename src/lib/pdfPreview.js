let pdfjsPromise;

async function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([pdfjs, workerModule]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export async function renderFirstPage(file, canvas) {
  const pdfjs = await loadPdfJs();
  const source = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data: source }).promise;
  const page = await document.getPage(1);
  const originalViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(1, 240 / originalViewport.width);
  const viewport = page.getViewport({ scale });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const context = canvas.getContext("2d", { alpha: false });

  canvas.width = Math.floor(viewport.width * pixelRatio);
  canvas.height = Math.floor(viewport.height * pixelRatio);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  await page.render({
    canvas,
    canvasContext: context,
    viewport,
    transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
  }).promise;

  const pageCount = document.numPages;
  await document.destroy();
  return pageCount;
}
