import { useEffect, useMemo, useRef, useState } from "react";

import LicenseModal from "./components/LicenseModal.jsx";
import { readProActivation } from "./lib/license.js";

import {
  locateTextMatches,
  renderFirstPage,
} from "./lib/pdfPreview.js";
import { runPdfTask, serializeFiles } from "./lib/pdfWorkerClient.js";

const tools = [
  {
    id: "merge",
    title: "Merge PDFs",
    shortTitle: "Merge",
    description: "Combine multiple documents in any order",
    icon: "layers",
    pro: false,
  },
  {
    id: "split",
    title: "Split PDF",
    shortTitle: "Split",
    description: "Create new files by page or range",
    icon: "split",
    pro: false,
  },
  {
    id: "rotate",
    title: "Rotate PDF",
    shortTitle: "Rotate",
    description: "Rotate every page or selected pages",
    icon: "rotate",
    pro: false,
  },
  {
    id: "watermark",
    title: "Add Watermark",
    shortTitle: "Watermark",
    description: "Add a local text watermark",
    icon: "watermark",
    pro: true,
  },
  {
    id: "removeWatermark",
    title: "Remove Watermark",
    shortTitle: "Remove",
    description: "Remove text, masks, or overlay layers",
    icon: "eraser",
    pro: true,
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
  if (name === "eraser") {
    return (
      <svg {...common}>
        <path d="m4 15 8.5-8.5a2.1 2.1 0 0 1 3 0l2 2a2.1 2.1 0 0 1 0 3L10 19H6l-2-2a1.4 1.4 0 0 1 0-2Z" />
        <path d="m10 19 4-4M9 10l5 5M14 19h6" />
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
      {failed && <span>Preview unavailable</span>}
      {pageCount && (
        <span className="page-count">
          {pageCount} {pageCount === 1 ? "page" : "pages"}
        </span>
      )}
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
          <strong>{multiple ? "Select PDF files" : "Select a PDF file"}</strong>
          <small>or drag and drop here · Files never leave your device</small>
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
              aria-label="Move file up"
              disabled={index === 0}
              onClick={() => onMove(index, -1)}
            >
              <Icon name="arrowUp" size={18} />
            </button>
            <button
              className="move-down"
              type="button"
              aria-label="Move file down"
              disabled={index === total - 1}
              onClick={() => onMove(index, 1)}
            >
              <Icon name="arrowUp" size={18} />
            </button>
          </>
        )}
        <button
          type="button"
          aria-label="Remove file"
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
          label="Split ranges"
          hint="Leave blank to create one PDF per page. Each comma-separated range creates one file."
        >
          <input
            value={options.ranges}
            onChange={update("ranges")}
            placeholder="Example: 1-3, 4-6, 9"
          />
        </Field>
      </div>
    );
  }

  if (tool === "rotate") {
    return (
      <div className="options-grid">
        <Field label="Page range" hint="Leave blank to process every page.">
          <input
            value={options.ranges}
            onChange={update("ranges")}
            placeholder="Example: 1-3, 7"
          />
        </Field>
        <Field label="Rotation angle">
          <select
            value={options.rotationAngle}
            onChange={update("rotationAngle")}
          >
            <option value="90">90° clockwise</option>
            <option value="180">180°</option>
            <option value="270">90° counterclockwise</option>
          </select>
        </Field>
      </div>
    );
  }

  if (tool === "watermark") {
    return (
      <div className="options-grid watermark-options">
        <Field label="Watermark text">
          <input
            value={options.text}
            onChange={update("text")}
            placeholder="Example: CONFIDENTIAL"
          />
        </Field>
        <Field label="Page range" hint="Leave blank to process every page.">
          <input
            value={options.ranges}
            onChange={update("ranges")}
            placeholder="Example: 1-5, 8"
          />
        </Field>
        <Field label="Placement">
          <select value={options.placement} onChange={update("placement")}>
            <option value="center">Center</option>
            <option value="tile">Tiled</option>
            <option value="footer">Footer</option>
          </select>
        </Field>
        <Field label={"Font size · " + options.size + "px"}>
          <input
            type="range"
            min="12"
            max="96"
            step="2"
            value={options.size}
            onChange={update("size")}
          />
        </Field>
        <Field label={"Angle · " + options.watermarkAngle + "°"}>
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
            "Opacity · " + Math.round(Number(options.opacity) * 100) + "%"
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
        <Field label="Color">
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

  if (tool === "removeWatermark") {
    return (
      <div className="options-grid remove-options">
        <div className="remove-mode span-all">
          <span>Removal method</span>
          <div className="mode-toggle" role="group" aria-label="Watermark removal method">
            <button
              type="button"
              disabled={options.removeTransparentOverlay}
              className={options.removalMode === "text" ? "active" : ""}
              onClick={() =>
                setOptions((current) => ({
                  ...current,
                  removalMode: "text",
                }))
              }
            >
              Text Match
            </button>
            <button
              type="button"
              disabled={options.removeTransparentOverlay}
              className={options.removalMode === "rectangle" ? "active" : ""}
              onClick={() =>
                setOptions((current) => ({
                  ...current,
                  removalMode: "rectangle",
                }))
              }
            >
              Rectangle Mask
            </button>
          </div>
          <small>
            {options.removeTransparentOverlay
              ? "Only independent Form XObjects or objects drawn with transparent graphics states are removed."
              : "Text Match uses PDF.js to locate selectable text. Use Rectangle Mask for scans or outlined text."}
          </small>
        </div>

        <label
          className={
            "overlay-toggle span-all" +
            (options.removeTransparentOverlay ? " active" : "")
          }
        >
          <input
            type="checkbox"
            checked={options.removeTransparentOverlay}
            onChange={(event) =>
              setOptions((current) => ({
                ...current,
                removeTransparentOverlay: event.target.checked,
              }))
            }
          />
          <span>
            <strong>Remove Transparent Overlay</strong>
            <small>
              Removes vector watermarks stored as independent Forms,
              transparent XObjects, or ExtGState overlays.
            </small>
          </span>
        </label>

        <Field label="Page range" hint="Leave blank to process every page.">
          <input
            value={options.ranges}
            onChange={update("ranges")}
            placeholder="Example: 1-5, 8"
          />
        </Field>

        {!options.removeTransparentOverlay &&
          (options.removalMode === "text" ? (
            <>
            <Field
              label="Watermark keyword"
              hint="Matches across case differences, extra spaces, and split text fragments."
            >
              <input
                value={options.removeKeyword}
                onChange={update("removeKeyword")}
                placeholder="Example: CONFIDENTIAL"
              />
            </Field>
            <Field label={"Match padding · " + options.matchPadding + " pt"}>
              <input
                type="range"
                min="0"
                max="12"
                step="1"
                value={options.matchPadding}
                onChange={update("matchPadding")}
              />
            </Field>
            </>
          ) : (
            <>
            <Field label="Mask area">
              <select
                value={options.maskPreset}
                onChange={update("maskPreset")}
              >
                <option value="header">Header</option>
                <option value="footer">Footer</option>
                <option value="custom">Custom rectangle</option>
              </select>
            </Field>
            {options.maskPreset !== "custom" ? (
              <Field
                label={
                  (options.maskPreset === "header" ? "Top" : "Bottom") +
                  " mask height · pt"
                }
                hint="A common PDF page is approximately 595 × 842 pt."
              >
                <input
                  type="number"
                  min="1"
                  value={options.maskMargin}
                  onChange={update("maskMargin")}
                />
              </Field>
            ) : (
              <div className="rectangle-grid span-all">
                <Field label="X coordinate">
                  <input
                    type="number"
                    min="0"
                    value={options.rectX}
                    onChange={update("rectX")}
                  />
                </Field>
                <Field label="Y coordinate">
                  <input
                    type="number"
                    min="0"
                    value={options.rectY}
                    onChange={update("rectY")}
                  />
                </Field>
                <Field label="Width">
                  <input
                    type="number"
                    min="1"
                    value={options.rectWidth}
                    onChange={update("rectWidth")}
                  />
                </Field>
                <Field label="Height">
                  <input
                    type="number"
                    min="1"
                    value={options.rectHeight}
                    onChange={update("rectHeight")}
                  />
                </Field>
                <small className="coordinate-hint">
                  Values use PDF points; the origin is at the bottom-left.
                </small>
              </div>
            )}
            </>
          ))}
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
            <strong>Processing complete</strong>
            <small>
              {results.length === 1
                ? "Your file is ready to download"
                : "Generated " + results.length + " files"}
            </small>
          </div>
        </div>
        <button type="button" onClick={onClear}>Clear results</button>
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
  removalMode: "text",
  removeTransparentOverlay: false,
  removeKeyword: "CONFIDENTIAL",
  matchPadding: "3",
  maskPreset: "header",
  maskMargin: "72",
  rectX: "0",
  rectY: "0",
  rectWidth: "595",
  rectHeight: "72",
};

function Workspace({ tool, isProActivated, onRequirePro }) {
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
    const fileList = Array.from(newFiles || []);
    setFiles((current) => (multiple ? current.concat(fileList) : fileList));
  };

  const moveFile = (index, offset) => {
    setFiles((current) => {
      const next = current.slice();
      const [file] = next.splice(index, 1);
      next.splice(index + offset, 0, file);
      return next;
    });
  };

  const hasRequiredKeyword =
    tool !== "removeWatermark" ||
    options.removeTransparentOverlay ||
    options.removalMode !== "text" ||
    options.removeKeyword.trim().length > 0;
  const canProcess =
    (multiple ? files.length >= 2 : files.length === 1) &&
    hasRequiredKeyword;

  const processFiles = async () => {
    const requiresPro =
      toolInfo.pro || (files.length > 1 && tool !== "merge");
    if (requiresPro && !isProActivated) {
      setError(
        "This feature requires DocuFold Pro. Activate a license to continue.",
      );
      onRequirePro();
      return;
    }

    setProcessing(true);
    setError("");
    clearResults();
    try {
      const matches =
        tool === "removeWatermark" &&
        options.removalMode === "text" &&
        !options.removeTransparentOverlay
          ? await locateTextMatches(
              files[0],
              options.removeKeyword,
              options.ranges,
            )
          : [];
      const serialized = await serializeFiles(files);
      const operationOptions =
        tool === "rotate"
          ? { angle: options.rotationAngle }
          : tool === "watermark"
            ? { angle: options.watermarkAngle }
            : {};
      const payload =
        tool === "merge"
          ? { files: serialized }
          : {
              file: serialized[0],
              ...options,
              ...operationOptions,
              matches,
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
          : "PDF processing failed. Try again.",
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <main className="workspace">
      <section className="workspace-heading">
        <div className="eyebrow"><span /> LOCAL PDF WORKSPACE</div>
        <h1>{toolInfo.title}</h1>
        <p>{toolInfo.description}. Everything is processed in this browser.</p>
        <p className="hero-promise">
          100% Client-Side &amp; Private PDF Tools. Your files never touch any server.
        </p>
      </section>

      <section className="work-card">
        <FileDrop multiple={multiple} onFiles={addFiles} />

        {files.length > 0 && (
          <div className="files-section">
            <div className="section-label">
              <span>
                {files.length} {files.length === 1 ? "file" : "files"} selected
              </span>
              <button
                type="button"
                onClick={() => {
                  setFiles([]);
                  clearResults();
                }}
              >
                Clear all
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
            <Icon name="shield" size={18} /> No uploads · No accounts · No servers
          </div>
          <button
            className="process-button"
            type="button"
            disabled={!canProcess || processing}
            onClick={processFiles}
          >
            {processing ? (
              <>
                <span className="spinner" /> Processing locally…
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
  const [isProActivated, setIsProActivated] = useState(readProActivation);
  const [licenseModalOpen, setLicenseModalOpen] = useState(false);

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
        <nav aria-label="PDF tools">
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
        <div className="topbar-actions">
          <div className="local-badge"><span /> Local only</div>
          <button
            className={
              "pro-cta" + (isProActivated ? " activated" : "")
            }
            type="button"
            onClick={() => setLicenseModalOpen(true)}
          >
            {isProActivated ? "Pro Activated" : "Activate Pro"}
          </button>
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <p>PDF TOOLS</p>
          {tools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={activeTool === tool.id ? "active" : ""}
              onClick={() => selectTool(tool.id)}
            >
              <span className="tool-icon"><Icon name={tool.icon} /></span>
              <span>
                <span className="tool-title-row">
                  <strong>{tool.title}</strong>
                  {tool.pro && <span className="pro-tag">PRO</span>}
                </span>
                <small>{tool.description}</small>
              </span>
              <span className="tool-arrow">→</span>
            </button>
          ))}
          <div className="sidebar-privacy">
            <Icon name="shield" size={25} />
            <strong>Privacy first</strong>
            <p>
              Files stay in browser memory and are cleared when you refresh
              this page.
            </p>
          </div>
        </aside>

        <Workspace
          key={activeTool}
          tool={activeTool}
          isProActivated={isProActivated}
          onRequirePro={() => setLicenseModalOpen(true)}
        />
      </div>

      <footer>
        <span>DocuFold · Private browser-based PDF tools</span>
        <span>Powered by pdf-lib &amp; PDF.js</span>
      </footer>

      <LicenseModal
        isOpen={licenseModalOpen}
        isActivated={isProActivated}
        onActivated={() => setIsProActivated(true)}
        onClose={() => setLicenseModalOpen(false)}
      />
    </div>
  );
}

export default App;
