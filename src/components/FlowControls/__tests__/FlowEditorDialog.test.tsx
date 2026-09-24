/**
 * @jest-environment jsdom
 */

// A namespace import, not `import React from 'react'`: tsconfig sets
// allowSyntheticDefaultImports without esModuleInterop, so the default import
// type-checks but is undefined at runtime under ts-jest's CommonJS output.
// Only kept in scope here to satisfy eslint's react-in-jsx-scope rule; this
// file never dereferences it directly.
import * as React from 'react';
// jest.config.js has no global setupFilesAfterEnv registering jest-dom's
// matchers (toBeInTheDocument/toBeEnabled/toBeDisabled/toHaveAttribute), and
// jest.config.js must not be edited — so this file imports it directly for
// its own side effect (extending `expect`) instead.
import '@testing-library/jest-dom';
import { screen, within } from '@testing-library/react';
import { InitialData } from 'src/types';
import { renderWithProviders } from 'src/utils/testing/renderWithProviders';
import { FlowEditorDialog } from '../FlowEditorDialog';

// Two model items joined by one connector: the minimum a flow step needs,
// since a FlowStep only stores a connectorId and findFlowStepConnector
// resolves it against the current view's connectors (src/utils/flow.ts).
// `icons`/`colors` are required by the InitialData type (Model & { ... }),
// even though renderWithProviders would otherwise fall back to INITIAL_DATA's
// empty defaults for them — so both are spelled out empty here explicitly.
const baseModel: Pick<InitialData, 'icons' | 'colors' | 'items' | 'views'> = {
  icons: [],
  colors: [],
  items: [
    { id: 'item-a', name: 'Item A' },
    { id: 'item-b', name: 'Item B' }
  ],
  views: [
    {
      id: 'view-1',
      name: 'View 1',
      items: [
        { id: 'item-a', tile: { x: 0, y: 0 } },
        { id: 'item-b', tile: { x: 1, y: 0 } }
      ],
      connectors: [
        {
          id: 'connector-1',
          anchors: [
            { id: 'anchor-1', ref: { item: 'item-a' } },
            { id: 'anchor-2', ref: { item: 'item-b' } }
          ]
        }
      ]
    }
  ]
};

// A LIST flow: neither step declares `next`, so resolveNextSteps falls back
// to array order (src/utils/flow.ts) — this is what hasExplicitSuccessors
// treats as a "list" flow.
const listFlowData: InitialData = {
  ...baseModel,
  title: 'List flow fixture',
  flows: [
    {
      id: 'flow-1',
      name: 'Flow 1',
      steps: [
        { id: 'step-1', connectorId: 'connector-1', direction: 'REQUEST' },
        { id: 'step-2', connectorId: 'connector-1', direction: 'RESPONSE' }
      ]
    }
  ]
};

// A GRAPH flow: step-1 declares `next`, so hasExplicitSuccessors is true for
// the whole flow and resolveNextSteps never falls back to array order for
// ANY step in it (src/utils/flow.ts) — this is exactly why reordering must
// be disabled once a single step opts in.
const graphFlowData: InitialData = {
  ...baseModel,
  title: 'Graph flow fixture',
  flows: [
    {
      id: 'flow-1',
      name: 'Flow 1',
      steps: [
        {
          id: 'step-1',
          connectorId: 'connector-1',
          direction: 'REQUEST',
          next: ['step-2']
        },
        {
          id: 'step-2',
          connectorId: 'connector-1',
          direction: 'RESPONSE',
          next: []
        }
      ]
    }
  ]
};

// The reorder up/down IconButtons in FlowEditorDialog.tsx render no
// accessible name and no `aria-label` — only a conditional `title` that is
// only ever set while disabled (isGraphFlow). That is a genuine
// accessibility gap in the current markup (see the report; left unfixed
// here — production code is out of scope for this test), but it also means
// no name- or title-based query can find the ENABLED buttons, since they
// carry no title at all in that state.
//
// Instead of falling back to a CSS class or a test id, each step is located
// by its row (`role="listitem"`, from MUI's <ListItem>; the flows list on
// the left uses <ListItemButton> directly, which does not render this role,
// so only the two step rows match), and then by plain button role within
// that row. Each row renders exactly four buttons in a fixed order — Up,
// Down, Edit, Delete (see the secondaryAction Stack in
// FlowEditorDialog.tsx) — the same order a sighted or keyboard user
// encounters them in, so `buttons[0]`/`buttons[1]` are the row's Up/Down
// buttons. This was confirmed empirically against the rendered DOM before
// being relied on here.
//
// With exactly two steps, only ONE up button and ONE down button are ever
// enabled in a list flow: step 1 (index 0) can only move down, and step 2
// (index 1, the last step) can only move up. Both of the other two
// (step 1's up, step 2's down) are unconditionally disabled by the
// first/last boundary check regardless of graph/list, so they would not
// distinguish the behaviour under test. Asserting on step 1's down button
// and step 2's up button isolates exactly the `isGraphFlow` condition.
const getReorderButtons = () => {
  const rows = screen.getAllByRole('listitem');
  const [step1Row, step2Row] = rows;

  const step1Buttons = within(step1Row).getAllByRole('button');
  const step2Buttons = within(step2Row).getAllByRole('button');

  return {
    step1DownButton: step1Buttons[1],
    step2UpButton: step2Buttons[0]
  };
};

describe('FlowEditorDialog', () => {
  test('reorder buttons are enabled for a LIST flow (no step declares next)', async () => {
    renderWithProviders(<FlowEditorDialog onClose={() => {}} />, listFlowData);

    expect(await screen.findByText('Flows')).toBeInTheDocument();

    const { step1DownButton, step2UpButton } = getReorderButtons();

    expect(step1DownButton).toBeEnabled();
    expect(step2UpButton).toBeEnabled();

    // Neither button carries a title while enabled — see the block comment
    // above getReorderButtons for why this is a pre-existing accessibility
    // gap, not something added here.
    expect(step1DownButton).not.toHaveAttribute('title');
    expect(step2UpButton).not.toHaveAttribute('title');
  });

  test('reorder buttons are disabled for a GRAPH flow (a step declares next)', async () => {
    renderWithProviders(<FlowEditorDialog onClose={() => {}} />, graphFlowData);

    expect(await screen.findByText('Flows')).toBeInTheDocument();

    const { step1DownButton, step2UpButton } = getReorderButtons();

    expect(step1DownButton).toBeDisabled();
    expect(step2UpButton).toBeDisabled();

    expect(step1DownButton).toHaveAttribute(
      'title',
      'This flow sets its own step order through successors'
    );
    expect(step2UpButton).toHaveAttribute(
      'title',
      'This flow sets its own step order through successors'
    );
  });
});
