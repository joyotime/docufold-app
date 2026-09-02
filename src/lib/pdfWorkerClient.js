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
    task.reject(new Error("The PDF worker returned an invalid result. Try again."));
    return;
  }
  task.resolve(data.result);
}

function createPdfWorker() {
  if (pdfWorker) return pdfWorker;
  if (typeof Worker !== "function") {
    throw new Error("This browser does not support local PDF workers. Update your browser and try again.");
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
      const detail = event.message ? ": " + event.message : "";
      stopWorker(
        new Error("The PDF worker failed to load" + detail + ". Refresh and try again."),
      );
    });
    candidate.addEventListener("messageerror", () => {
      stopWorker(new Error("The browser could not read the PDF result. Refresh and try again."));
    });
    return candidate;
  } catch (error) {
    pdfWorker = undefined;
    const detail = error instanceof Error ? error.message : "Unknown error";
    throw new Error("The PDF worker could not start: " + detail);
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
      reject(new Error("PDF processing timed out. Use a smaller file or refresh and try again."));
    }, 120000);
    pendingTasks.set(id, { resolve, reject, timeoutId });

    try {
      worker.postMessage({ id, action, payload });
    } catch (error) {
      clearTimeout(timeoutId);
      pendingTasks.delete(id);
      const detail = error instanceof Error ? error.message : "Unknown error";
      reject(new Error("The file could not be sent to the PDF worker: " + detail));
    }
  });
}

export async function serializeFiles(files) {
  const fileList = Array.from(files || []);
  return Promise.all(
    fileList.map(async (file) => {
      if (!file || typeof file.arrayBuffer !== "function") {
        throw new Error("The selected PDF could not be read. Select the file again.");
      }
      return {
        name: typeof file.name === "string" ? file.name : "document.pdf",
        data: await file.arrayBuffer(),
      };
    }),
  );
}
