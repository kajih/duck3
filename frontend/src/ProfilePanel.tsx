import { useId, useState, type FormEvent } from "react";
import { ApiError, type Profile, type ProfileSettings } from "./api";

interface ProfilePanelProps {
  settings: ProfileSettings;
  /** Saves nickname and emoji; rejects with an ApiError for invalid input. */
  onSave: (nickname: string, emoji: string) => Promise<Profile>;
}

/** The profile button in the header, which opens a small panel to change nickname and emoji. */
export function ProfilePanel({ settings, onSave }: ProfilePanelProps) {
  const { profile, emojiChoices, nicknameMaxLength } = settings;
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState(profile.nickname);
  const [emoji, setEmoji] = useState(profile.emoji);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const panelId = useId();
  const nicknameId = useId();
  const messageId = useId();

  function toggle() {
    if (!open) {
      setNickname(profile.nickname);
      setEmoji(profile.emoji);
      setMessage(null);
    }
    setOpen(!open);
  }

  function validate(): string | null {
    const trimmed = nickname.trim();
    if (!trimmed) return "Nickname is required";
    if ([...trimmed.replace(/\s+/g, " ")].length > nicknameMaxLength) {
      return `Nickname can be at most ${nicknameMaxLength} characters`;
    }
    return null;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const invalid = validate();
    if (invalid) {
      setMessage(invalid);
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await onSave(nickname, emoji);
      setOpen(false);
    } catch (err) {
      setMessage(err instanceof ApiError && err.serverMessage ? err.serverMessage : "Could not save your profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile">
      <button
        type="button"
        className="profile-button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
      >
        <span className="profile-emoji" aria-hidden="true">
          {profile.emoji}
        </span>
        <span>{profile.nickname}</span>
      </button>
      {open && (
        <form id={panelId} className="profile-panel" aria-label="Your profile" onSubmit={submit} noValidate>
          <label htmlFor={nicknameId}>Nickname</label>
          <input
            id={nicknameId}
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? messageId : undefined}
            autoComplete="nickname"
          />
          <fieldset>
            <legend>Profile picture</legend>
            <div className="profile-emoji-choices">
              {emojiChoices.map((choice) => (
                <label key={choice} className="profile-emoji-choice">
                  <input
                    type="radio"
                    name="profile-emoji"
                    value={choice}
                    checked={emoji === choice}
                    onChange={() => setEmoji(choice)}
                  />
                  <span>{choice}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {message && (
            <p id={messageId} className="profile-message" role="alert">
              {message}
            </p>
          )}
          <div className="profile-actions">
            <button type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" disabled={saving}>
              Save
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
