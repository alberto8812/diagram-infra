import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button
} from '@mui/material';
import { FlatDiagram } from './FlatDiagram';

interface Props {
  onClose: () => void;
}

// Read-only dialog for the flat/architecture diagram view — follows the same
// shape as ExportImageDialog (open Dialog > DialogTitle > DialogContent),
// but has no export controls of its own: exporting this view is a later
// slice. The scrollable Box lets a diagram taller or wider than the dialog
// still be fully reachable instead of being silently clipped.
export const FlatDiagramDialog = ({ onClose }: Props) => {
  return (
    <Dialog open onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle>Flat architecture diagram</DialogTitle>
      <DialogContent>
        <Box
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
        <Button variant="text" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
