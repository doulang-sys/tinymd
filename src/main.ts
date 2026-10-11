import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import "katex/dist/katex.min.css";
import { renderMarkdown, type Heading } from "./renderer";
import { renderTree, setActiveTreeItem } from "./tree";
import { renderToc } from "./toc";
import { openQuickOpen } from "./quickopen";

const DIR_KEY = "tinymd.lastDir";
const FILE_KEY = "tinymd.lastFile";
const THEME_KEY = "tinymd.theme";
const FONT_KEY = "tinymd.fontSize";
const FONT_MIN = 12;
const FONT_MAX = 24;
const FONT_DEFAULT = 15;

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
};

const state = {
  rootDir: "",
  currentFile: "",
  headings: [] as Heading[],
};

function el(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

function dirname(p: string): string {
  return p.replace(/[\\/][^\\/]*$/, "");
}

function basename(p: string): string {
  return p.replace(/^.*[\\/]/, "");
}

function joinPath(dir: string, relPath: string): string {
  const clean = decodeURIComponent(relPath.split(/[?#]/)[0]).replace(/^\.\//, "");
  return dir + "\\" + clean.replace(/\//g, "\\");
}

function applyTheme(theme: string): void {
  const root = document.documentElement;
  if (theme === "auto") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
  el("btn-theme").textContent =
    theme === "auto" ? "自动" : theme === "light" ? "浅色" : "深色";
}

function cycleTheme(): string {
  const cur = localStorage.getItem(THEME_KEY) || "auto";
  const next = cur === "auto" ? "light" : cur === "light" ? "dark" : "auto";
  localStorage.setItem(THEME_KEY, next);
  return next;
}

function currentFontSize(): number {
  const raw = localStorage.getItem(FONT_KEY);
  const v = raw === null ? NaN : Number(raw);
  if (!Number.isFinite(v) || v < FONT_MIN || v > FONT_MAX) {
    return FONT_DEFAULT;
  }
  return v;
}

function applyFontSize(px: number): void {
  document.documentElement.style.setProperty("--content-font-size", `${px}px`);
}

function changeFont(delta: number): void {
  const next = Math.min(FONT_MAX, Math.max(FONT_MIN, currentFontSize() + delta));
  localStorage.setItem(FONT_KEY, String(next));
  applyFontSize(next);
}

function resetFont(): void {
  localStorage.setItem(FONT_KEY, String(FONT_DEFAULT));
  applyFontSize(FONT_DEFAULT);
}

function showDocument(markdown: string, fileDir: string, name: string, path: string | null): void {
  const { html, headings } = renderMarkdown(markdown);
  const view = el("md-view");
  view.innerHTML = html;
  state.headings = headings;
  renderToc(el("toc"), headings, el("content"));
  el("content").scrollTop = 0;
  el("empty-state").hidden = true;
  view.hidden = false;
  if (path) {
    state.currentFile = path;
    localStorage.setItem(FILE_KEY, path);
    setActiveTreeItem(el("tree"), path);
  }
  document.title = `${name} - tinymd`;
  void fixImages(view, fileDir);
}

async function selectFile(path: string): Promise<void> {
  let text: string;
  try {
    text = await invoke<string>("read_file_text", { path });
  } catch (err) {
    console.error("read_file_text failed:", err);
    return;
  }
  showDocument(text, dirname(path), basename(path), path);
}

async function openDir(path: string): Promise<void> {
  state.rootDir = path;
  localStorage.setItem(DIR_KEY, path);
  el("dir-label").textContent = path;
  renderTree(el("tree"), path, state.currentFile, (p) => void selectFile(p));
  const lastFile = localStorage.getItem(FILE_KEY) || "";
  if (lastFile.startsWith(path) && isTauri()) {
    const ok = await invoke<boolean>("file_exists", { path: lastFile });
    if (ok) {
      await selectFile(lastFile);
      return;
    }
  }
  el("empty-state").hidden = false;
  el("md-view").hidden = true;
}

async function openDirDialog(): Promise<void> {
  if (!isTauri()) {
    (el("file-input") as HTMLInputElement).click();
    return;
  }
  const selected = await open({ directory: true, multiple: false, title: "选择 Markdown 目录" });
  if (typeof selected === "string") {
    await openDir(selected);
  }
}

async function fixImages(container: HTMLElement, fileDir: string): Promise<void> {
  if (!isTauri()) {
    return;
  }
  const imgs = Array.from(container.querySelectorAll("img"));
  for (const img of imgs) {
    const src = img.getAttribute("src") || "";
    if (/^(https?:|data:|blob:)/i.test(src) || src.startsWith("#")) {
      continue;
    }
    const abs = joinPath(fileDir, src);
    try {
      const b64 = await invoke<string>("read_file_base64", { path: abs });
      const ext = abs.toLowerCase().split(".").pop() || "";
      img.src = `data:${MIME[ext] || "application/octet-stream"};base64,${b64}`;
    } catch {
      img.classList.add("img-broken");
      img.alt = "（图片加载失败）";
    }
  }
}

function onDocClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  const a = target.closest("a");
  if (!a) {
    return;
  }
  const href = a.getAttribute("href") || "";
  if (/^https?:\/\//i.test(href)) {
    e.preventDefault();
    if (isTauri()) {
      void openUrl(href);
    }
  } else if (href.startsWith("#")) {
    e.preventDefault();
    document
      .getElementById(decodeURIComponent(href.slice(1)))
      ?.scrollIntoView({ behavior: "smooth" });
  } else if (
    isTauri() &&
    state.currentFile &&
    /\.(md|markdown)$/i.test(href.split(/[?#]/)[0])
  ) {
    e.preventDefault();
    const targetPath = joinPath(dirname(state.currentFile), href);
    void invoke<boolean>("file_exists", { path: targetPath }).then((ok) => {
      if (ok) {
        void selectFile(targetPath);
      }
    });
  }
}

function onFilePicked(): void {
  const input = el("file-input") as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => showDocument(String(reader.result), "", file.name, null);
  reader.readAsText(file);
  input.value = "";
}

function onKeyDown(e: KeyboardEvent): void {
  if (!el("quickopen").hidden) {
    return;
  }
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (mod && key === "o") {
    e.preventDefault();
    void openDirDialog();
  } else if (mod && key === "p" && state.rootDir) {
    e.preventDefault();
    openQuickOpen(state.rootDir, (p) => void selectFile(p));
  } else if (mod && (e.key === "=" || e.key === "+")) {
    e.preventDefault();
    changeFont(1);
  } else if (mod && e.key === "-") {
    e.preventDefault();
    changeFont(-1);
  } else if (mod && e.key === "0") {
    e.preventDefault();
    resetFont();
  }
}

function init(): void {
  applyTheme(localStorage.getItem(THEME_KEY) || "auto");
  applyFontSize(currentFontSize());

  el("btn-open").addEventListener("click", () => void openDirDialog());
  el("btn-font-down").addEventListener("click", () => changeFont(-1));
  el("btn-font-up").addEventListener("click", () => changeFont(1));
  el("btn-theme").addEventListener("click", () => applyTheme(cycleTheme()));
  el("md-view").addEventListener("click", onDocClick);
  el("file-input").addEventListener("change", onFilePicked);
  window.addEventListener("keydown", onKeyDown);

  if (isTauri()) {
    void getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type !== "drop") {
        return;
      }
      const file = event.payload.paths.find((p) => /\.(md|markdown)$/i.test(p));
      if (!file) {
        return;
      }
      const dir = dirname(file);
      if (state.rootDir !== dir) {
        void openDir(dir);
      }
      void selectFile(file);
    });
    const lastDir = localStorage.getItem(DIR_KEY) || "";
    if (lastDir) {
      void invoke<boolean>("file_exists", { path: lastDir }).then((ok) => {
        if (ok) {
          void openDir(lastDir);
        }
      });
    }
  }
}

init();
