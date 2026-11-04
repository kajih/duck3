import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { redeemLinkFromUrl } from "./linking";
import "./styles.css";

// A device link (/?link=CODE) joins this device to a profile before the first memes are loaded,
// so the app starts as that user.
redeemLinkFromUrl().then((linkNotice) => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App linkNotice={linkNotice} />
    </StrictMode>,
  );
});
