import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./theme";
import App from "./App";
import "./styles/tokens.css";
import "./styles/global.css";

// Vite sets BASE_URL from `base` in vite.config.ts and always gives it a trailing
// slash; react-router wants it without one. "/" → "/" (no-op, the local-dev case),
// "/mockups/" → "/mockups". Without this, deploying under a path makes every route
// 404 because the router would try to match "/mockups/about" against "/about".
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
