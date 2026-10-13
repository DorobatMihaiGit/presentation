"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; onError: (error: unknown) => void };

/**
 * Keeps a failing stage (a shader that does not compile, a context that is
 * lost while mounting, a chunk that does not load) from taking the page
 * down: R3F rethrows errors from inside the canvas into this tree, and the
 * stage falls back to the posters, the same path as a lost WebGL context.
 */
export class StageErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
