import React, { useRef, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Alert
} from '@mui/material';
import { describeExportError } from 'src/utils/exportOptions';
import { FlatDiagram } from './FlatDiagram';
import {
  downloadFlatDiagramSvg,
  downloadFlatDiagramPng
} from './exportFlatDiagram';

interface Props {
  onClose: () => void;
}

// Read-only dialog for the flat/architecture diagram view — follows the same
// shape as ExportImageDialog (open Dialog > DialogTitle > DialogContent),
// and offers the same kind of download options. Unlike ExportImageDialog,
// this view needs no re-render-to-canvas step: the diagram is already plain
// SVG with inline data-URI icons, so both formats are produced straight from
// the rendered <svg> (see exportFlatDiagram.ts). The scrollable Box lets a
// diagram taller or wider than the dialog still be fully reachable instead
// of being silently clipped.
export const FlatDiagramDialog = ({ onClose }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const getSvg = (): SVGSVGElement | null => {
    return containerRef.current?.querySelector('svg') ?? null;
  };

  const handleDownloadSvg = () => {
    const svg = getSvg();
    if (!svg) return;

    setExportError(null);

    try {
      downloadFlatDiagramSvg(svg);
    } catch (err: unknown) {
      console.error('[flat-diagram] could not export SVG', err);
      setExportError(describeExportError(err));
    }
  };

  const handleDownloadPng = () => {
    const svg = getSvg();
    if (!svg) return;

    setExportError(null);
    setIsExportingPng(true);

    downloadFlatDiagramPng(svg)
      .catch((err: unknown) => {
        console.error('[flat-diagram] could not export PNG', err);
        setExportError(describeExportError(err));
      })
      .finally(() => {
        setIsExportingPng(false);
      });
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle>Flat architecture diagram</DialogTitle>
      <DialogContent>
        {exportError !== null && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Could not export diagram: {exportError}
          </Alert>
        )}
        <Box
          ref={containerRef}
          sx={{
            overflow: 'auto',
            maxHeight: '70vh',
            bgcolor: 'common.white'
          }}
        >
          <FlatDiagram />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          variant="text"
          onClick={handleDownloadSvg}
          disabled={isExportingPng}
        >
          Download SVG
        </Button>
        <Button
          variant="text"
          onClick={handleDownloadPng}
          disabled={isExportingPng}
        >
          {isExportingPng ? 'Exporting…' : 'Download PNG'}
        </Button>
        <Button variant="text" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
