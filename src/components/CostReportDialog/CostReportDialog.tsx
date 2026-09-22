import React, { useCallback, useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import { useModelStore } from 'src/stores/modelStore';
import { estimateDiagramCost, catalog } from 'src/cost';
import { CostGroupTotal } from 'src/cost/types';
import { buildCostReportJson, buildCostReportMarkdown } from 'src/cost/report';
import { downloadFile } from 'src/utils';

interface Props {
  onClose: () => void;
}

// Compact, filesystem-safe timestamp (colons in the raw ISO string are
// invalid in Windows filenames): 20260922T153045. Mirrors
// SecurityReportDialog's helper of the same name/shape.
const compactTimestamp = (date: Date): string => {
  return date
    .toISOString()
    .replace(/[:-]/g, '')
    .replace(/\.\d+Z$/, '');
};

const filenameFor = (extension: string) => {
  return `isoflow-cost-report-${compactTimestamp(new Date())}.${extension}`;
};

const GroupTable = ({
  title,
  groups,
  currency
}: {
  title: string;
  groups: CostGroupTotal[];
  currency: string;
}) => {
  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        {title}
      </Typography>
      {groups.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No priced items.
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell align="right">Monthly</TableCell>
              <TableCell align="right">Items</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {groups.map((group) => {
              return (
                <TableRow key={group.id}>
                  <TableCell>
                    {group.label}
                    {group.hasApproximate && (
                      <Chip
                        size="small"
                        label="approximate"
                        sx={{ ml: 1 }}
                        variant="outlined"
                      />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {currency} {group.monthlyUsd.toFixed(2)}
                  </TableCell>
                  <TableCell align="right">{group.itemCount}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Box>
  );
};

// Reachable from the toolbar (see the "Cost" button in ToolMenu.tsx), same
// pattern as SecurityReportDialog: totals per view/zone/environment from a
// local, offline price catalog (P4 cost estimation, src/cost) — never a
// live quote. The catalog's own approximate/last-updated disclaimer is
// always shown, not just when a figure had to fall back.
export const CostReportDialog = ({ onClose }: Props) => {
  const items = useModelStore((state) => {
    return state.items;
  });
  const views = useModelStore((state) => {
    return state.views;
  });
  const title = useModelStore((state) => {
    return state.title;
  });

  const estimate = useMemo(() => {
    return estimateDiagramCost({ items, views }, catalog);
  }, [items, views]);

  const reportInput = useCallback(() => {
    return {
      generatedAt: new Date().toISOString(),
      diagramTitle: title,
      estimate
    };
  }, [title, estimate]);

  const downloadMarkdown = useCallback(() => {
    const markdown = buildCostReportMarkdown(reportInput());
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    downloadFile(blob, filenameFor('md'));
  }, [reportInput]);

  const downloadJson = useCallback(() => {
    const json = buildCostReportJson(reportInput());
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    downloadFile(blob, filenameFor('json'));
  }, [reportInput]);

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Cost report</DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          <Alert severity="info">
            Approximate, offline estimate from a local price catalog (last
            updated {estimate.lastUpdated}) — on-demand list prices, never a
            quote. Re-check before using this for a real budget.
          </Alert>

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6">
              {estimate.currency} {estimate.totalMonthlyUsd.toFixed(2)}/month
            </Typography>
            {estimate.hasApproximate && (
              <Chip size="small" label="includes approximate figures" />
            )}
            {estimate.unpriced.length > 0 && (
              <Chip
                size="small"
                color="warning"
                label={`${estimate.unpriced.length} unpriced`}
              />
            )}
          </Stack>

          <GroupTable
            title="By view"
            groups={estimate.perView}
            currency={estimate.currency}
          />
          <Divider />
          <GroupTable
            title="By zone"
            groups={estimate.perZone}
            currency={estimate.currency}
          />
          <Divider />
          <GroupTable
            title="By environment"
            groups={estimate.perEnvironment}
            currency={estimate.currency}
          />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Unpriced nodes
            </Typography>
            {estimate.unpriced.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                None — every sized node matched the catalog.
              </Typography>
            ) : (
              <Stack spacing={0.5}>
                {estimate.unpriced.map((node) => {
                  return (
                    <Typography key={node.itemId} variant="body2">
                      <strong>{node.itemName}</strong>: {node.reasons.join(' ')}
                    </Typography>
                  );
                })}
              </Stack>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose}>
          Close
        </Button>
        <Button onClick={downloadJson}>Download JSON</Button>
        <Button onClick={downloadMarkdown}>Download Markdown</Button>
      </DialogActions>
    </Dialog>
  );
};
