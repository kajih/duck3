import { createHash } from "node:crypto";

/**
 * Duplicate detection for memes (#9): two memes are the same when BOTH their SVG image and their
 * caption match after normalization. The same image with another caption is a different meme.
 *
 * Expects SVG that has already been validated as safe (#8). This only normalizes formatting; it
 * does not parse or check the SVG, and rendered-image equivalence is out of scope.
 */

/** Elements whose whitespace-only text is meaningful (text spacing), so it is kept as is. */
const TEXT_CONTENT_ELEMENTS = new Set(["text", "tspan", "textpath", "title", "desc", "style"]);

const TOKEN =
  /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<![^>]*>|<\/[^\s>]+\s*>|<[A-Za-z][^\s/>]*(?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*\s*\/?>|[^<]+|</g;
const START_TAG = /^<([A-Za-z][^\s/>]*)([\s\S]*?)(\/?)>$/;
const END_TAG = /^<\/([^\s>]+)\s*>$/;
const ATTRIBUTE = /([^\s=/>]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;

function normalizeAttributes(source: string): string {
  const attributes: [string, string][] = [];
  for (const [, name, rawValue = ""] of source.matchAll(ATTRIBUTE)) {
    const unquoted = /^["']/.test(rawValue) ? rawValue.slice(1, -1) : rawValue;
    attributes.push([name, unquoted.replaceAll('"', "&quot;")]);
  }
  attributes.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return attributes.map(([name, value]) => ` ${name}="${value}"`).join("");
}

/**
 * Normalizes SVG markup so that formatting does not matter: whitespace between elements and
 * inside tags, attribute order and attribute quote style. Text content (including its spacing
 * inside text elements) and attribute values are kept exactly, so visual differences remain.
 */
export function normalizeSvg(svg: string): string {
  const out: string[] = [];
  const openElements: string[] = [];
  const inTextContent = () => openElements.some((name) => TEXT_CONTENT_ELEMENTS.has(name));

  for (const [token] of svg.matchAll(TOKEN)) {
    const end = END_TAG.exec(token);
    if (end) {
      const name = end[1].toLowerCase();
      const index = openElements.lastIndexOf(name);
      if (index !== -1) openElements.length = index;
      out.push(`</${end[1]}>`);
      continue;
    }
    const start = START_TAG.exec(token);
    if (start) {
      const [, name, attributes, selfClosing] = start;
      out.push(`<${name}${normalizeAttributes(attributes)}${selfClosing ? "/" : ""}>`);
      if (!selfClosing) openElements.push(name.toLowerCase());
      continue;
    }
    if (token.startsWith("<") && token.length > 1) {
      // Comment, CDATA, XML declaration or doctype: kept, without the formatting around it.
      out.push(token.trim());
      continue;
    }
    // Text. Whitespace-only text between elements is formatting, unless it sits in a text element.
    if (token.trim() === "" && !inTextContent()) continue;
    out.push(token);
  }
  return out.join("");
}

/** Normalizes a caption for comparison: trimmed, whitespace collapsed, capitalization ignored. */
export function normalizeCaption(caption: string): string {
  return caption.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * A stable fingerprint of a meme's image and caption, equal for duplicates. Store it with a
 * unique index so that concurrent duplicate posts cannot both be saved.
 */
export function memeFingerprint(svg: string, caption: string): string {
  return createHash("sha256")
    .update(normalizeSvg(svg))
    .update("\u0000")
    .update(normalizeCaption(caption))
    .digest("hex");
}
