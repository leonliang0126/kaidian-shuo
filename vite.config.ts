import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Vite 配置：React 插件 + JSON 直接 import（满足数据文件原样 import 约束）
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
