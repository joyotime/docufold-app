function defineMethod(target, name, value) {
  Object.defineProperty(target, name, {
    configurable: true,
    writable: true,
    value,
  });
}

function installAt(target) {
  if (!target || typeof target.at === "function") return;

  defineMethod(target, "at", function at(index) {
    const length = Number(this.length) || 0;
    let resolvedIndex = Math.trunc(Number(index) || 0);
    if (resolvedIndex < 0) resolvedIndex += length;
    if (resolvedIndex < 0 || resolvedIndex >= length) return undefined;
    return this[resolvedIndex];
  });
}

function installFindLast() {
  if (typeof Array.prototype.findLast === "function") return;
  defineMethod(Array.prototype, "findLast", function findLast(predicate) {
    if (typeof predicate !== "function") {
      throw new TypeError("findLast requires a predicate function.");
    }
    for (let index = this.length - 1; index >= 0; index -= 1) {
      const value = this[index];
      if (predicate(value, index, this)) return value;
    }
    return undefined;
  });
}

function installUint8ArrayFromBase64() {
  if (typeof Uint8Array.fromBase64 === "function") return;
  defineMethod(Uint8Array, "fromBase64", function fromBase64(value, options) {
    let encoded = String(value);
    if (options?.alphabet === "base64url") {
      encoded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    }
    const remainder = encoded.length % 4;
    if (remainder > 0) encoded += "=".repeat(4 - remainder);
    const binary = globalThis.atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  });
}

function installUrlSearchParamsSize() {
  if (
    typeof URLSearchParams === "undefined" ||
    "size" in URLSearchParams.prototype
  ) {
    return;
  }
  Object.defineProperty(URLSearchParams.prototype, "size", {
    configurable: true,
    get() {
      let size = 0;
      this.forEach(() => {
        size += 1;
      });
      return size;
    },
  });
}

function cloneCompatibleValue(value, seen) {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);

  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);
  if (value instanceof ArrayBuffer) return value.slice(0);
  if (ArrayBuffer.isView(value)) {
    const clonedBuffer = value.buffer.slice(
      value.byteOffset,
      value.byteOffset + value.byteLength,
    );
    if (value instanceof DataView) return new DataView(clonedBuffer);
    return new value.constructor(clonedBuffer);
  }

  if (Array.isArray(value)) {
    const clonedArray = [];
    seen.set(value, clonedArray);
    value.forEach((item) => clonedArray.push(cloneCompatibleValue(item, seen)));
    return clonedArray;
  }

  if (value instanceof Map) {
    const clonedMap = new Map();
    seen.set(value, clonedMap);
    value.forEach((item, key) => {
      clonedMap.set(
        cloneCompatibleValue(key, seen),
        cloneCompatibleValue(item, seen),
      );
    });
    return clonedMap;
  }

  if (value instanceof Set) {
    const clonedSet = new Set();
    seen.set(value, clonedSet);
    value.forEach((item) => clonedSet.add(cloneCompatibleValue(item, seen)));
    return clonedSet;
  }

  const prototype = Object.getPrototypeOf(value);
  const clonedObject = Object.create(prototype === null ? null : prototype);
  seen.set(value, clonedObject);
  Object.keys(value).forEach((key) => {
    clonedObject[key] = cloneCompatibleValue(value[key], seen);
  });
  return clonedObject;
}

function installStructuredClone() {
  if (typeof globalThis.structuredClone === "function") return;
  globalThis.structuredClone = (value) =>
    cloneCompatibleValue(value, new WeakMap());
}

function installAbortSignalAny() {
  if (
    typeof AbortSignal === "undefined" ||
    typeof AbortController === "undefined" ||
    typeof AbortSignal.any === "function"
  ) {
    return;
  }

  defineMethod(AbortSignal, "any", function any(signals) {
    const controller = new AbortController();
    const signalList = Array.from(signals || []);
    const abort = (signal) => {
      if (controller.signal.aborted) return;
      if ("reason" in signal) controller.abort(signal.reason);
      else controller.abort();
    };

    for (let index = 0; index < signalList.length; index += 1) {
      const signal = signalList[index];
      if (!signal || typeof signal.addEventListener !== "function") {
        throw new TypeError("AbortSignal.any only accepts AbortSignal values.");
      }
      if (signal.aborted) {
        abort(signal);
        break;
      }
      signal.addEventListener("abort", () => abort(signal), { once: true });
    }
    return controller.signal;
  });
}

export function installPdfCompatibility() {
  if (typeof Promise.withResolvers !== "function") {
    defineMethod(Promise, "withResolvers", function withResolvers() {
      let resolve;
      let reject;
      const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });
      return { promise, resolve, reject };
    });
  }

  if (typeof Promise.try !== "function") {
    defineMethod(Promise, "try", function promiseTry(callback) {
      const args = Array.prototype.slice.call(arguments, 1);
      return new Promise((resolve) => {
        resolve(callback.apply(undefined, args));
      });
    });
  }

  if (typeof Object.hasOwn !== "function") {
    defineMethod(Object, "hasOwn", function hasOwn(value, property) {
      return Object.prototype.hasOwnProperty.call(value, property);
    });
  }

  if (typeof URL.parse !== "function") {
    defineMethod(URL, "parse", function parse(value, base) {
      try {
        return base === undefined ? new URL(value) : new URL(value, base);
      } catch {
        return null;
      }
    });
  }

  installAt(Array.prototype);
  installAt(String.prototype);
  installFindLast();
  installUint8ArrayFromBase64();
  installUrlSearchParamsSize();
  installStructuredClone();
  installAbortSignalAny();
}
