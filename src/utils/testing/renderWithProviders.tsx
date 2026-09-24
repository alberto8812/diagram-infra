// ---------------------------------------------------------------------------
// Why jest's global `testEnvironment` stays "node", and why this harness
// (and every test file that uses it) opts into jsdom per-file instead.
//
// jest.config.js sets `testEnvironment: "node"` for the WHOLE suite. That is
// deliberate and must not change here or anywhere else: this repo already has
// a test — src/examples/__tests__/persistence.test.ts — that builds its own
// FAKE `window` object (with a hand-rolled localStorage stub) specifically to
// exercise src/examples/persistence.ts's localStorage-backed save/restore
// logic under Node, where no `window` exists at all unless the test creates
// one itself. If the global environment were switched to jsdom, a REAL
// jsdom `window` (with its own, real localStorage) would silently exist for
// that test too, and the fake window it constructs would either collide with
// or be shadowed by the real one — quietly changing what that test actually
// exercises, without a single line of that test changing. A global flip is
// invisible at the call site and would defeat the whole point of that test's
// fake window.
//
// So instead, only the individual test files that actually need a DOM (this
// harness renders real React components with react-dom, which needs one) opt
// in locally, with a docblock at the very top of the file:
//
//   /**
//    * @jest-environment jsdom
//    */
//
// This keeps the default ("node") safe for every test that doesn't need a
// DOM — including persistence.test.ts's fake-window test — while still
// letting component tests (like the one built on top of this harness) run
// under a real jsdom `window`/`document`. See
// src/examples/__tests__/useCurrentDiagram.test.tsx for another test file
// that already follows this same per-file opt-in pattern.
// ---------------------------------------------------------------------------

// A namespace import, not `import React from 'react'`: tsconfig sets
// allowSyntheticDefaultImports without esModuleInterop, so the default import
// type-checks but is undefined at runtime under ts-jest's CommonJS output.
// This file only needs React for type references (React.ReactElement,
// useEffect), never as a dereferenced default export, so the namespace form
// is both correct and consistent with the rest of the codebase's tests.
import * as React from 'react';
import { useEffect } from 'react';
// This file is test infrastructure (only ever imported from test files), not
// shipped application code, so pulling a devDependency in here is correct —
// it just does not match eslint-config-airbnb's `**/__tests__/**`-style
// globs for where that is normally allowed, since this helper intentionally
// lives next to `src/utils` rather than inside a `__tests__` directory.
// eslint-disable-next-line import/no-extraneous-dependencies
import { render, RenderResult } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from 'src/styles/theme';
import { ModelProvider } from 'src/stores/modelStore';
import { SceneProvider } from 'src/stores/sceneStore';
import { UiStateProvider } from 'src/stores/uiStateStore';
import { useInitialDataManager } from 'src/hooks/useInitialDataManager';
import { INITIAL_DATA } from 'src/config';
import { InitialData } from 'src/types';

interface SeedLoaderProps {
  initialData: InitialData;
  // Always exactly one element (the `ui` passed to renderWithProviders
  // below), never a list — so this can be returned as-is once ready, with no
  // wrapping Fragment (react/jsx-no-useless-fragment).
  children: React.ReactElement;
}

// Seeds the model through the exact same path src/Isoflow.tsx's inner `App`
// component uses: useInitialDataManager().load(...) inside a useEffect, then
// gate rendering on `isReady` the same way `App` does
// (`if (!initialDataManager.isReady) return null;`). This is deliberately
// not a shortcut/parallel seeding mechanism — ModelProvider takes no props
// and always builds its store from the module-level INITIAL_DATA
// (src/stores/modelStore.tsx), so `load` is the only real way data gets in.
const SeedLoader = ({ initialData, children }: SeedLoaderProps) => {
  const { load, isReady } = useInitialDataManager();

  useEffect(() => {
    load({ ...INITIAL_DATA, ...initialData });
  }, [initialData, load]);

  if (!isReady) return null;

  return children;
};

// Mounts `ui` inside the same provider nesting and theme as src/Isoflow.tsx
// (ThemeProvider > ModelProvider > SceneProvider > UiStateProvider), seeded
// with caller-supplied `initialData`. Returns exactly what
// @testing-library/react's `render()` returns, so callers keep using
// `screen`/`within` etc. directly instead of a wrapped API.
export const renderWithProviders = (
  ui: React.ReactElement,
  initialData: InitialData
): RenderResult => {
  return render(
    <ThemeProvider theme={theme}>
      <ModelProvider>
        <SceneProvider>
          <UiStateProvider>
            <SeedLoader initialData={initialData}>{ui}</SeedLoader>
          </UiStateProvider>
        </SceneProvider>
      </ModelProvider>
    </ThemeProvider>
  );
};
