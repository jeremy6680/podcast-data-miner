import { createRoot } from "react-dom/client";
import { setStaticDataUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

const staticDataUrl = import.meta.env.VITE_STATIC_DATA_URL as string | undefined;
if (staticDataUrl) {
  const baseUrl = import.meta.env.BASE_URL;
  setStaticDataUrl(new URL(staticDataUrl, window.location.origin + baseUrl).toString());
}

createRoot(document.getElementById("root")!).render(<App />);
