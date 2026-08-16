import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// `globals` is not enabled, so Testing Library's automatic cleanup never
// registers. Unmount rendered trees between tests to keep the DOM isolated.
afterEach(() => {
  cleanup();
});
