import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const rootEl = document.getElementById('root') as HTMLElement;
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

// 标记已成功挂载，供 index.html 的兜底脚本判断是否仍空白（捕获模块加载/解析失败）。
(window as unknown as { __rootMounted?: boolean }).__rootMounted = true;
