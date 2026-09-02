export function parsePageSelection(value, pageCount) {
  const normalizedValue = typeof value === "string" ? value : "";
  if (!normalizedValue.trim()) {
    return Array.from({ length: pageCount }, (_, index) => index);
  }

  const selected = new Set();
  const tokens = normalizedValue.split(",");
  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    const rawToken = tokens[tokenIndex];
    const token = rawToken.trim();
    if (/^\d+$/.test(token)) {
      const page = Number(token);
      if (page < 1 || page > pageCount) {
        throw new Error(
          "页码 " + page + " 超出文档范围（1-" + pageCount + "）。",
        );
      }
      selected.add(page - 1);
      continue;
    }

    const match = token.match(/^(\d*)\s*-\s*(\d*)$/);
    if (!match || (!match[1] && !match[2])) {
      throw new Error(
        "无法识别页码范围“" + token + "”。请使用 1-3, 5 格式。",
      );
    }
    const start = match[1] ? Number(match[1]) : 1;
    const end = match[2] ? Number(match[2]) : pageCount;
    if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
      throw new Error(
        "页码范围“" + token + "”超出文档范围（1-" + pageCount + "）。",
      );
    }
    const step = start <= end ? 1 : -1;
    for (let page = start; page !== end + step; page += step) {
      selected.add(page - 1);
    }
  }
  return Array.from(selected);
}

function normalizeSearchText(value) {
  const text = typeof value === "string" ? value : "";
  return typeof text.normalize === "function"
    ? text.normalize("NFKC").toLocaleLowerCase()
    : text.toLocaleLowerCase();
}

export function matchingItemIndices(items, keyword) {
  let searchable = "";
  const owners = [];

  Array.from(items || []).forEach((item, itemIndex) => {
    const characters = Array.from(normalizeSearchText(item?.str));
    for (
      let characterIndex = 0;
      characterIndex < characters.length;
      characterIndex += 1
    ) {
      const character = characters[characterIndex];
      if (/\s/u.test(character)) continue;
      searchable += character;
      owners.push(itemIndex);
    }
  });

  const needle = Array.from(normalizeSearchText(keyword))
    .filter((character) => !/\s/u.test(character))
    .join("");
  const matchedItems = new Set();
  let position = 0;
  while (needle && position <= searchable.length - needle.length) {
    const matchIndex = searchable.indexOf(needle, position);
    if (matchIndex === -1) break;
    for (let index = matchIndex; index < matchIndex + needle.length; index += 1) {
      matchedItems.add(owners[index]);
    }
    position = matchIndex + Math.max(needle.length, 1);
  }
  return Array.from(matchedItems);
}

export function rectangleForTextItem(item) {
  const transform = Array.from(item?.transform || []);
  if (transform.length < 6) {
    throw new Error("PDF 文本定位信息无效，无法生成擦除区域。");
  }
  const fontHeight =
    Math.hypot(Number(transform[2]), Number(transform[3])) ||
    Number(item.height) ||
    10;
  return {
    x: Number(transform[4]),
    y: Number(transform[5]) - fontHeight * 0.24,
    width: Math.max(Number(item.width) || 0, 2),
    height: Math.max(fontHeight * 1.2, 2),
    angle: (Math.atan2(transform[1], transform[0]) * 180) / Math.PI,
  };
}
