import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { postMeme } from "../src/api";
import { PostMeme } from "../src/PostMeme";

vi.mock("../src/api", () => ({ postMeme: vi.fn() }));
const post = vi.mocked(postMeme);
const file = () =>
  new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], "meme.svg", { type: "image/svg+xml" });
const meme = {
  id: "posted",
  caption: "A funny caption",
  imageUrl: "/api/memes/posted/image.svg",
  stats: { likes: 0, swipes: 0, likePercent: null },
};

afterEach(() => vi.resetAllMocks());

function fillForm(image = file(), caption = "A funny caption") {
  fireEvent.change(screen.getByLabelText("SVG image"), { target: { files: [image] } });
  fireEvent.change(screen.getByLabelText("Caption"), { target: { value: caption } });
}

describe("PostMeme", () => {
  it("requires an SVG image and a non-empty caption before sending anything", async () => {
    render(<PostMeme />);
    fireEvent.click(screen.getByRole("button", { name: "Post meme" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose an SVG image");
    fillForm(file(), "   ");
    fireEvent.click(screen.getByRole("button", { name: "Post meme" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Write a caption");
    expect(post).not.toHaveBeenCalled();
  });

  it("rejects non-SVG images and files over 5 MB", () => {
    render(<PostMeme />);
    fillForm(new File(["png"], "meme.png", { type: "image/png" }));
    fireEvent.click(screen.getByRole("button", { name: "Post meme" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose an SVG image");
    const tooLarge = file();
    Object.defineProperty(tooLarge, "size", { value: 5 * 1024 * 1024 + 1 });
    fillForm(tooLarge);
    fireEvent.click(screen.getByRole("button", { name: "Post meme" }));
    expect(screen.getByRole("alert")).toHaveTextContent("5 MB or smaller");
    expect(post).not.toHaveBeenCalled();
  });

  it("posts a valid image and caption, shows confirmation and prevents an accidental repost", async () => {
    post.mockResolvedValue(meme);
    render(<PostMeme />);
    const image = file();
    fillForm(image);
    fireEvent.click(screen.getByRole("button", { name: "Post meme" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Posted!");
    expect(post).toHaveBeenCalledWith(image, "A funny caption");
    expect(screen.getByRole("button", { name: "Post meme" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Caption"), { target: { value: "Another caption" } });
    expect(screen.getByRole("button", { name: "Post meme" })).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("sends only one request while posting and disables editing until it finishes", async () => {
    let finish: (value: typeof meme) => void = () => {};
    post.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<PostMeme />);
    fillForm();
    const form = screen.getByRole("button", { name: "Post meme" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(post).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Posting…" })).toBeDisabled();
    expect(screen.getByLabelText("SVG image")).toBeDisabled();
    expect(screen.getByLabelText("Caption")).toBeDisabled();
    finish(meme);
    await screen.findByRole("status");
  });

  it("shows the server validation message and lets the user retry", async () => {
    post.mockRejectedValueOnce(new Error("SVG contains unsafe content")).mockResolvedValueOnce(meme);
    render(<PostMeme />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Post meme" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("SVG contains unsafe content");
    await waitFor(() => expect(screen.getByRole("button", { name: "Post meme" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Post meme" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Posted!");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
