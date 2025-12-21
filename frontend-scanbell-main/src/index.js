import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

import axios from "axios";          // 🔥 Add this
axios.defaults.withCredentials = true;  // 🔥 Important fix

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
