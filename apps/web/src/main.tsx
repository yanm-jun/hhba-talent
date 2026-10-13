import React from "react";
import { createRoot } from "react-dom/client";

function App() {
  return (
    <main style={{ fontFamily: "system-ui", padding: 40 }}>
      <h1>HHBA · Phase 0</h1>
      <p>开发环境准备阶段，前端骨架验证通过。</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
