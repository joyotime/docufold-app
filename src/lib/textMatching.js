export function parsePageSelection(value, pageCount) {
  if (!value.trim()) {
    return Array.from({ length: pageCount }, (_, index) => index);
  }

  const selected = new Set();
  for (const rawToken of value.split(",")) {
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
  return [...selected];
}

function normalizeSearchText(value) {
  return value.normalize("NFKC").toLocaleLowerCase();
}

export function matchingItemIndices(items, keyword) {
  let searchable = "";
  const owners = [];

  items.forEach((item, itemIndex) => {
    for (const character of normalizeSearchText(item.str)) {
      if (/\s/u.test(character)) continue;
      searchable += character;
      owners.push(itemIndex);
    }
  });

  const needle = [...normalizeSearchText(keyword)]
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
  return [...matchedItems];
}

export function rectangleForTextItem(item) {
  const fontHeight =
    Math.hypot(item.transform[2], item.transform[3]) || item.height || 10;
  return {
    x: item.transform[4],
    y: item.transform[5] - fontHeight * 0.24,
    width: Math.max(item.width, 2),
    height: Math.max(fontHeight * 1.2, 2),
    angle:
      (Math.atan2(item.transform[1], item.transform[0]) * 180) / Math.PI,
  };
}
