import {
  PDFArray,
  PDFContentStream,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFStream,
  decodePDFRawStream,
} from "pdf-lib";

export const OVERLAY_NOT_FOUND_MESSAGE =
  "The watermark heavily overlaps the document content and is not stored as an independent layer. Try a selection mask or clean the header and footer areas instead.";

const SUBTYPE = PDFName.of("Subtype");
const FORM = PDFName.of("Form");
const RESOURCES = PDFName.of("Resources");
const EXT_G_STATE = PDFName.of("ExtGState");
const FILL_ALPHA = PDFName.of("ca");
const STROKE_ALPHA = PDFName.of("CA");
const SOFT_MASK = PDFName.of("SMask");
const MASK = PDFName.of("Mask");
const BLEND_MODE = PDFName.of("BM");
const GROUP = PDFName.of("Group");
const GROUP_SUBTYPE = PDFName.of("S");
const TRANSPARENCY = PDFName.of("Transparency");
const NONE = PDFName.of("None");
const NORMAL = PDFName.of("Normal");
const COMPATIBLE = PDFName.of("Compatible");

function safeLookup(dict, key, type) {
  try {
    return dict.lookupMaybe(key, type);
  } catch {
    return undefined;
  }
}

function safeLookupValue(dict, key) {
  try {
    return dict.lookup(key);
  } catch {
    return undefined;
  }
}

function nameEquals(value, expected) {
  return value instanceof PDFName && value === expected;
}

function alphaValue(dict, key) {
  const value = safeLookup(dict, key, PDFNumber);
  return value ? value.asNumber() : undefined;
}

function blendModeIsTransparent(value) {
  if (value instanceof PDFName) {
    return value !== NORMAL && value !== COMPATIBLE;
  }
  if (value instanceof PDFArray) {
    for (let index = 0; index < value.size(); index += 1) {
      let mode;
      try {
        mode = value.lookup(index, PDFName);
      } catch {
        continue;
      }
      if (mode !== NORMAL && mode !== COMPATIBLE) return true;
    }
  }
  return false;
}

function transparencyStatus(dict) {
  const fillAlpha = alphaValue(dict, FILL_ALPHA);
  const strokeAlpha = alphaValue(dict, STROKE_ALPHA);
  if (
    (fillAlpha !== undefined && fillAlpha < 0.9999) ||
    (strokeAlpha !== undefined && strokeAlpha < 0.9999)
  ) {
    return true;
  }

  const softMask = safeLookupValue(dict, SOFT_MASK);
  if (softMask && !nameEquals(softMask, NONE)) return true;
  if (dict.has(MASK)) return true;
  if (blendModeIsTransparent(safeLookupValue(dict, BLEND_MODE))) return true;

  if (fillAlpha !== undefined || strokeAlpha !== undefined) return false;
  return undefined;
}

function hasTransparencyGroup(dict) {
  const group = safeLookup(dict, GROUP, PDFDict);
  return Boolean(
    group && nameEquals(safeLookup(group, GROUP_SUBTYPE, PDFName), TRANSPARENCY),
  );
}

function collectGraphicsStateNames(resources) {
  const transparent = new Set();
  const opaque = new Set();
  const states = resources
    ? safeLookup(resources, EXT_G_STATE, PDFDict)
    : undefined;
  if (!states) return { transparent, opaque };

  const entries = states.entries();
  for (let index = 0; index < entries.length; index += 1) {
    const name = entries[index][0];
    const state = safeLookup(states, name, PDFDict);
    if (!state) continue;
    const status = transparencyStatus(state);
    if (status === true) transparent.add(name.asString());
    else if (status === false) opaque.add(name.asString());
  }
  return { transparent, opaque };
}

function xObjectIsOverlay(stream) {
  const subtype = safeLookup(stream.dict, SUBTYPE, PDFName);
  if (nameEquals(subtype, FORM)) return true;
  if (transparencyStatus(stream.dict) === true) return true;
  if (hasTransparencyGroup(stream.dict)) return true;

  const resources = safeLookup(stream.dict, RESOURCES, PDFDict);
  return collectGraphicsStateNames(resources).transparent.size > 0;
}

