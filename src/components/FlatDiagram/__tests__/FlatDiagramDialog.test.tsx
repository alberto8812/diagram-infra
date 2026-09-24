/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import '@testing-library/jest-dom';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { InitialData } from 'src/types';
import { renderWithProviders } from 'src/utils/testing/renderWithProviders';
import { FlatDiagramDialog } from '../FlatDiagramDialog';
import {
  downloadFlatDiagramSvg,
  downloadFlatDiagramPng
} from '../exportFlatDiagram';

// The actual serialization/rasterisation is covered in
// exportFlatDiagram.test.ts; this only checks that the dialog's buttons call
// through to it with the rendered <svg> and handle the result.
jest.mock('../exportFlatDiagram', () => {
  return {
    downloadFlatDiagramSvg: jest.fn(),
    downloadFlatDiagramPng: jest.fn(() => {
      return Promise.resolve();
    })
  };
});

const modelData: InitialData = {
  title: 'Flat diagram dialog fixture',
  icons: [],
  colors: [],
  items: [{ id: 'solo', name: 'Standalone service' }],
  views: [
    {
      id: 'view-1',
      name: 'View 1',
      items: [{ id: 'solo', tile: { x: 0, y: 0 } }]
    }
  ]
};

describe('FlatDiagramDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders download and close controls', async () => {
    renderWithProviders(<FlatDiagramDialog onClose={jest.fn()} />, modelData);

    expect(await screen.findByTestId('flat-diagram')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Download SVG' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Download PNG' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  test('clicking Download SVG serializes the rendered svg element', async () => {
    renderWithProviders(<FlatDiagramDialog onClose={jest.fn()} />, modelData);

    await screen.findByTestId('flat-diagram');

    fireEvent.click(screen.getByRole('button', { name: 'Download SVG' }));

    expect(downloadFlatDiagramSvg).toHaveBeenCalledTimes(1);
    expect(downloadFlatDiagramSvg).toHaveBeenCalledWith(
      expect.any(SVGSVGElement)
    );
  });

  test('clicking Download PNG disables the button until the export settles', async () => {
    renderWithProviders(<FlatDiagramDialog onClose={jest.fn()} />, modelData);

    await screen.findByTestId('flat-diagram');

    const pngButton = screen.getByRole('button', { name: 'Download PNG' });
    fireEvent.click(pngButton);

    expect(downloadFlatDiagramPng).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Download PNG' })
      ).not.toBeDisabled();
    });
  });

  test('shows an error message when the PNG export fails', async () => {
    (downloadFlatDiagramPng as jest.Mock).mockReturnValueOnce(
      Promise.reject(new Error('boom'))
    );

    renderWithProviders(<FlatDiagramDialog onClose={jest.fn()} />, modelData);

    await screen.findByTestId('flat-diagram');

    fireEvent.click(screen.getByRole('button', { name: 'Download PNG' }));

    expect(
      await screen.findByText(/Could not export diagram: boom/)
    ).toBeInTheDocument();
  });
});
