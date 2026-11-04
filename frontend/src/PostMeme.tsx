import { useRef, useState, type FormEvent } from "react";
import { postMeme } from "./api";

const MAX_SVG_BYTES = 5 * 1024 * 1024;

export function PostMeme() {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const inFlight = useRef(false);

  function changed() {
    setPosted(false);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setError(null);
    setPosted(false);
    if (!file || !/\.svg$/i.test(file.name)) {
      setError("Choose an SVG image.");
      return;
    }
    if (file.size > MAX_SVG_BYTES) {
      setError("SVG images must be 5 MB or smaller.");
      return;
    }
    if (!caption.trim() || caption.length > 500) {
      setError("Write a caption of 1 to 500 characters.");
      return;
    }
    inFlight.current = true;
    setPosting(true);
    try {
      await postMeme(file, caption);
      setPosted(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to post your meme. Please try again.");
    } finally {
      inFlight.current = false;
      setPosting(false);
    }
  }

  return (
    <section className="post-meme" aria-labelledby="post-meme-heading">
      <h2 id="post-meme-heading">Post a meme</h2>
      <p id="upload-help">Choose an SVG image up to 5 MB. Your meme will join everyone's pile.</p>
      <form onSubmit={submit} noValidate aria-busy={posting}>
        <label htmlFor="meme-image">SVG image</label>
        <input
          id="meme-image"
          type="file"
          accept=".svg,image/svg+xml"
          aria-describedby="upload-help"
          disabled={posting}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            changed();
          }}
        />
        <label htmlFor="meme-caption">Caption</label>
        <textarea
          id="meme-caption"
          value={caption}
          maxLength={500}
          rows={3}
          disabled={posting}
          aria-describedby="caption-help"
          onChange={(event) => {
            setCaption(event.target.value);
            changed();
          }}
        />
        <small id="caption-help">Up to 500 characters.</small>
        <button type="submit" disabled={posting || posted}>
          {posting ? "Posting…" : "Post meme"}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {posted && <p role="status">Posted! Your meme is now in everyone's pile.</p>}
    </section>
  );
}
