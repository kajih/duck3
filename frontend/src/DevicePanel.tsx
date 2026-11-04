import { useEffect, useId, useState, type FormEvent } from "react";
import { ApiError, type DeviceLink } from "./api";
import { deviceLinkUrl } from "./linking";

interface DevicePanelProps {
  /** Makes a one-time code for another device. */
  onCreateLink: () => Promise<DeviceLink>;
  /** Joins this device to the profile behind a code; rejects with an ApiError that explains a bad code. */
  onLink: (code: string) => Promise<void>;
}

function formatRemaining(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.serverMessage ? err.serverMessage : fallback;
}

/** The Devices button in the header. Its panel adds another device to this profile, or joins this device to one. */
export function DevicePanel({ onCreateLink, onLink }: DevicePanelProps) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<DeviceLink | null>(null);
  /** When the shown code stops working, in the browser's clock (milliseconds). */
  const [expiresAt, setExpiresAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const panelId = useId();
  const codeId = useId();
  const linkFieldId = useId();

  useEffect(() => {
    if (!link) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [link, expiresAt]);

  async function showLink() {
    setBusy(true);
    setCreateMessage(null);
    setCopied(false);
    try {
      const created = await onCreateLink();
      setExpiresAt(Date.now() + created.expiresInSeconds * 1000);
      setLink(created);
    } catch (err) {
      setLink(null);
      setCreateMessage(errorMessage(err, "Could not make a code. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // No clipboard access: the link is selectable in the field.
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!code.trim()) {
      setLinkMessage("Type the code from your other device");
      return;
    }
    setBusy(true);
    setLinkMessage(null);
    try {
      await onLink(code);
      setCode("");
      setOpen(false);
    } catch (err) {
      setLinkMessage(errorMessage(err, "Could not link this device. Try again."));
    } finally {
      setBusy(false);
    }
  }

  const expired = link !== null && remaining === 0;

  return (
    <div className="profile">
      <button
        type="button"
        className="profile-button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <span className="profile-emoji" aria-hidden="true">
          📱
        </span>
        <span>Devices</span>
      </button>
      {open && (
        <div id={panelId} className="profile-panel" role="group" aria-label="Your devices">
          <h2 className="device-heading">Add a device</h2>
          <p className="device-help">Open the link or type the code on your other device. It works once.</p>
          {link && !expired ? (
            <>
              <label htmlFor={linkFieldId}>Link</label>
              <input
                id={linkFieldId}
                readOnly
                value={deviceLinkUrl(link.code)}
                onFocus={(event) => event.target.select()}
              />
              <p className="device-code" aria-label={`Code ${link.code.split("").join(" ")}`}>
                {link.code}
              </p>
              <p className="device-help">Expires in {formatRemaining(remaining)}</p>
              <div className="profile-actions">
                <button type="button" onClick={() => copyLink(deviceLinkUrl(link.code))}>
                  Copy link
                </button>
                <button type="button" onClick={showLink} disabled={busy}>
                  New code
                </button>
              </div>
              {copied && (
                <p role="status" className="device-help">
                  Link copied
                </p>
              )}
            </>
          ) : (
            <>
              {expired && (
                <p role="status" className="profile-message">
                  This code has expired.
                </p>
              )}
              <div className="profile-actions">
                <button type="button" onClick={showLink} disabled={busy}>
                  {expired ? "Get a new code" : "Show link and code"}
                </button>
              </div>
            </>
          )}
          {createMessage && (
            <p role="alert" className="profile-message">
              {createMessage}
            </p>
          )}

          <form className="device-join" onSubmit={submit} noValidate>
            <h2 className="device-heading">Use a code from another device</h2>
            <label htmlFor={codeId}>Code</label>
            <input
              id={codeId}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              aria-invalid={linkMessage ? true : undefined}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="ABCD-EFGH"
            />
            {linkMessage && (
              <p role="alert" className="profile-message">
                {linkMessage}
              </p>
            )}
            <div className="profile-actions">
              <button type="submit" disabled={busy}>
                Link this device
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
