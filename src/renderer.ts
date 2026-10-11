import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import go from "highlight.js/lib/languages/go";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import sql from "highlight.js/lib/languages/sql";
import yaml from "highlight.js/lib/languages/yaml";
import markdown from "highlight.js/lib/languages/markdown";
import java from "highlight.js/lib/languages/java";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import katex from "katex";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("go", go);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);
hljs.registerLanguage("java", java);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("csharp", csharp);

export interface Heading {
  id: string;
  level: number;
  text: string;
}

export interface RenderResult {
  html: string;
  headings: Heading[];
}

function extractMath(
  src: string
): { text: string; restore: (html: string) => string } {
  const parts: string[] = [];
  const stash = (html: string): string => {
    parts.push(html);
    return `@@MATH${parts.length - 1}@@`;
  };
  let text = src.replace(
    /\$\$([\s\S]+?)\$\$/g,
    (_m: string, body: string) =>
      stash(
        `<div class="math-block">${katex.renderToString(body.trim(), {
          throwOnError: false,
          output: "html",
        })}</div>`
      )
  );
  text = text.replace(/(^|[^$\n])\$([^\$\n]+?)\$(?!\$)/g, (m: string, pre: string, body: string) => {
    if (/^\s|\s$/.test(body)) {
      return m;
    }
    let rendered: string;
    try {
      rendered = katex.renderToString(body, { throwOnError: false, output: "html" });
    } catch {
      return m;
    }
    return pre + stash(rendered);
  });
  return {
    text,
    restore: (html: string) =>
      html.replace(/@@MATH(\d+)@@/g, (_m: string, i: string) => parts[Number(i)]),
  };
}

const md = new MarkdownIt({ html: false, linkify: true, breaks: false }).use(taskLists);

let currentHeadings: Heading[] = [];
let headingCount = 0;

md.renderer.rules.heading_open = (tokens, idx, options, _env, self) => {
  headingCount += 1;
  const id = `h-${headingCount}`;
  tokens[idx].attrSet("id", id);
  const level = Number(tokens[idx].tag.slice(1));
  currentHeadings.push({ id, level, text: tokens[idx + 1].content ?? "" });
  return self.renderToken(tokens, idx, options);
};

function highlightCode(code: string, lang: string): string {
  if (lang && hljs.getLanguage(lang)) {
    return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
  }
  if (code.length < 4000) {
    return hljs.highlightAuto(code).value;
  }
  return md.utils.escapeHtml(code);
}

md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  const lang = (token.info || "").trim().split(/\s+/)[0];
  const label = lang
    ? `<span class="code-lang">${md.utils.escapeHtml(lang)}</span>`
    : "";
  return `<pre class="code-block"><div class="code-head">${label}</div><code>${highlightCode(token.content, lang)}</code></pre>\n`;
};

md.renderer.rules.code_block = (tokens, idx) => {
  const token = tokens[idx];
  return `<pre class="code-block"><div class="code-head"></div><code>${highlightCode(token.content, "")}</code></pre>\n`;
};

export function renderMarkdown(source: string): RenderResult {
  currentHeadings = [];
  headingCount = 0;
  const { text, restore } = extractMath(source);
  const html = md.render(text);
  return { html: restore(html), headings: currentHeadings };
}
