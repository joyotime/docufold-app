const worker = new Worker(new URL("../workers/pdf.worker.js", import.meta.url), {
  type: "module",
});

const pendingTasks = new Map();
let nextTaskId = 1;

worker.addEventListener("message", ({ data }) => {
  const task = pendingTasks.get(data.id);
  if (!task) return;

  pendingTasks.delete(data.id);
  if (data.error) {
    task.reject(new Error(data.error));
    return;
  }

  task.resolve(data.result);
});

worker.addEventListener("error", (event) => {
  const error = new Error(event.message || "PDF 处理线程意外停止。");
  pendingTasks.forEach(({ reject }) => reject(error));
  pendingTasks.clear();
});

export function runPdfTask(action, payload) {
  const id = nextTaskId++;
  return new Promise((resolve, reject) => {
    pendingTasks.set(id, { resolve, reject });
    worker.postMessage({ id, action, payload });
  });
}

export async function serializeFiles(files) {
  return Promise.all(
    files.map(async (file) => ({
      name: file.name,
      data: await file.arrayBuffer(),
    })),
  );
}
