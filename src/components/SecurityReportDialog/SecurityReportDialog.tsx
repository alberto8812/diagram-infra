import React, { useCallback, useMemo } from 'react';
import {
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
import { useIssues } from 'src/hooks/useIssues';
import { generateThreats, Threat, ThreatStatus } from 'src/security/threats';
import { mapFindingsToControls } from 'src/compliance/controls';
import {
  buildSecurityReportJson,
  buildSecurityReportMarkdown
} from 'src/security/report';
import { downloadFile } from 'src/utils';

interface Props {
  onClose: () => void;
}

const STATUS_COLORS: Record<ThreatStatus, 'error' | 'success' | 'default'> = {
  open: 'error',
  mitigated: 'success',
  unknown: 'default'
};

const filenameFor = (extension: string) => {
  return `isoflow-security-report-${new Date().toISOString()}.${extension}`;
};

export const SecurityReportDialog = ({ onClose }: Props) => {
  const items = useModelStore((state) => {
    return state.items;
  });
  const views = useModelStore((state) => {
    return state.views;
  });
  const title = useModelStore((state) => {
    return state.title;
  });

  const issues = useIssues();

  const itemsById = useMemo(() => {
    return new Map(
      items.map((item) => {
        return [item.id, item] as const;
      })
    );
  }, [items]);

  const threats = useMemo(() => {
    return generateThreats({ items, views });
  }, [items, views]);

  const controlMappings = useMemo(() => {
    return mapFindingsToControls(issues, threats);
  }, [issues, threats]);

  const resolveElementLabel = useCallback(
    (targetType: Threat['targetType'], targetId: string) => {
      if (targetType === 'ITEM') {
        return itemsById.get(targetId)?.name ?? targetId;
      }

      return `Connector ${targetId}`;
    },
    [itemsById]
  );

  const threatsByElement = useMemo(() => {
    const groups = new Map<
      string,
      { label: string; targetType: Threat['targetType']; threats: Threat[] }
    >();

    threats.forEach((threat) => {
      const key = `${threat.viewId}:${threat.targetType}:${threat.targetId}`;
      const existing = groups.get(key);

      if (existing) {
        existing.threats.push(threat);
        return;
      }

      groups.set(key, {
        label: resolveElementLabel(threat.targetType, threat.targetId),
        targetType: threat.targetType,
        threats: [threat]
      });
    });

    return [...groups.values()];
  }, [threats, resolveElementLabel]);

  const reportInput = useCallback(() => {
    return {
      generatedAt: new Date().toISOString(),
      diagramTitle: title,
      issues,
      threats,
      controlMappings,
      resolveElementLabel
    };
  }, [title, issues, threats, controlMappings, resolveElementLabel]);

  const downloadMarkdown = useCallback(() => {
    const markdown = buildSecurityReportMarkdown(reportInput());
    const blob = new Blob([markdown], {
      type: 'text/markdown;charset=utf-8'
    });
    downloadFile(blob, filenameFor('md'));
  }, [reportInput]);

  const downloadJson = useCallback(() => {
    const json = buildSecurityReportJson(reportInput());
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    downloadFile(blob, filenameFor('json'));
  }, [reportInput]);

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Security report</DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          <Stack direction="row" spacing={1}>
            <Chip
              label={`${issues.length} lint issue${issues.length === 1 ? '' : 's'}`}
            />
            <Chip
              color="error"
              label={`${
                threats.filter((t) => {
                  return t.status === 'open';
                }).length
              } open threats`}
            />
            <Chip
              color="success"
              label={`${
                threats.filter((t) => {
                  return t.status === 'mitigated';
                }).length
              } mitigated`}
            />
            <Chip
              label={`${
                threats.filter((t) => {
                  return t.status === 'unknown';
                }).length
              } unknown`}
            />
          </Stack>

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Threats by element
            </Typography>
            {threatsByElement.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No threats generated for this diagram.
              </Typography>
            )}
            <Stack spacing={2}>
              {threatsByElement.map((group) => {
                return (
                  <Box key={`${group.targetType}-${group.label}`}>
                    <Typography variant="body2" fontWeight={600}>
                      {group.label}
                    </Typography>
                    <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                      {group.threats.map((threat) => {
                        return (
                          <Stack
                            key={threat.id}
                            direction="row"
                            spacing={1}
                            alignItems="center"
                          >
                            <Chip
                              size="small"
                              color={STATUS_COLORS[threat.status]}
                              label={`${threat.category} · ${threat.status}`}
                            />
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {threat.title}
                            </Typography>
                          </Stack>
                        );
                      })}
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Compliance matrix
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Framework</TableCell>
                  <TableCell>Control</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell align="right">Findings</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {controlMappings.map((mapping) => {
                  return (
                    <TableRow
                      key={`${mapping.control.framework}-${mapping.control.controlId}`}
                    >
                      <TableCell>
                        {mapping.control.framework} ({mapping.control.version})
                      </TableCell>
                      <TableCell>{mapping.control.controlId}</TableCell>
                      <TableCell>{mapping.control.title}</TableCell>
                      <TableCell align="right">
                        {mapping.findings.length}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
