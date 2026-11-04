import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { memeFingerprint, normalizeCaption, normalizeSvg } from "../src/memes/fingerprint.js";
import { seedMemes } from "../src/memes/seed.js";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#fff"/><text x="10" y="20">Hello  world</text></svg>`;

describe("normalizeCaption", () => {
  it("ignores leading and trailing whitespace, repeated whitespace and capitalization", () => {
    expect(normalizeCaption("  It   works ON\tmy\nmachine ")).toBe(
      normalizeCaption("it works on my machine"),
    );
  });

  it("keeps different words different", () => {
    expect(normalizeCaption("It works on my machine")).not.toBe(normalizeCaption("It works in production"));
  });
});

describe("normalizeSvg", () => {
  it("ignores formatting whitespace between elements", () => {
    const formatted = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <rect width="400" height="400" fill="#fff"/>
      <text x="10" y="20">Hello  world</text>
    </svg>\n`;

    expect(normalizeSvg(formatted)).toBe(normalizeSvg(svg));
  });

  it("ignores attribute order, whitespace inside tags and quote style", () => {
    const reordered = `<svg viewBox='0 0 400 400'   xmlns="http://www.w3.org/2000/svg"><rect fill="#fff" height='400'
      width="400" /><text y="20" x="10">Hello  world</text></svg>`;

    expect(normalizeSvg(reordered)).toBe(normalizeSvg(svg));
  });

  it("keeps the spacing of text", () => {
    expect(normalizeSvg(svg.replace("Hello  world", "Hello world"))).not.toBe(normalizeSvg(svg));
  });

  it("keeps whitespace-only text inside text elements", () => {
    const spaced = (inner: string) => `<svg><text><tspan>a</tspan>${inner}<tspan>b</tspan></text></svg>`;

    expect(normalizeSvg(spaced(" "))).not.toBe(normalizeSvg(spaced("")));
  });

  it("keeps visual properties such as colors and sizes", () => {
    expect(normalizeSvg(svg.replace('fill="#fff"', 'fill="#000"'))).not.toBe(normalizeSvg(svg));
    expect(normalizeSvg(svg.replace('height="400"', 'height="401"'))).not.toBe(normalizeSvg(svg));
  });

  it("keeps a quote inside a single-quoted attribute value distinct", () => {
    expect(normalizeSvg(`<svg><text font-family='"Comic Sans"'>a</text></svg>`)).not.toBe(
      normalizeSvg(`<svg><text font-family="Comic Sans">a</text></svg>`),
    );
  });

  it("does not lose a greater-than sign inside an attribute value", () => {
    expect(normalizeSvg(`<svg><g data-x="a>b"/></svg>`)).toBe(`<svg><g data-x="a>b"/></svg>`);
  });
});

describe("memeFingerprint", () => {
  it("is equal for the same image and caption despite formatting and capitalization", () => {
    const reformatted = svg.replaceAll("><", ">\n  <");

    expect(memeFingerprint(reformatted, "  HELLO   there ")).toBe(memeFingerprint(svg, "Hello there"));
  });

  it("differs for the same image with a different caption", () => {
    expect(memeFingerprint(svg, "Hello there")).not.toBe(memeFingerprint(svg, "Goodbye"));
  });

  it("differs for the same caption with a different image", () => {
    const other = svg.replace("Hello  world", "Bye");

    expect(memeFingerprint(other, "Hello there")).not.toBe(memeFingerprint(svg, "Hello there"));
  });

  it("cannot be fooled by moving text between image and caption", () => {
    expect(memeFingerprint("<svg/>a", "b")).not.toBe(memeFingerprint("<svg/>", "ab"));
  });

  describe("seed memes", () => {
    const seeds = seedMemes.map((seed) => ({
      ...seed,
      svg: readFileSync(new URL(`../assets/memes/${seed.file}`, import.meta.url), "utf8"),
    }));

    it("gives every seed meme its own fingerprint", () => {
      const fingerprints = new Set(seeds.map((seed) => memeFingerprint(seed.svg, seed.caption)));

      expect(fingerprints.size).toBe(seeds.length);
    });

    it("recognizes a reformatted copy of a seed meme with a recased caption", () => {
      for (const seed of seeds) {
        // Line breaks after every closing or self-closing tag, so between elements and never inside text.
        const reformatted = seed.svg.replace(/(\/>|<\/[^>]+>)(?=<)/g, "$1\n    ");
        expect(reformatted).not.toBe(seed.svg);

        expect(memeFingerprint(reformatted, ` ${seed.caption.toUpperCase()} `)).toBe(
          memeFingerprint(seed.svg, seed.caption),
        );
      }
    });
  });
});
