import * as Print from "expo-print";
import type { Note } from "../types/note";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function prepareBody(body: string): string {
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(body);
  const html = looksLikeHtml ? body : escapeHtml(body).replace(/\r?\n/g, "<br />");

  // The PDF renderer consumes HTML. Remove executable/embedded content and inline event handlers.
  return html
    .replace(/<\s*(script|iframe|object|embed|form|input|button|textarea|select)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|form|input|button|textarea|select)\b[^>]*\/?\s*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[\s\S]*?\2/gi, "$1=\"#\"");
}

function safeFileName(title: string): string {
  const cleaned = title
    .normalize("NFKD")
    .replace(/[^\w\- ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 50);
  return cleaned || "ders-notu";
}

export async function createNotePdf(note: Note): Promise<string> {
  const title = escapeHtml(note.title.trim() || "Başlıksız ders notu");
  const body = prepareBody(note.body || "");
  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    @page { margin: 22mm 18mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; color: #292235; font-size: 12pt; line-height: 1.65; overflow-wrap: break-word; }
    h1 { font-size: 22pt; line-height: 1.25; margin: 0 0 18pt; color: #39245c; }
    h2, h3, h4 { color: #39245c; }
    p { margin: 0 0 10pt; }
    ul, ol { padding-left: 22pt; }
    blockquote { border-left: 3px solid #8b6ac7; margin-left: 0; padding-left: 12pt; color: #5d536b; }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; max-width: 100%; }
    td, th { border: 1px solid #ddd5e9; padding: 5pt; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <main>${body}</main>
</body>
</html>`;
  const result = await Print.printToFileAsync({ html, width: 612, height: 792 });
  return result.uri;
}

export function notePdfFileName(note: Note): string {
  return `${safeFileName(note.title)}.pdf`;
}