function inspectPageResources(page) {
  const overlayNames = new Set();
  const resources = page.node.Resources();
  const graphicsStates = collectGraphicsStateNames(resources);
  const xObjects = resources
    ? safeLookup(resources, PDFName.XObject, PDFDict)
    : undefined;
  if (!xObjects) {
    return {
      overlayNames,
      transparentStates: graphicsStates.transparent,
      opaqueStates: graphicsStates.opaque,
    };
  }

  const entries = xObjects.entries();
  for (let index = 0; index < entries.length; index += 1) {
    const name = entries[index][0];
    const stream = safeLookup(xObjects, name, PDFStream);
    if (stream && xObjectIsOverlay(stream)) {
      overlayNames.add(name.asString());
    }
  }

  return {
    overlayNames,
    transparentStates: graphicsStates.transparent,
    opaqueStates: graphicsStates.opaque,
  };
}

function decodeContentStream(stream) {
  if (stream instanceof PDFRawStream) {
    return decodePDFRawStream(stream).decode();
  }
  if (stream instanceof PDFContentStream) {
    return stream.getUnencodedContents();
  }
  if (!stream.dict.has(PDFName.of("Filter"))) {
    return stream.getContents();
  }
  throw new Error("The page content stream could not be decoded.");
}

function pageContentBytes(page) {
  const contents = page.node.Contents();
  const streams = [];
  if (contents instanceof PDFArray) {
    for (let index = 0; index < contents.size(); index += 1) {
      let stream;
      try {
        stream = contents.lookup(index, PDFStream);
      } catch {
        return undefined;
      }
      streams.push(decodeContentStream(stream));
    }
  } else if (contents instanceof PDFStream) {
    streams.push(decodeContentStream(contents));
  }
  if (streams.length === 0) return undefined;

  let size = streams.length - 1;
  for (let index = 0; index < streams.length; index += 1) {
    size += streams[index].length;
  }
  const combined = new Uint8Array(size);
  let offset = 0;
  for (let index = 0; index < streams.length; index += 1) {
    combined.set(streams[index], offset);
    offset += streams[index].length;
    if (index < streams.length - 1) combined[offset++] = 10;
  }
  return combined;
}

function isWhitespace(byte) {
  return (
    byte === 0 ||
    byte === 9 ||
    byte === 10 ||
    byte === 12 ||
    byte === 13 ||
    byte === 32
  );
}

function isDelimiter(byte) {
  return (
    byte === 37 ||
    byte === 40 ||
    byte === 41 ||
    byte === 47 ||
    byte === 60 ||
    byte === 62 ||
    byte === 91 ||
    byte === 93 ||
    byte === 123 ||
    byte === 125
  );
}

function tokenText(bytes, start, end) {
  let value = "";
  for (let index = start; index < end; index += 1) {
    value += String.fromCharCode(bytes[index]);
  }
  return value;
}

function skipLiteralString(bytes, start) {
  let depth = 1;
  let index = start + 1;
  while (index < bytes.length && depth > 0) {
    const byte = bytes[index];
    if (byte === 92) {
      const escapedByte = bytes[index + 1];
      index += 2;
      if (escapedByte === 13 && bytes[index] === 10) index += 1;
      continue;
    }
    if (byte === 40) depth += 1;
    else if (byte === 41) depth -= 1;
    index += 1;
  }
  return index;
}

function skipHexString(bytes, start) {
  let index = start + 1;
  while (index < bytes.length && bytes[index] !== 62) index += 1;
  return Math.min(index + 1, bytes.length);
}

function findInlineImageEnd(bytes, start) {
  for (let index = start; index < bytes.length - 1; index += 1) {
    if (bytes[index] !== 69 || bytes[index + 1] !== 73) continue;
    const before = index === 0 ? 32 : bytes[index - 1];
    const after = index + 2 >= bytes.length ? 32 : bytes[index + 2];
    if (isWhitespace(before) && (isWhitespace(after) || isDelimiter(after))) {
      return index + 2;
    }
  }
  return bytes.length;
}

