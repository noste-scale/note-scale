import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import { prepareOfflineRegistration } from "./pwa";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><HashRouter><App /></HashRouter></React.StrictMode>,
);

prepareOfflineRegistration(
  "serviceWorker" in navigator ? navigator.serviceWorker : undefined,
  window,
  import.meta.env.BASE_URL,
  import.meta.env.PROD,
  () => window.dispatchEvent(new Event("notescale-offline-error")),
);
