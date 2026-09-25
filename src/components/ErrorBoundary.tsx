import { Component } from "react";
import type { ReactNode } from "react";

interface Props {
  title: string;
  message: string;
  reloadLabel: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * BUG-12: Fängt unerwartete Render-/Runtime-Fehler ab, damit ein einzelner
 * Fehler nicht die gesamte UI dauerhaft blockiert. Zeigt stattdessen eine
 * kontrollierte Fehleransicht mit Neu-laden-Aktion.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: unknown): void {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert">
          <h2 className="error-boundary__title">{this.props.title}</h2>
          <p>{this.props.message}</p>
          <button
            type="button"
            className="cv-continue-btn"
            onClick={() => window.location.reload()}
          >
            {this.props.reloadLabel}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
