import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset: () => void;
}

interface ErrorBoundaryState {
  failed: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Bluff Tavern render failure', error, info);
  }

  override render() {
    if (!this.state.failed) return this.props.children;

    return <main className="error-boundary" role="alert">
      <div className="panel error-boundary__panel">
        <p className="eyebrow">对局出现异常</p>
        <h1>状态仍保存在服务器</h1>
        <p>可以尝试重新连接当前房间，或者返回大厅重新加入。</p>
        <button className="button button--primary" onClick={() => { this.setState({ failed: false }); this.props.onReset(); }}>重新连接</button>
        <button className="button button--secondary" onClick={() => { localStorage.removeItem('bluff-tavern.session-token'); location.reload(); }}>返回大厅</button>
      </div>
    </main>;
  }
}
