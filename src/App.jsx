import { useEffect, useMemo, useRef, useState } from "react";

import { renderFirstPage } from "./lib/pdfPreview.js";
import { runPdfTask, serializeFiles } from "./lib/pdfWorkerClient.js";

const tools = [
  {
    id: "merge",
    title: "合并 PDF",
    shortTitle: "合并",
    description: "按顺序组合多个文档",
    icon: "layers",
  },
  {
    id: "split",
    title: "拆分 PDF",
    shortTitle: "拆分",
    description: "按页或范围生成新文件",
    icon: "split",
  },
  {
    id: "rotate",
    title: "旋转 PDF",
    shortTitle: "旋转",
    description: "旋转全部或指定页面",
    icon: "rotate",
  },
  {
    id: "watermark",
    title: "添加水印",
    shortTitle: "水印",
    description: "添加本地文字水印",
    icon: "watermark",
  },
];

function Icon({ name, size = 22 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  if (name === "layers") {
    return (
      <svg {...common}>
        <path d="m12 3-9 5 9 5 9-5-9-5Z" />
        <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
      </svg>
    );
  }
  if (name === "split") {
    return (
      <svg {...common}>
        <path d="M8 3v4c0 2.8 1.4 4.2 4 5-2.6.8-4 2.2-4 5v4" />
        <path d="M16 3v4c0 2.8-1.4 4.2-4 5 2.6.8 4 2.2 4 5v4" />
      </svg>
    );
  }
  if (name === "rotate") {
    return (
      <svg {...common}>
        <path d="M20 7v5h-5" />
        <path d="M19 12a7.5 7.5 0 1 1-2.2-5.3L20 9" />
      </svg>
    );
  }
  if (name === "watermark") {
    return (
      <svg {...common}>
        <path d="M5 4h14v16H5z" />
        <path d="m8 15 3-7 2 5 1.5-3L17 15" />
      </svg>
    );
  }
  if (name === "upload") {
    return (
      <svg {...common}>
        <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
        <path d="M5 14v5h14v-5" />
      </svg>
    );
  }
  if (name === "shield") {
    return (
      <svg {...common}>
        <path d="M12 3 5 6v5c0 4.8 2.8 8.2 7 10 4.2-1.8 7-5.2 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }
  if (name === "download") {
    return (
      <svg {...common}>
        <path d="M12 4v11m0 0 4-4m-4 4-4-4" />
        <path d="M5 19h14" />
      </svg>
    );
  }
  if (name === "trash") {
    return (
      <svg {...common}>
        <path d="M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6m4-6v6" />
      </svg>
    );
  }
  if (name === "arrowUp") {
    return (
      <svg {...common}>
        <path d="m7 14 5-5 5 5" />
      </svg>
    );
  }
  return null;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

function acceptedPdfFiles(fileList) {
  return Array.from(fileList).filter(
    (file) =>
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf"),
  );
}

function PdfThumbnail({ file }) {
  const canvasRef = useRef(null);
  const [pageCount, setPageCount] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    renderFirstPage(file, canvas)
      .then((count) => {
        if (!cancelled) setPageCount(count);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [file]);

  return (
    <div className="thumbnail">
      {!failed && <canvas ref={canvasRef} />}
      {failed && <span>无法预览</span>}
      {pageCount && <span className="page-count">{pageCount} 页</span>}
    </div>
  );
}

function FileDrop({ multiple, onFiles }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const receiveFiles = (files) => {
    const accepted = acceptedPdfFiles(files);
    if (accepted.length > 0) {
      onFiles(multiple ? accepted : accepted.slice(0, 1));
    }
  };

  return (
    <div
      className={"drop-zone " + (dragging ? "is-dragging" : "")}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setDragging(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        receiveFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple={multiple}
        onChange={(event) => {
          receiveFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <button
        className="drop-action"
        type="button"
        onClick={() => inputRef.current?.click()}
      >
        <span className="upload-icon">
          <Icon name="upload" size={28} />
        </span>
        <span>
          <strong>{multiple ? "选择 PDF 文件" : "选择一个 PDF 文件"}</strong>
          <small>或拖放到这里 · 文件不会离开你的设备</small>
        </span>
      </button>
    </div>
  );
}

function FileCard({ file, index, total, onRemove, onMove }) {
  return (
    <article className="file-card">
      <PdfThumbnail file={file} />
      <div className="file-details">
        <div className="file-order">
          {String(index + 1).padStart(2, "0")}
        </div>
        <div className="file-copy">
          <strong title={file.name}>{file.name}</strong>
          <span>{formatBytes(file.size)}</span>
        </div>
      </div>
      <div className="file-actions">
        {total > 1 && (
          <>
            <button
              type="button"
              aria-label="上移文件"
              disabled={index === 0}
              onClick={() => onMove(index, -1)}
            >
              <Icon name="arrowUp" size={18} />
            </button>
            <button
              className="move-down"
              type="button"
              aria-label="下移文件"
              disabled={index === total - 1}
              onClick={() => onMove(index, 1)}
            >
              <Icon name="arrowUp" size={18} />
            </button>
          </>
        )}
        <button
          type="button"
          aria-label="移除文件"
          onClick={() => onRemove(index)}
        >
          <Icon name="trash" size={17} />
        </button>
      </div>
    </article>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function ToolOptions({ tool, options, setOptions }) {
  const update = (key) => (event) => {
    setOptions((current) => ({ ...current, [key]: event.target.value }));
  };

  if (tool === "split") {
    return (
      <div className="options-grid one-column">
        <Field
          label="拆分范围"
          hint="留空时每一页生成一个文件；逗号分隔的每段生成一个 PDF。"
        >
          <input
            value={options.ranges}
            onChange={update("ranges")}
            placeholder="例如：1-3, 4-6, 9"
          />
        </Field>
      </div>
    );
  }

  if (tool === "rotate") {
    return (
      <div className="options-grid">
        <Field label="页面范围" hint="留空表示全部页面。">
          <input
            value={options.ranges}
            onChange={update("ranges")}
            placeholder="例如：1-3, 7"
          />
        </Field>
        <Field label="旋转角度">
          <select
            value={options.rotationAngle}
            onChange={update("rotationAngle")}
          >
            <option value="90">顺时针 90°</option>
            <option value="180">旋转 180°</option>
            <option value="270">逆时针 90°</option>
          </select>
        </Field>
      </div>
    );
  }

  if (tool === "watermark") {
    return (
      <div className="options-grid watermark-options">
        <Field label="水印文字">
          <input
            value={options.text}
            onChange={update("text")}
            placeholder="例如：CONFIDENTIAL"
          />
        </Field>
        <Field label="页面范围" hint="留空表示全部页面。">
          <input
            value={options.ranges}
            onChange={update("ranges")}
            placeholder="例如：1-5, 8"
          />
        </Field>
        <Field label="布局">
          <select value={options.placement} onChange={update("placement")}>
            <option value="center">居中</option>
            <option value="tile">平铺</option>
            <option value="footer">页脚</option>
          </select>
        </Field>
        <Field label={"字号 · " + options.size + "px"}>
          <input
            type="range"
            min="12"
            max="96"
            step="2"
            value={options.size}
            onChange={update("size")}
          />
        </Field>
        <Field label={"角度 · " + options.watermarkAngle + "°"}>
          <input
            type="range"
            min="-90"
            max="90"
            step="5"
            value={options.watermarkAngle}
            onChange={update("watermarkAngle")}
          />
        </Field>
        <Field
          label={
            "透明度 · " + Math.round(Number(options.opacity) * 100) + "%"
          }
        >
          <input
            type="range"
            min="0.05"
            max="0.8"
            step="0.05"
            value={options.opacity}
            onChange={update("opacity")}
          />
        </Field>
        <Field label="颜色">
          <span className="color-control">
            <input
              type="color"
              value={options.color}
              onChange={update("color")}
            />
            <code>{options.color.toUpperCase()}</code>
          </span>
        </Field>
      </div>
    );
  }

  return null;
}

function Results({ results, onClear }) {
  useEffect(() => {
    return () => {
      results.forEach((result) => URL.revokeObjectURL(result.url));
    };
  }, [results]);

  if (results.length === 0) return null;

  return (
    <section className="results" aria-live="polite">
      <div className="results-heading">
        <div>
          <span className="success-mark">✓</span>
          <div>
            <strong>处理完成</strong>
            <small>
              {results.length === 1
                ? "文件已准备好下载"
                : "已生成 " + results.length + " 个文件"}
            </small>
          </div>
        </div>
        <button type="button" onClick={onClear}>清除结果</button>
      </div>
      <div className="result-list">
        {results.map((result) => (
          <a key={result.url} href={result.url} download={result.name}>
            <span>
              <strong>{result.name}</strong>
              <small>{formatBytes(result.size)}</small>
            </span>
            <Icon name="download" size={20} />
          </a>
        ))}
      </div>
    </section>
  );
}

const defaultOptions = {
  ranges: "",
  rotationAngle: "90",
  watermarkAngle: "-30",
  text: "CONFIDENTIAL",
  size: "42",
  opacity: "0.2",
  color: "#1f4138",
  placement: "center",
};

function Workspace({ tool }) {
  const toolInfo = tools.find((item) => item.id === tool);
  const [files, setFiles] = useState([]);
  const [options, setOptions] = useState(defaultOptions);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const multiple = tool === "merge";

  const clearResults = () => {
    results.forEach((result) => URL.revokeObjectURL(result.url));
    setResults([]);
  };

  const addFiles = (newFiles) => {
    clearResults();
    setError("");
    setFiles((current) => (multiple ? [...current, ...newFiles] : newFiles));
  };

  const moveFile = (index, offset) => {
    setFiles((current) => {
      const next = [...current];
      const [file] = next.splice(index, 1);
      next.splice(index + offset, 0, file);
      return next;
    });
  };

  const canProcess = multiple ? files.length >= 2 : files.length === 1;

  const processFiles = async () => {
    setProcessing(true);
    setError("");
    clearResults();
    try {
      const serialized = await serializeFiles(files);
      const payload =
        tool === "merge"
          ? { files: serialized }
          : {
              file: serialized[0],
              ...options,
              angle:
                tool === "rotate"
                  ? options.rotationAngle
                  : options.watermarkAngle,
            };
      const outputFiles = await runPdfTask(tool, payload);
      setResults(
        outputFiles.map(({ name, bytes }) => {
          const blob = new Blob([bytes], { type: "application/pdf" });
          return {
            name,
            size: blob.size,
            url: URL.createObjectURL(blob),
          };
        }),
      );
    } catch (taskError) {
      setError(
        taskError instanceof Error
          ? taskError.message
          : "PDF 处理失败，请重试。",
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <main className="workspace">
      <section className="workspace-heading">
        <div className="eyebrow"><span /> 本地 PDF 工作台</div>
        <h1>{toolInfo.title}</h1>
        <p>{toolInfo.description}，处理全程只发生在当前浏览器中。</p>
      </section>

      <section className="work-card">
        <FileDrop multiple={multiple} onFiles={addFiles} />

        {files.length > 0 && (
          <div className="files-section">
            <div className="section-label">
              <span>已选择 {files.length} 个文件</span>
              <button
                type="button"
                onClick={() => {
                  setFiles([]);
                  clearResults();
                }}
              >
                全部清除
              </button>
            </div>
            <div
              className={"file-grid " + (files.length === 1 ? "single" : "")}
            >
              {files.map((file, index) => (
                <FileCard
                  key={
                    file.name +
                    "-" +
                    file.lastModified +
                    "-" +
                    index
                  }
                  file={file}
                  index={index}
                  total={files.length}
                  onMove={moveFile}
                  onRemove={(fileIndex) => {
                    setFiles((current) =>
                      current.filter(
                        (_, itemIndex) => itemIndex !== fileIndex,
                      ),
                    );
                    clearResults();
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {files.length > 0 && (
          <ToolOptions
            tool={tool}
            options={options}
            setOptions={setOptions}
          />
        )}

        {error && (
          <div className="error-message" role="alert">{error}</div>
        )}

        <div className="process-row">
          <div className="privacy-note">
            <Icon name="shield" size={18} /> 无上传 · 无账号 · 无服务器
          </div>
          <button
            className="process-button"
            type="button"
            disabled={!canProcess || processing}
            onClick={processFiles}
          >
            {processing ? (
              <>
                <span className="spinner" /> 正在本地处理…
              </>
            ) : (
              toolInfo.title
            )}
          </button>
        </div>
      </section>

      <Results results={results} onClear={clearResults} />
    </main>
  );
}

function App() {
  const initialTool = useMemo(() => {
    const hash = window.location.hash.slice(1);
    return tools.some((tool) => tool.id === hash) ? hash : "merge";
  }, []);
  const [activeTool, setActiveTool] = useState(initialTool);

  useEffect(() => {
    const syncTool = () => {
      const hash = window.location.hash.slice(1);
      if (tools.some((tool) => tool.id === hash)) setActiveTool(hash);
    };
    window.addEventListener("hashchange", syncTool);
    return () => window.removeEventListener("hashchange", syncTool);
  }, []);

  const selectTool = (tool) => {
    setActiveTool(tool);
    window.history.replaceState(null, "", "#" + tool);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#merge"
          onClick={() => selectTool("merge")}
        >
          <span className="brand-mark"><span /><span /><span /></span>
          <span>DocuFold</span>
        </a>
        <nav aria-label="PDF 工具">
          {tools.map((tool) => (
            <a
              key={tool.id}
              className={activeTool === tool.id ? "active" : ""}
              href={"#" + tool.id}
              onClick={() => selectTool(tool.id)}
            >
              {tool.shortTitle}
            </a>
          ))}
        </nav>
        <div className="local-badge"><span /> 100% 本地处理</div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <p>PDF 工具</p>
          {tools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={activeTool === tool.id ? "active" : ""}
              onClick={() => selectTool(tool.id)}
            >
              <span className="tool-icon"><Icon name={tool.icon} /></span>
              <span>
                <strong>{tool.title}</strong>
                <small>{tool.description}</small>
              </span>
              <span className="tool-arrow">→</span>
            </button>
          ))}
          <div className="sidebar-privacy">
            <Icon name="shield" size={25} />
            <strong>隐私优先</strong>
            <p>文件只保存在浏览器内存中，刷新页面后自动清除。</p>
          </div>
        </aside>

        <Workspace key={activeTool} tool={activeTool} />
      </div>

      <footer>
        <span>DocuFold · 浏览器本地 PDF 工具</span>
        <span>Powered by pdf-lib &amp; PDF.js</span>
      </footer>
    </div>
  );
}

export default App;
