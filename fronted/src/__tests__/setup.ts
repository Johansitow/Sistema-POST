import '@testing-library/jest-dom';

// jsdom no implementa ResizeObserver; stub para que los componentes que lo usan no fallen.
if (typeof ResizeObserver === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).ResizeObserver = class ResizeObserver {
    observe()    { /* no-op */ }
    unobserve()  { /* no-op */ }
    disconnect() { /* no-op */ }
  };
}