function contentTokens(bytes) {
  const tokens = [];
  let index = 0;
  let arrayDepth = 0;
  let dictionaryDepth = 0;
  let inlineImageDictionary = false;

  while (index < bytes.length) {
    const byte = bytes[index];
    if (isWhitespace(byte)) {
      index += 1;
      continue;
    }
    if (byte === 37) {
      while (
        index < bytes.length &&
        bytes[index] !== 10 &&
        bytes[index] !== 13
      ) {
        index += 1;
      }
      continue;
    }
    if (byte === 40) {
      index = skipLiteralString(bytes, index);
      continue;
    }
    if (byte === 60) {
      if (bytes[index + 1] === 60) {
        dictionaryDepth += 1;
        index += 2;
      } else {
        index = skipHexString(bytes, index);
      }
      continue;
    }
    if (byte === 62 && bytes[index + 1] === 62) {
      dictionaryDepth = Math.max(0, dictionaryDepth - 1);
      index += 2;
      continue;
    }
    if (byte === 91) {
      arrayDepth += 1;
      index += 1;
      continue;
    }
    if (byte === 93) {
      arrayDepth = Math.max(0, arrayDepth - 1);
      index += 1;
      continue;
    }

    const start = index;
    const type = byte === 47 ? "name" : "word";
    if (type === "name") index += 1;
    while (
      index < bytes.length &&
      !isWhitespace(bytes[index]) &&
      !isDelimiter(bytes[index])
    ) {
      index += 1;
    }
    if (index === start) {
      index += 1;
      continue;
    }

    const value = tokenText(bytes, start, index);
    if (arrayDepth > 0 || dictionaryDepth > 0) continue;
    if (inlineImageDictionary) {
      if (value === "ID") {
        index = findInlineImageEnd(bytes, index);
        inlineImageDictionary = false;
      }
      continue;
    }
    if (value === "BI") {
      inlineImageDictionary = true;
      continue;
    }
    tokens.push({ start, end: index, type, value });
  }
  return tokens;
}

function blankOperator(bytes, start, end) {
  for (let index = start; index < end; index += 1) {
    if (!isWhitespace(bytes[index])) bytes[index] = 32;
  }
}

function filterOverlayOperators(bytes, resourceInfo) {
  const filtered = bytes.slice();
  const tokens = contentTokens(bytes);
  const transparencyStack = [];
  let transparentState = false;
  let removed = 0;
  let previous;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.value === "q") {
      transparencyStack.push(transparentState);
    } else if (token.value === "Q") {
      transparentState =
        transparencyStack.length > 0 ? transparencyStack.pop() : false;
    } else if (token.value === "gs" && previous?.type === "name") {
      if (resourceInfo.transparentStates.has(previous.value)) {
        transparentState = true;
      } else if (resourceInfo.opaqueStates.has(previous.value)) {
        transparentState = false;
      }
    } else if (token.value === "Do" && previous?.type === "name") {
      if (
        transparentState ||
        resourceInfo.overlayNames.has(previous.value)
      ) {
        blankOperator(filtered, previous.start, token.end);
        removed += 1;
      }
    }
    previous = token;
  }
  return { bytes: filtered, removed };
}

function removePageOverlays(document, page) {
  const resourceInfo = inspectPageResources(page);
  if (
    resourceInfo.overlayNames.size === 0 &&
    resourceInfo.transparentStates.size === 0
  ) {
    return 0;
  }
  const contents = pageContentBytes(page);
  if (!contents) return 0;

  const filtered = filterOverlayOperators(contents, resourceInfo);
  if (filtered.removed === 0) return 0;
  const stream = document.context.flateStream(filtered.bytes);
  page.node.set(PDFName.Contents, document.context.register(stream));
  return filtered.removed;
}

export function removeTransparentOverlayXObjects(document, pageIndices) {
  let removed = 0;
  for (let index = 0; index < pageIndices.length; index += 1) {
    try {
      removed += removePageOverlays(
        document,
        document.getPage(pageIndices[index]),
      );
    } catch {
      continue;
    }
  }
  return removed;
}
