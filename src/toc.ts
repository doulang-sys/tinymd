import type { Heading } from "./renderer";

type TocScroller = HTMLElement & { __tocHandler?: () => void };

export function renderToc(
  container: HTMLElement,
  headings: Heading[],
  scroller: HTMLElement
): void {
  container.innerHTML = "";
  const s = scroller as TocScroller;
  if (s.__tocHandler) {
    scroller.removeEventListener("scroll", s.__tocHandler);
  }

  if (headings.length === 0) {
    const empty = document.createElement("div");
    empty.className = "toc-empty";
    empty.textContent = "无标题";
    container.appendChild(empty);
    return;
  }

  for (const h of headings) {
    const a = document.createElement("a");
    a.href = `#${h.id}`;
    a.className = `toc-item lv-${h.level}`;
    a.textContent = h.text;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    container.appendChild(a);
  }

  let ticking = false;
  const update = (): void => {
    ticking = false;
    const top = scroller.getBoundingClientRect().top;
    let current: Heading | null = null;
    for (const h of headings) {
      const node = document.getElementById(h.id);
      if (!node) {
        continue;
      }
      if (node.getBoundingClientRect().top - top <= 10) {
        current = h;
      } else {
        break;
      }
    }
    container.querySelectorAll(".toc-item.active").forEach((item) => item.classList.remove("active"));
    if (current) {
      container.querySelector(`.toc-item[href="#${current.id}"]`)?.classList.add("active");
    }
  };

  const handler = (): void => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  s.__tocHandler = handler;
  scroller.addEventListener("scroll", handler, { passive: true });
  update();
}
