// 顶层错误边界：任何渲染期异常都不再白屏，而是展示可读的中文错误提示，
// 便于真机/QA 直接看到崩溃原因（而非一片空白）。
import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error?.message || String(error) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 仅记录到控制台，避免在受限 webview 中再次抛错
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-[var(--bg)]">
        <div className="w-full max-w-[480px] rounded-2xl bg-card shadow-card p-5 text-center">
          <div className="text-2xl mb-2">😵‍💫</div>
          <h1 className="text-lg font-bold text-ink">页面开小差了</h1>
          <p className="text-sm text-sub mt-2 leading-relaxed">
            很抱歉，页面遇到了一处错误。错误已记录，你可以尝试重试，或把下方信息反馈给开发者。
          </p>
          <pre className="mt-3 text-left text-xs text-risk/90 bg-risk/[0.06] rounded-lg p-3 whitespace-pre-wrap break-words max-h-[40vh] overflow-y-auto">
            {this.state.message}
          </pre>
          <button
            onClick={this.handleRetry}
            className="mt-4 w-full rounded-full bg-primary text-white font-semibold py-3 text-base active:bg-primary-dark"
          >
            重试
          </button>
        </div>
      </div>
    );
  }
}
