'use client';
import React from 'react';

interface Props { fallback: React.ReactNode; children: React.ReactNode }

export class RingsErrorBoundary extends React.Component<Props, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } { return { failed: true }; }
  componentDidCatch(): void { /* WebGL or chunk-load failure: static rings are shown */ }
  render(): React.ReactNode { return this.state.failed ? this.props.fallback : this.props.children; }
}
