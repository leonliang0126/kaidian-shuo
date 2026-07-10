// 构建版本号：每次 `vite build` 由 vite.config.ts 的 define 注入一个不同的值（时间戳）。
// dev / 未注入时兜底为 'dev'，此时不依赖版本清档逻辑（本地开发无所谓）。
declare const __BUILD_ID__: string | undefined;

export const BUILD_ID: string = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';
