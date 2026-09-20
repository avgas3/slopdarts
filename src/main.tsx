import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installAudioUnlock } from "./sound";
import { GameStoreProvider } from "./state/store";
import "./styles.css";

installAudioUnlock();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GameStoreProvider>
      <App />
    </GameStoreProvider>
  </React.StrictMode>,
);
