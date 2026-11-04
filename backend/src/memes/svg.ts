import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

export const MAX_SVG_BYTES = 5 * 1024 * 1024;
/**
 * Validation runs synchronously, so a large number of elements or deep nesting would block the
 * whole server for seconds (a 1 MB file with 300,000 elements took over 10 s). Memes need far
 * less: the seed memes have at most 13 elements.
 */
export const MAX_SVG_ELEMENTS = 2000;
export const MAX_SVG_DEPTH = 32;
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

/** How deeply elements are nested below (and including) the given one, without recursion. */
function depth(root: Element): number {
  let deepest = 0;
  const stack: [Element, number][] = [[root, 1]];
  while (stack.length > 0) {
    const [element, level] = stack.pop()!;
    deepest = Math.max(deepest, level);
    for (const child of Array.from(element.children)) stack.push([child, level + 1]);
  }
  return deepest;
}

/** Validate without repairing the image. */
export function validateSvg(svg: string): void {
  if (Buffer.byteLength(svg, "utf8") > MAX_SVG_BYTES) throw new ContentError("SVG must be 5 MB or smaller");
  // A cheap upper bound on the element count, before the expensive parsing.
  if ((svg.match(/<[A-Za-z]/g)?.length ?? 0) > MAX_SVG_ELEMENTS) {
    throw new ContentError(`SVG can have at most ${MAX_SVG_ELEMENTS} elements`);
  }
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
  if (depth(root) > MAX_SVG_DEPTH) {
    throw new ContentError(`SVG elements can be nested at most ${MAX_SVG_DEPTH} levels deep`);
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
  try {
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
  } catch {
    throw new ContentError("SVG contains unsafe or unsupported content");
  }
  // Removing comments is safe; reject every removed attribute, element or processing instruction.
  if (purify.removed.some((item) => "attribute" in item || item.element.nodeType !== 8)) {
    throw new ContentError("SVG contains unsafe or unsupported content");
  }
}
