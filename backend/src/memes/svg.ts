import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

export const MAX_SVG_BYTES = 5 * 1024 * 1024;
const window = new JSDOM("").window;
const purify = createDOMPurify(window);

export class ContentError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** Validate without repairing the image. */
export function validateSvg(svg: string): void {
  if (Buffer.byteLength(svg, "utf8") > MAX_SVG_BYTES) throw new ContentError("SVG must be 5 MB or smaller");
  if (/<!DOCTYPE|<!ENTITY/i.test(svg))
    throw new ContentError("SVG document types and entities are not allowed");
  const doc = new window.DOMParser().parseFromString(svg, "image/svg+xml");
  const root = doc.documentElement;
  if (
    doc.querySelector("parsererror") ||
    root.localName !== "svg" ||
    root.namespaceURI !== "http://www.w3.org/2000/svg"
  ) {
    throw new ContentError("Choose a valid SVG image");
  }
  for (const node of Array.from(doc.childNodes)) {
    if (node.nodeType === 7) throw new ContentError("SVG processing instructions are not allowed");
  }
  for (const element of [root, ...Array.from(root.querySelectorAll("*"))]) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.localName.toLowerCase();
      const value = attribute.value;
      if (
        name.startsWith("on") ||
        name === "style" ||
        name === "base" ||
        value.includes("\\") ||
        (name === "href" && !/^#[A-Za-z_][\w:.-]*$/.test(value)) ||
        (/url\s*\(/i.test(value) && !/^url\(\s*#[A-Za-z_][\w:.-]*\s*\)$/.test(value))
      ) {
        throw new ContentError("SVG scripts, styles and external references are not allowed");
      }
    }
  }
  purify.sanitize(root.cloneNode(true), {
    IN_PLACE: true,
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: [
      "style",
      "foreignObject",
      "animate",
      "animateMotion",
      "animateTransform",
      "set",
      "image",
      "a",
    ],
    FORBID_ATTR: ["style"],
  });
  if (purify.removed.length) throw new ContentError("SVG contains unsafe or unsupported content");
}
