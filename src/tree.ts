import { invoke } from "@tauri-apps/api/core";

interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
}

const NOISE_DIRS = new Set(["node_modules", "target"]);

function isMdFile(name: string): boolean {
  const n = name.toLowerCase();
  return n.endsWith(".md") || n.endsWith(".markdown");
}

async function loadDir(dir: string): Promise<DirEntry[]> {
  const entries = await invoke<DirEntry[]>("read_dir", { path: dir });
  return entries.filter((e) => (e.isDir ? !NOISE_DIRS.has(e.name) : isMdFile(e.name)));
}

export function renderTree(
  container: HTMLElement,
  rootDir: string,
  currentFile: string,
  onSelect: (path: string) => void
): void {
  container.innerHTML = "";
  const ul = document.createElement("ul");
  ul.className = "tree-list";
  container.appendChild(ul);
  void buildLevel(ul, rootDir, currentFile, onSelect);
}

export function setActiveTreeItem(container: HTMLElement, path: string): void {
  container.querySelectorAll(".tree-row.active").forEach((item) => item.classList.remove("active"));
  container.querySelectorAll<HTMLElement>(".tree-row").forEach((item) => {
    if (item.dataset.path === path) {
      item.classList.add("active");
    }
  });
}

async function buildLevel(
  ul: HTMLElement,
  dir: string,
  currentFile: string,
  onSelect: (path: string) => void
): Promise<void> {
  let entries: DirEntry[];
  try {
    entries = await loadDir(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const li = document.createElement("li");
    const row = document.createElement("div");
    row.className = "tree-row";
    row.dataset.path = entry.path;
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = entry.name;
    if (entry.isDir) {
      row.classList.add("dir");
      const arrow = document.createElement("span");
      arrow.className = "arrow";
      arrow.textContent = "▸";
      row.append(arrow, label);
      let loaded = false;
      row.addEventListener("click", async () => {
        const expanded = li.classList.toggle("open");
        arrow.textContent = expanded ? "▾" : "▸";
        if (expanded && !loaded) {
          const child = document.createElement("ul");
          child.className = "tree-list";
          li.appendChild(child);
          loaded = true;
          await buildLevel(child, entry.path, currentFile, onSelect);
        }
      });
    } else {
      row.appendChild(label);
      if (entry.path === currentFile) {
        row.classList.add("active");
      }
      row.addEventListener("click", () => onSelect(entry.path));
    }
    li.appendChild(row);
    ul.appendChild(li);
  }
}
