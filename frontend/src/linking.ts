import { ApiError, redeemDeviceLink } from "./api";

/** The query parameter of a device link, like https://example.com/?link=K7QM-4TXD. */
export const LINK_PARAM = "link";

/** What happened when this page was opened with a device link. */
export interface LinkNotice {
  kind: "success" | "error";
  message: string;
}

export function deviceLinkUrl(code: string): string {
  return `${window.location.origin}/?${LINK_PARAM}=${encodeURIComponent(code)}`;
}

/**
 * When the page was opened from a device link, takes the code out of the address (so a refresh or a
 * shared screenshot does not carry it) and joins this device to the profile. Resolves to null when
 * the page was opened without a link. Never rejects: failures come back as an error notice.
 */
export async function redeemLinkFromUrl(): Promise<LinkNotice | null> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get(LINK_PARAM);
  if (code === null) return null;

  url.searchParams.delete(LINK_PARAM);
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);

  try {
    await redeemDeviceLink(code);
    return { kind: "success", message: "This device is now linked to your profile." };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof ApiError && err.serverMessage ? err.serverMessage : "Could not link this device. Try again.",
    };
  }
}
