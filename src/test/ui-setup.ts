/**
 * jsdom UI-test setup — imported ONLY by component/interaction tests (never by the
 * node/DB suite), so the existing node-environment tests stay untouched.
 *
 * Every UI wiring test must begin with the docblock:  // @vitest-environment jsdom
 * and import from `src/test/render` (which pulls this in). This registers the
 * jest-dom matchers (toBeInTheDocument, toBeDisabled, toHaveValue, …) and RTL
 * auto-cleanup between tests.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
