/**
 * @jest-environment jsdom
 */

// A namespace import, not `import React from 'react'`: tsconfig sets
// allowSyntheticDefaultImports without esModuleInterop for source files
// generally, but component test files in this repo already follow this
// pattern (see FlowEditorDialog.test.tsx) — kept in scope only to satisfy
// eslint's react-in-jsx-scope rule; never dereferenced directly.
import * as React from 'react';
// jest.config.js has no global setupFilesAfterEnv registering jest-dom's
// matchers, and jest.config.js must not be edited — so this file imports it
// directly for its own side effect (extending `expect`), same as
// FlowEditorDialog.test.tsx.
import '@testing-library/jest-dom';
import { screen, within } from '@testing-library/react';
import { InitialData } from 'src/types';
import { renderWithProviders } from 'src/utils/testing/renderWithProviders';
import { FlatDiagram } from '../FlatDiagram';

// One view exercising every case the task asks for:
// - 'backend-a' and 'backend-b' share the "Backend" group.
// - 'solo' has no group at all (the ungrouped column).
// - 'u1'/'u2' are both literally named "Untitled"; 'u3' has a blank name.
//   All three land in the ungrouped column and must stay distinguishable.
// - 'connector-real' joins two laid-out items (backend-a -> backend-b) and
//   must draw a line.
// - 'connector-tile' has its last anchor pointing at a tile instead of an
//   item, and must NOT draw a line.
const baseModel: Pick<InitialData, 'icons' | 'colors' | 'items' | 'views'> = {
  icons: [],
  colors: [],
  items: [
    { id: 'backend-a', name: 'API', group: 'Backend' },
    { id: 'backend-b', name: 'Worker', group: 'Backend' },
    { id: 'solo', name: 'Standalone service' },
    { id: 'u1', name: 'Untitled' },
    { id: 'u2', name: 'Untitled' },
    { id: 'u3', name: '' }
  ],
  views: [
    {
      id: 'view-1',
      name: 'View 1',
      items: [
        { id: 'backend-a', tile: { x: 0, y: 0 } },
        { id: 'backend-b', tile: { x: 1, y: 0 } },
        { id: 'solo', tile: { x: 2, y: 0 } },
        { id: 'u1', tile: { x: 3, y: 0 } },
        { id: 'u2', tile: { x: 4, y: 0 } },
        { id: 'u3', tile: { x: 5, y: 0 } }
      ],
      connectors: [
        {
          id: 'connector-real',
          anchors: [
            { id: 'anchor-1', ref: { item: 'backend-a' } },
            { id: 'anchor-2', ref: { item: 'backend-b' } }
          ]
        },
        {
          id: 'connector-tile',
          anchors: [
            { id: 'anchor-3', ref: { item: 'backend-a' } },
            { id: 'anchor-4', ref: { tile: { x: 9, y: 9 } } }
          ]
        }
      ]
    }
  ]
};

const modelData: InitialData = {
  ...baseModel,
  title: 'Flat diagram fixture'
};

describe('FlatDiagram', () => {
  test('items of the same group render inside one labelled container', async () => {
    renderWithProviders(<FlatDiagram />, modelData);

    const group = await screen.findByTestId('flat-diagram-group-Backend');

    expect(
      within(group).getByTestId('flat-diagram-group-border-Backend')
    ).toBeInTheDocument();
    expect(within(group).getByText('Backend')).toBeInTheDocument();
    expect(
      within(group).getByTestId('flat-diagram-item-backend-a')
    ).toBeInTheDocument();
    expect(
      within(group).getByTestId('flat-diagram-item-backend-b')
    ).toBeInTheDocument();
  });

  test('an ungrouped item renders with no container and no group label', async () => {
    renderWithProviders(<FlatDiagram />, modelData);

    const ungroupedGroup = await screen.findByTestId(
      'flat-diagram-group-__ungrouped__'
    );

    expect(
      within(ungroupedGroup).getByTestId('flat-diagram-item-solo')
    ).toBeInTheDocument();
    // No dashed border and no group label for the ungrouped column.
    expect(ungroupedGroup.querySelector('rect')).toBeNull();
    expect(
      within(ungroupedGroup).queryByTestId('flat-diagram-group-label')
    ).toBeNull();
  });

  test('a connector between two laid-out items draws a line; one anchored to a tile does not', async () => {
    renderWithProviders(<FlatDiagram />, modelData);

    expect(
      await screen.findByTestId('flat-diagram-connector-connector-real')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('flat-diagram-connector-connector-tile')
    ).toBeNull();
  });

  test('duplicate and blank item names get distinct, readable labels', async () => {
    renderWithProviders(<FlatDiagram />, modelData);

    const ungroupedGroup = await screen.findByTestId(
      'flat-diagram-group-__ungrouped__'
    );

    // Both literal "Untitled" items and the blank-named item are numbered
    // together, in view order, instead of rendering as indistinguishable
    // unlabelled boxes. Scoped to the <text> label element (`selector:
    // 'text'`) since each item's <title> (a hover tooltip, not the visible
    // label) carries the same raw name and would otherwise also match.
    expect(
      within(
        within(ungroupedGroup).getByTestId('flat-diagram-item-u1')
      ).getByText('Untitled (1)', { selector: 'text' })
    ).toBeInTheDocument();
    expect(
      within(
        within(ungroupedGroup).getByTestId('flat-diagram-item-u2')
      ).getByText('Untitled (2)', { selector: 'text' })
    ).toBeInTheDocument();
    expect(
      within(
        within(ungroupedGroup).getByTestId('flat-diagram-item-u3')
      ).getByText('Untitled (3)', { selector: 'text' })
    ).toBeInTheDocument();

    // A uniquely-named item keeps its plain name, no suffix noise.
    expect(
      within(
        within(ungroupedGroup).getByTestId('flat-diagram-item-solo')
      ).getByText('Standalone service', { selector: 'text' })
    ).toBeInTheDocument();
  });
});
