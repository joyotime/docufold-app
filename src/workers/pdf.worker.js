import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
} from "pdf-lib";

function withoutExtension(name) {
  return name.replace(/\.pdf$/i, "") || "document";
}

function parseRangeToken(token, pageCount) {
  const cleaned = token.trim();
  if (!cleaned) return [];

  if (/^\d+$/.test(cleaned)) {
    const page = Number(cleaned);
    if (page < 1 || page > pageCount) {
      throw new Error(`页码 ${page} 超出文档范围（1-${pageCount}）。`);
    }
    return [page - 1];
  }

  const match = cleaned.match(/^(\d*)\s*-\s*(\d*)$/);
  if (!match || (!match[1] && !match[2])) {
    throw new Error(`无法识别页码范围“${cleaned}”。请使用 1-3, 5, 8-10 格式。`);
  }

  const start = match[1] ? Number(match[1]) : 1;
  const end = match[2] ? Number(match[2]) : pageCount;
  if (start < 1 || start > pageCount || end < 1 || end > pageCount) {
    throw new Error(`页码范围“${cleaned}”超出文档范围（1-${pageCount}）。`);
  }

  const step = start <= end ? 1 : -1;
  const pages = [];
  for (let page = start; page !== end + step; page += step) {
    pages.push(page - 1);
  }
  return pages;
}

function parseRangeGroups(value, pageCount, defaultToEveryPage = false) {
  const trimmed = value.trim();
  if (!trimmed) {
    if (defaultToEveryPage) {
      return Array.from({ length: pageCount }, (_, index) => [index]);
    }
    return [Array.from({ length: pageCount }, (_, index) => index)];
  }

  return trimmed
    .split(",")
    .map((token) => parseRangeToken(token, pageCount))
    .filter((pages) => pages.length > 0);
}

function uniquePages(groups) {
  return [...new Set(groups.flat())];
}

function output(name, bytes) {
  return { name, bytes };
}

async function mergePdfs({ files }) {
  if (files.length < 2) {
    throw new Error("请至少选择两个 PDF 文件进行合并。");
  }

  const merged = await PDFDocument.create();
  for (const file of files) {
    const source = await PDFDocument.load(file.data);
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }

  return [output("docufold-merged.pdf", await merged.save())];
}

async function splitPdf({ file, ranges }) {
  const source = await PDFDocument.load(file.data);
  const groups = parseRangeGroups(ranges, source.getPageCount(), true);
  const baseName = withoutExtension(file.name);
  const outputs = [];

  for (const [index, pageIndices] of groups.entries()) {
    const split = await PDFDocument.create();
    const pages = await split.copyPages(source, pageIndices);
    pages.forEach((page) => split.addPage(page));
    const pageLabel = pageIndices.map((page) => page + 1).join("-");
    outputs.push(
      output(
        `${baseName}-pages-${pageLabel || index + 1}.pdf`,
        await split.save(),
      ),
    );
  }

  return outputs;
}

async function rotatePdf({ file, ranges, angle }) {
  const document = await PDFDocument.load(file.data);
  const pages = uniquePages(
    parseRangeGroups(ranges, document.getPageCount(), false),
  );

  pages.forEach((pageIndex) => {
    const page = document.getPage(pageIndex);
    const currentAngle = page.getRotation().angle;
    page.setRotation(degrees((currentAngle + Number(angle)) % 360));
  });

  return [
    output(
      `${withoutExtension(file.name)}-rotated.pdf`,
      await document.save(),
    ),
  ];
}

function parseHexColor(value) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(value);
  if (!match) return rgb(0.12, 0.18, 0.16);
  return rgb(
    Number.parseInt(match[1], 16) / 255,
    Number.parseInt(match[2], 16) / 255,
    Number.parseInt(match[3], 16) / 255,
  );
}

function drawCenteredWatermark(page, options) {
  const { width, height } = page.getSize();
  const textWidth = options.font.widthOfTextAtSize(options.text, options.size);
  page.drawText(options.text, {
    x: (width - textWidth) / 2,
    y: height / 2,
    size: options.size,
    font: options.font,
    color: options.color,
    opacity: options.opacity,
    rotate: degrees(options.angle),
  });
}

function drawFooterWatermark(page, options) {
  const { width } = page.getSize();
  const textWidth = options.font.widthOfTextAtSize(options.text, options.size);
  page.drawText(options.text, {
    x: Math.max(24, (width - textWidth) / 2),
    y: 24,
    size: options.size,
    font: options.font,
    color: options.color,
    opacity: options.opacity,
  });
}

function drawTiledWatermark(page, options) {
  const { width, height } = page.getSize();
  const horizontalGap = Math.max(180, options.size * 5);
  const verticalGap = Math.max(140, options.size * 4);
  for (let y = 45; y < height; y += verticalGap) {
    for (let x = -20; x < width; x += horizontalGap) {
      page.drawText(options.text, {
        x,
        y,
        size: options.size,
        font: options.font,
        color: options.color,
        opacity: options.opacity,
        rotate: degrees(options.angle),
      });
    }
  }
}

async function watermarkPdf({
  file,
  ranges,
  text,
  size,
  opacity,
  angle,
  color,
  placement,
}) {
  if (!text.trim()) throw new Error("请输入水印文字。");

  const document = await PDFDocument.load(file.data);
  const font = await document.embedFont(StandardFonts.Helvetica);
  const pages = uniquePages(
    parseRangeGroups(ranges, document.getPageCount(), false),
  );
  const options = {
    text: text.trim(),
    size: Number(size),
    opacity: Number(opacity),
    angle: Number(angle),
    color: parseHexColor(color),
    font,
  };

  pages.forEach((pageIndex) => {
    const page = document.getPage(pageIndex);
    if (placement === "tile") drawTiledWatermark(page, options);
    else if (placement === "footer") drawFooterWatermark(page, options);
    else drawCenteredWatermark(page, options);
  });

  return [
    output(
      `${withoutExtension(file.name)}-watermarked.pdf`,
      await document.save(),
    ),
  ];
}

const handlers = {
  merge: mergePdfs,
  split: splitPdf,
  rotate: rotatePdf,
  watermark: watermarkPdf,
};

self.addEventListener("message", async ({ data }) => {
  const { id, action, payload } = data;
  try {
    const handler = handlers[action];
    if (!handler) throw new Error("未知的 PDF 操作。");
    const result = await handler(payload);
    const buffers = result.map(({ bytes }) => bytes.buffer);
    self.postMessage({ id, result }, buffers);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "PDF 处理失败，请确认文件有效。";
    self.postMessage({ id, error: message });
  }
});
