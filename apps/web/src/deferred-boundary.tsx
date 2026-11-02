import { Component, Suspense, type ReactNode } from 'react';

/** Keep the owner's dismissal and recovery controls outside a deferred body. */
export class DeferredBoundary extends Component<{ children: ReactNode; loading: ReactNode; unavailable: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() {
    return this.state.failed ? this.props.unavailable : <Suspense fallback={this.props.loading}>{this.props.children}</Suspense>;
  }
}
