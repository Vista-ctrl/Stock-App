import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// สำคัญ: แก้ 'REPLACE_WITH_REPO_NAME' ให้ตรงกับชื่อ repository ของคุณบน GitHub
// เช่น ถ้า repo ชื่อ stock-app ให้แก้เป็น base: '/stock-app/'
export default defineConfig({
  plugins: [react()],
  base: "/Stock-App/",
});
