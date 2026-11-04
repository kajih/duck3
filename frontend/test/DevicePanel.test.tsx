import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api";
import { DevicePanel } from "../src/DevicePanel";

afterEach(() => vi.useRealTimers());

function renderPanel(
  onCreateLink = vi.fn().mockResolvedValue({ code: "K7QM-4TXD", expiresInSeconds: 300 }),
  onLink = vi.fn().mockResolvedValue(undefined),
) {
  render(<DevicePanel onCreateLink={onCreateLink} onLink={onLink} />);
  fireEvent.click(screen.getByRole("button", { name: /Devices/ }));
  return { onCreateLink, onLink };
}

describe("DevicePanel", () => {
  it("shows a one-time link and code with the time left", async () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Show link and code" }));

    expect(await screen.findByText("K7QM-4TXD")).toBeInTheDocument();
    expect(screen.getByLabelText("Link")).toHaveValue(`${window.location.origin}/?link=K7QM-4TXD`);
    expect(screen.getByText("Expires in 5:00")).toBeInTheDocument();
  });

  it("counts down and offers a new code when the code has expired", async () => {
    vi.useFakeTimers();
    const { onCreateLink } = renderPanel();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Show link and code" }));
    });

    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });
    expect(screen.getByText("Expires in 3:59")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(240_000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("This code has expired.");
    expect(screen.queryByText("K7QM-4TXD")).not.toBeInTheDocument();

    onCreateLink.mockResolvedValueOnce({ code: "ZZZZ-2222", expiresInSeconds: 300 });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Get a new code" }));
    });
    expect(screen.getByText("ZZZZ-2222")).toBeInTheDocument();
  });

  it("explains when a code could not be made", async () => {
    renderPanel(vi.fn().mockRejectedValue(new Error("offline")));

    fireEvent.click(screen.getByRole("button", { name: "Show link and code" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not make a code");
  });

  it("copies the link", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Show link and code" }));
    await screen.findByText("K7QM-4TXD");

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/?link=K7QM-4TXD`);
    expect(await screen.findByText("Link copied")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("links this device with a typed code and closes", async () => {
    const { onLink } = renderPanel();

    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "k7qm 4txd" } });
    fireEvent.click(screen.getByRole("button", { name: "Link this device" }));

    expect(onLink).toHaveBeenCalledWith("k7qm 4txd");
    expect(await screen.findByRole("button", { name: /Devices/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the server's friendly message for a bad code and stays open", async () => {
    renderPanel(
      undefined,
      vi.fn().mockRejectedValue(new ApiError(400, "That code does not work. It may have been used or expired.")),
    );

    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "AAAA-AAAA" } });
    fireEvent.click(screen.getByRole("button", { name: "Link this device" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("used or expired");
    expect(screen.getByLabelText("Code")).toHaveValue("AAAA-AAAA");
  });

  it("asks for a code instead of sending an empty one", () => {
    const { onLink } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Link this device" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Type the code");
    expect(onLink).not.toHaveBeenCalled();
  });
});
