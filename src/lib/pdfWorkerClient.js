const pendingTasks = new Map();
let nextTaskId = 1;
let pdfWorker;

function rejectPendingTasks(error) {
  pendingTasks.forEach((task) => {
    clearTimeout(task.timeoutId);
    task.reject(error);
  });
  pendingTasks.clear();
}

function stopWorker(error) {
  const workerToStop = pdfWorker;
  pdfWorker = undefined;
  if (workerToStop && typeof workerToStop.terminate === "function") {
    workerToStop.terminate();
  }
  if (error) rejectPendingTasks(error);
}

function handleWorkerMessage({ data }) {
  if (!data || typeof data.id !== "number") return;
  const task = pendingTasks.get(data.id);
  if (!task) return;

  pendingTasks.delete(data.id);
  clearTimeout(task.timeoutId);
  if (data.error) {
    task.reject(new Error(String(data.error)));
    return;
  }
  if (!Array.isArray(data.result)) {
    task.reject(new Error("PDF 处理线程返回了无效结果，请重试。"));
    return;
  }
  task.resolve(data.result);
}

function createPdfWorker() {
  if (pdfWorker) return pdfWorker;
  if (typeof Worker !== "function") {
    throw new Error("当前浏览器不支持 PDF 本地处理线程，请升级浏览器后重试。");
  }

  try {
    const candidate = new Worker(
      new URL("../workers/pdf.worker.js", import.meta.url),
      { type: "module" },
    );
    pdfWorker = candidate;
    candidate.addEventListener("message", handleWorkerMessage);
    candidate.addEventListener("error", (event) => {
      if (typeof event.preventDefault === "function") event.preventDefault();
      const detail = event.message ? "：" + event.message : "";
      stopWorker(
        new Error("PDF 处理线程加载失败" + detail + "，请刷新后重试。"),
      );
    });
    candidate.addEventListener("messageerror", () => {
      stopWorker(new Error("浏览器无法读取 PDF 处理结果，请刷新后重试。"));
    });
    return candidate;
  } catch (error) {
    pdfWorker = undefined;
    const detail = error instanceof Error ? error.message : "未知错误";
    throw new Error("PDF 处理线程无法启动：" + detail);
  }
}

export function runPdfTask(action, payload) {
  const id = nextTaskId++;
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = createPdfWorker();
    } catch (error) {
      reject(error);
      return;
    }

    const timeoutId = setTimeout(() => {
      pendingTasks.delete(id);
      reject(new Error("PDF 处理超时，请减小文件大小或刷新后重试。"));
    }, 120000);
    pendingTasks.set(id, { resolve, reject, timeoutId });

    try {
      worker.postMessage({ id, action, payload });
    } catch (error) {
      clearTimeout(timeoutId);
      pendingTasks.delete(id);
      const detail = error instanceof Error ? error.message : "未知错误";
      reject(new Error("无法向 PDF 处理线程发送文件：" + detail));
    }
  });
}

export async function serializeFiles(files) {
  const fileList = Array.from(files || []);
  return Promise.all(
    fileList.map(async (file) => {
      if (!file || typeof file.arrayBuffer !== "function") {
        throw new Error("无法读取所选 PDF 文件，请重新选择文件。");
      }
      return {
        name: typeof file.name === "string" ? file.name : "document.pdf",
        data: await file.arrayBuffer(),
      };
    }),
  );
}
