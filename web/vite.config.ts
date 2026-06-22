import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base ist für GitHub Pages auf "/EP_File/" zu setzen (via VITE_BASE).
// Lokal/Vercel bleibt es "/".
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
});
