import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";
import { marked } from "marked";

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

export function renderSafeMarkdown(markdown) {
  const rawHtml = marked.parse(markdown, { mangle: false, headerIds: false });
  return DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
}
