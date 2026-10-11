import { invoke } from "@tauri-apps/api/core";

const state = {
  rootDir: "",
  files: [] as string[],
  items: [] as HTMLLIElement[],
  paths: [] as string[],
  index: 0,
  onPick: (_path: string) => {},
};

const rel = (p: string): string =>
  p.slice(state.rootDir.length).replace(/^[\\/]/, "").replace(/\\/g, "/");

const close = (): void => {
  const overlay = document.querySelector<HTMLElement>("#quickopen");
  if (overlay) {
    overlay.hidden = true;
  }
};

const pick = (path: string): void => {
  close();
  state.onPick(path);
};

const updateSel = (): void => {
  state.items.forEach((item, i) => item.classList.toggle("sel", i === state.index));
  state.items[state.index]?.scrollIntoView({ block: "nearest" });
};

const show = (matched: string[]): void => {
  const list = document.querySelector<HTMLElement>("#quickopen-list");
  if (!list) {
    return;
  }
  list.innerHTML = "";
  state.items = [];
  state.paths = [];
  state.index = 0;
  for (const p of matched.slice(0, 60)) {
    const li = document.createElement("li");
    li.textContent = rel(p);
    li.addEventListener("mousedown", (e) => {
      e.preventDefault();
      pick(p);
    });
    list.appendChild(li);
    state.items.push(li);
    state.paths.push(p);
  }
  updateSel();
};

const refresh = (): void => {
  const input = document.querySelector<HTMLInputElement>("#quickopen-input");
  if (!input) {
    return;
  }
  const q = input.value.trim().toLowerCase();
  show(q ? state.files.filter((f) => rel(f).toLowerCase().includes(q)) : state.files);
};

let bound = false;

function bind(): void {
  if (bound) {
    return;
  }
  bound = true;
  const input = document.querySelector<HTMLInputElement>("#quickopen-input");
  const overlay = document.querySelector<HTMLElement>("#quickopen");
  if (!input || !overlay) {
    return;
  }
  input.addEventListener("input", refresh);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      state.index = Math.min(state.index + 1, state.items.length - 1);
      updateSel();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      state.index = Math.max(state.index - 1, 0);
      updateSel();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (state.paths[state.index]) {
        pick(state.paths[state.index]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      close();
    }
  });
}

export function openQuickOpen(rootDir: string, onPick: (path: string) => void): void {
  bind();
  state.rootDir = rootDir;
  state.onPick = onPick;
  const overlay = document.querySelector<HTMLElement>("#quickopen");
  const input = document.querySelector<HTMLInputElement>("#quickopen-input");
  if (!overlay || !input) {
    return;
  }
  overlay.hidden = false;
  input.value = "";
  input.focus();
  invoke<string[]>("list_md_files", { root: rootDir, maxDepth: 12 })
    .then((result) => {
      state.files = result;
      refresh();
    })
    .catch(() => show([]));
}
