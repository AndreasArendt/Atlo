import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderSafeMarkdown } from "../lib/markdownSanitizer.js";

export const config = { runtime: "nodejs" };

const markdownPages = {
  about: {
    title: "About this project",
    file: path.join(process.cwd(), "content", "about.md"),
    bodyClass: "markdown-page",
  },
  privacy: {
    title: "Privacy Policy",
    file: path.join(process.cwd(), "content", "privacy.md"),
    bodyClass: "privacy-page",
  },
  faq: {
    title: "FAQ",
    file: path.join(process.cwd(), "content", "faq.md"),
    bodyClass: "markdown-page",
  },
  analysis: {
    title: "Training Load Notes",
    file: path.join(process.cwd(), "content", "analysis.md"),
    bodyClass: "markdown-page",
  },
};

const helpTemplate = () => `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Need help?</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@300..800&display=swap"
        rel="stylesheet"
      />
      <style>
        :root { color-scheme: light dark; }
        body {
          font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: #f9fafb;
          color: #0f172a;
          margin: 0;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 1rem;
        }
        .card {
          width: min(520px, 100%);
          background: #ffffff;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
        }
        h1 { margin: 0 0 0.75rem; font-size: 1.875rem; line-height: 1.2; }
        p { margin: 0 0 1.5rem; color: #475569; }
        form { display: flex; flex-direction: column; gap: 1rem; margin-top: 2rem; padding-inline: 2rem; }
        .field { display: flex; flex-direction: column; gap: 0.35rem; }
        label { font-weight: 600; font-size: 0.9rem; color: #0f172a; letter-spacing: 0.01em; }
        input, textarea {
          font: inherit;
          border: 1px solid #cbd5f5;
          border-radius: 10px;
          padding: 0.75rem 0.9rem;
          resize: vertical;
          min-height: 48px;
          width: 100%;
          background: #f8fafc;
          color: #0f172a;
          box-shadow: inset 0 1px 3px rgba(15, 23, 42, 0.06);
          transition: border-color 120ms ease, box-shadow 120ms ease;
        }
        textarea { min-height: 140px; }
        input:focus, textarea:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15); }
        button {
          border: none;
          border-radius: 999px;
          background: #111827;
          color: #fff;
          font-size: 1rem;
          font-weight: 600;
          padding: 0.9rem 1.2rem;
          cursor: pointer;
          transition: opacity 150ms ease-in-out;
        }
        button:hover { opacity: 0.9; }
        .direct-email { font-size: 0.95rem; color: #1e293b; }
        a { color: inherit; }
        @media (prefers-color-scheme: dark) {
          body { background: #0f172a; color: #f8fafc; }
          .card { background: #1e293b; box-shadow: none; }
          p, .direct-email { color: #cbd5f5; }
          input, textarea {
            background: #0f172a;
            border-color: #334155;
            color: #f8fafc;
            box-shadow: inset 0 1px 3px rgba(2, 6, 23, 0.7);
          }
          input:focus, textarea:focus { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.25); }
        }
      </style>
    </head>
    <body>
      <main class="card">
        <h1>Need help?</h1>
        <p>
          Send a note and I will get back to you as quickly as possible. You can also reach me directly at
          <a href="mailto:info@atlo.me">info@atlo.me</a>.
        </p>
        <form action="mailto:info@atlo.me" method="post" enctype="text/plain">
          <div class="field">
            <label for="name">Your name</label>
            <input id="name" name="name" type="text" autocomplete="name" required />
          </div>
          <div class="field">
            <label for="email">Email address</label>
            <input id="email" name="email" type="email" autocomplete="email" required />
          </div>
          <div class="field">
            <label for="message">Message</label>
            <textarea id="message" name="message" rows="6" required placeholder="Tell me how I can help."></textarea>
          </div>
          <button type="submit">Send email</button>
          <p class="direct-email">
            Prefer your own email app?
            <a href="mailto:info@atlo.me?subject=Support%20request%20from%20Atlo">Open a new message.</a>
          </p>
        </form>
      </main>
    </body>
  </html>
`;

async function renderMarkdownPage(entry) {
  const markdown = await readFile(entry.file, "utf8");
  const safeHtml = renderSafeMarkdown(markdown);

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${entry.title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300..800&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/markdown.css" />
      </head>
      <body class="${entry.bodyClass}">
        <main class="markdown-content">${safeHtml}</main>
      </body>
    </html>
  `;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method Not Allowed");
  }

  const slug = (req.query?.slug || req.query?.page || "").toString().toLowerCase();
  if (!slug) {
    return res.status(400).send("Missing page slug.");
  }

  try {
    if (slug === "help") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(helpTemplate());
    }

    const entry = markdownPages[slug];
    if (!entry) {
      return res.status(404).send("Page not found.");
    }

    const html = await renderMarkdownPage(entry);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  } catch (err) {
    console.error(`Error loading page "${slug}":`, err);
    return res.status(500).send("Unable to load page.");
  }
}
