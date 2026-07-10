import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Vite 配置：React 插件 + JSON 直接 import（满足数据文件原样 import 约束）
export default defineConfig({
  plugins: [react()],
  // 每次构建注入唯一 build id（时间戳），用于「新部署链接 = 全新进度」的存档失效判定。
  define: {
    __BUILD_ID__: JSON.stringify(String(Date.now())),
  },
  server: {
    host: true,
    port: 5173,
  },
  test: {
    environment: 'node',
    // 注意：组件渲染测试为 *.test.tsx，并各自用文件级 `// @vitest-environment jsdom`
    // 隔离，避免污染全局 node 环境与既有 380 个纯逻辑测试。
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],
  },
});
