import {
  matchingItemIndices,
  NO_TEXT_WATERMARK_MESSAGE,
  parsePageSelection,
  rectangleForTextItem,
} from "./textMatching.js";
import { installPdfCompatibility } from "./pdfCompatibility.js";

installPdfCompatibility();

let pdfjsPromise;

async function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ])
      .then(([pdfjs, workerModule]) => {
        if (
          typeof pdfjs.getDocument !== "function" ||
          !pdfjs.GlobalWorkerOptions ||
          typeof workerModule.default !== "string"
        ) {
          throw new Error("PDF 预览组件未正确初始化。");
        }
        pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
        return pdfjs;
      })
      .catch((error) => {
        pdfjsPromise = undefined;
        const detail = error instanceof Error ? error.message : "未知加载错误";
        throw new Error("PDF 预览组件加载失败：" + detail);
      });
  }
  return pdfjsPromise;
}

function assertReadableFile(file) {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new Error("无法读取所选 PDF 文件，请重新选择文件。");
  }
}

function readableError(prefix, error) {
  const detail = error instanceof Error ? error.message : "未知错误";
  return new Error(prefix + "：" + detail);
}

export async function locateTextMatches(file, keyword, pageRanges) {
  if (typeof keyword !== "string" || !keyword.trim()) {
    throw new Error("请输入要匹配的水印关键字。");
  }
  const trimmedKeyword = keyword.trim();
  assertReadableFile(file);

  let loadingTask;
  const matches = [];

  try {
    const pdfjs = await loadPdfJs();
    const source = new Uint8Array(await file.arrayBuffer());
    loadingTask = pdfjs.getDocument({
      data: source,
      useSystemFonts: true,
    });
    if (!loadingTask || !loadingTask.promise) {
      throw new Error("PDF.js 未返回有效的加载任务。");
    }
    const document = await loadingTask.promise;
    const pageIndices = parsePageSelection(pageRanges || "", document.numPages);

    for (let index = 0; index < pageIndices.length; index += 1) {
      const pageIndex = pageIndices[index];
      const page = await document.getPage(pageIndex + 1);
      try {
        const textContent = await page.getTextContent();
        const rawItems = Array.from(
          (textContent && textContent.items) || [],
        );
        const items = [];
        for (let itemIndex = 0; itemIndex < rawItems.length; itemIndex += 1) {
          const item = rawItems[itemIndex];
          if (
            item &&
            typeof item.str === "string" &&
            item.str.length > 0 &&
            item.transform &&
            item.transform.length >= 6
          ) {
            items.push(item);
          }
        }
        const matchedIndices = matchingItemIndices(items, trimmedKeyword);
        if (matchedIndices.length > 0) {
          matches.push({
            pageIndex,
            rectangles: matchedIndices.map((itemIndex) =>
              rectangleForTextItem(items[itemIndex]),
            ),
          });
        }
      } finally {
        if (typeof page.cleanup === "function") page.cleanup();
      }
    }
  } catch (error) {
    throw readableError("无法分析 PDF 水印文字", error);
  } finally {
    if (loadingTask && typeof loadingTask.destroy === "function") {
      try {
        await loadingTask.destroy();
      } catch {
        // Preserve the actionable parsing error instead of failing on cleanup.
      }
    }
  }

  if (matches.length === 0) {
    throw new Error(NO_TEXT_WATERMARK_MESSAGE);
  }
  return matches;
}

export async function renderFirstPage(file, canvas) {
  assertReadableFile(file);
  if (!canvas || typeof canvas.getContext !== "function") {
    throw new Error("PDF 预览画布不可用。");
  }

  let loadingTask;
  let page;
  try {
    const pdfjs = await loadPdfJs();
    const source = new Uint8Array(await file.arrayBuffer());
    loadingTask = pdfjs.getDocument({
      data: source,
      useSystemFonts: true,
    });
    if (!loadingTask || !loadingTask.promise) {
      throw new Error("PDF.js 未返回有效的加载任务。");
    }
    const document = await loadingTask.promise;
    page = await document.getPage(1);
    const originalViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(1, 240 / originalViewport.width);
    const viewport = page.getViewport({ scale });
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("浏览器无法创建 PDF 预览画布。");

    canvas.width = Math.floor(viewport.width * pixelRatio);
    canvas.height = Math.floor(viewport.height * pixelRatio);
    canvas.style.width = Math.floor(viewport.width) + "px";
    canvas.style.height = Math.floor(viewport.height) + "px";

    const renderTask = page.render({
      canvas,
      canvasContext: context,
      viewport,
      transform:
        pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
    });
    if (!renderTask || !renderTask.promise) {
      throw new Error("PDF.js 未返回有效的渲染任务。");
    }
    await renderTask.promise;
    return document.numPages;
  } catch (error) {
    throw readableError("PDF 预览失败", error);
  } finally {
    if (page && typeof page.cleanup === "function") page.cleanup();
    if (loadingTask && typeof loadingTask.destroy === "function") {
      try {
        await loadingTask.destroy();
      } catch {
        // Preview cleanup failure must not crash the page.
      }
    }
  }
}
