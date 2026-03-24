import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: "40px",
          textAlign: "center",
          background: "var(--bg-primary, #0f1117)",
          color: "var(--text-primary, #e1e4ea)",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
        }}>
          <h1 style={{ fontSize: "24px", color: "var(--red, #ef4444)" }}>Something went wrong</h1>
          <p style={{ color: "var(--text-dim, #8b8fa3)", maxWidth: "500px" }}>
            The application encountered an unexpected error. This may be caused by a network issue or contract mismatch.
          </p>
          <pre style={{
            background: "var(--bg-tertiary, #1a1d27)",
            padding: "12px 16px",
            borderRadius: "8px",
            fontSize: "12px",
            maxWidth: "600px",
            overflow: "auto",
            color: "var(--red, #ef4444)",
          }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{
              padding: "10px 24px",
              background: "var(--blue, #6366f1)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
