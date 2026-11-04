import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type ProfileSettings } from "../src/api";
import { ProfilePanel } from "../src/ProfilePanel";

const settings: ProfileSettings = {
  profile: { id: "public-1", nickname: "Giggling Otter", emoji: "🦦" },
  emojiChoices: ["🦦", "🐸", "🦄"],
  nicknameMaxLength: 16,
};

function renderPanel(onSave = vi.fn().mockResolvedValue(settings.profile)) {
  render(<ProfilePanel settings={settings} onSave={onSave} />);
  fireEvent.click(screen.getByRole("button", { name: /Giggling Otter/ }));
  return onSave;
}

describe("ProfilePanel", () => {
  it("opens a form with the current nickname and emoji", () => {
    renderPanel();

    expect(screen.getByRole("button", { name: /Giggling Otter/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Nickname")).toHaveValue("Giggling Otter");
    expect(screen.getByRole("radio", { name: "🦦" })).toBeChecked();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("saves the chosen nickname and emoji and closes", async () => {
    const onSave = renderPanel();

    fireEvent.change(screen.getByLabelText("Nickname"), { target: { value: "Frog Fan" } });
    fireEvent.click(screen.getByRole("radio", { name: "🐸" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith("Frog Fan", "🐸");
    expect(await screen.findByRole("button", { name: /Giggling Otter/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("explains an empty nickname without saving", () => {
    const onSave = renderPanel();

    fireEvent.change(screen.getByLabelText("Nickname"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Nickname is required");
    expect(screen.getByLabelText("Nickname")).toHaveAttribute("aria-invalid", "true");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("explains a nickname that is too long without saving", () => {
    const onSave = renderPanel();

    fireEvent.change(screen.getByLabelText("Nickname"), { target: { value: "x".repeat(17) } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert")).toHaveTextContent("at most 16 characters");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows the server's message when saving is rejected, and stays open", async () => {
    renderPanel(vi.fn().mockRejectedValue(new ApiError(400, "Nickname contains invalid characters")));

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Nickname contains invalid characters");
    expect(screen.getByLabelText("Nickname")).toBeInTheDocument();
  });

  it("shows a general message when saving fails for another reason", async () => {
    renderPanel(vi.fn().mockRejectedValue(new Error("offline")));

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save your profile");
  });

  it("discards unsaved changes on Cancel", () => {
    const onSave = renderPanel();

    fireEvent.change(screen.getByLabelText("Nickname"), { target: { value: "Changed" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: /Giggling Otter/ }));

    expect(screen.getByLabelText("Nickname")).toHaveValue("Giggling Otter");
    expect(onSave).not.toHaveBeenCalled();
  });
});
