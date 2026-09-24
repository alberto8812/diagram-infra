import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Stack,
  Divider,
  Button,
  TextField,
  Select,
  MenuItem,
  List,
  ListItemButton,
  ListItem,
  ListItemText,
  IconButton,
  Typography
} from '@mui/material';
import {
  Add as AddIcon,
  DeleteOutlined as DeleteIcon,
  EditOutlined as EditIcon,
  KeyboardArrowUp as UpIcon,
  KeyboardArrowDown as DownIcon,
  Reply as ReturnPathIcon
} from '@mui/icons-material';
import {
  FlowStep,
  FlowStepDirection,
  flowStepDirectionOptions
} from 'src/types';
import { useModelStore } from 'src/stores/modelStore';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import {
  generateId,
  getConnectorEndpointLabel,
  getMissingReturnPathSteps,
  findFlowStepConnector,
  buildFlowStepUpdates
} from 'src/utils';

interface Props {
  onClose: () => void;
}

const DIRECTION_LABELS: Record<FlowStepDirection, string> = {
  REQUEST: 'Request',
  RESPONSE: 'Response'
};

// Manages flows: create/rename/delete a flow, and add/reorder/delete its
// steps, with an "Add return path" convenience that mirrors the existing
// REQUEST steps as RESPONSE steps (in reverse order). Editable mode only —
// see UiOverlay.tsx.
//
// `selectedFlowId` is only ever looked up with `flows.find(...)` (never the
// throwing `useFlow()` hook), and is reset whenever it no longer resolves
// (e.g. the flow being edited was deleted from the list below), so this
// component never crashes when its selected flow disappears from under it
// (R3-useFlow-throws-on-missing).
export const FlowEditorDialog = ({ onClose }: Props) => {
  const flows = useModelStore((state) => {
    return state.flows ?? [];
  });
  const items = useModelStore((state) => {
    return state.items;
  });
  const views = useModelStore((state) => {
    return state.views;
  });
  const flowPlayback = useUiStateStore((state) => {
    return state.flowPlayback;
  });
  const {
    connectors,
    createFlow,
    updateFlow,
    deleteFlow,
    createFlowStep,
    updateFlowStep,
    deleteFlowStep,
    reorderFlowSteps
  } = useScene();

  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(() => {
    return flowPlayback.flowId ?? flows[0]?.id ?? null;
  });

  useEffect(() => {
    if (selectedFlowId === null) return;

    const stillExists = flows.some((flow) => {
      return flow.id === selectedFlowId;
    });

    if (!stillExists) {
      setSelectedFlowId(flows[0]?.id ?? null);
    }
  }, [flows, selectedFlowId]);

  const selectedFlow = useMemo(() => {
    return flows.find((flow) => {
      return flow.id === selectedFlowId;
    });
  }, [flows, selectedFlowId]);

  const handleCreateFlow = useCallback(() => {
    const id = generateId();

    createFlow({ id, name: `Flow ${flows.length + 1}`, steps: [] });
    setSelectedFlowId(id);
  }, [createFlow, flows.length]);

  const handleDeleteFlow = useCallback(
    (id: string) => {
      deleteFlow(id);
    },
    [deleteFlow]
  );

  const [newConnectorId, setNewConnectorId] = useState('');
  const [newDirection, setNewDirection] =
    useState<FlowStepDirection>('REQUEST');
  const [newLabel, setNewLabel] = useState('');
  const [newDurationMs, setNewDurationMs] = useState('');

  // `null` means the form below is in "add" mode; a step id means it is
  // editing that step instead. The four fields above are shared between
  // both modes — there is only ever one form.
  const [editingStepId, setEditingStepId] = useState<string | null>(null);

  const handleCancelEdit = useCallback(() => {
    setEditingStepId(null);
    setNewConnectorId('');
    setNewDirection('REQUEST');
    setNewLabel('');
    setNewDurationMs('');
  }, []);

  // Switching flows must not leave a stale edit target (and its populated
  // form) pointing at a step that belongs to a different flow.
  useEffect(() => {
    handleCancelEdit();
  }, [selectedFlowId, handleCancelEdit]);

  const handleStartEdit = useCallback((step: FlowStep) => {
    setEditingStepId(step.id);
    setNewConnectorId(step.connectorId);
    setNewDirection(step.direction);
    setNewLabel(step.label ?? '');
    setNewDurationMs(
      step.durationMs !== undefined ? String(step.durationMs) : ''
    );
  }, []);

  const editingStep = useMemo(() => {
    if (!selectedFlow || !editingStepId) return undefined;

    return selectedFlow.steps.find((step) => {
      return step.id === editingStepId;
    });
  }, [selectedFlow, editingStepId]);

  // The picker lists the current view's connectors, but a step being edited
  // may travel a connector that belongs to another view. Leaving that one out
  // made the step uneditable: the clearing effect below blanked the field and
  // the disabled Save button locked the form, so its label and duration could
  // not be changed either. Its own connector is not a new choice the user is
  // making — the step already travels it — so it belongs in the list while
  // that step is open for editing.
  const pickableConnectors = useMemo(() => {
    const editedConnector = findFlowStepConnector(views, editingStep);

    if (!editedConnector) return connectors;

    const alreadyListed = connectors.some((connector) => {
      return connector.id === editedConnector.id;
    });

    return alreadyListed ? connectors : [...connectors, editedConnector];
  }, [connectors, views, editingStep]);

  // If the selected connector falls out of the pickable list — the current
  // view changed, or the connector was deleted — clear the selection instead
  // of letting a stale id through (R3-editor-connectors-view-scoped).
  useEffect(() => {
    if (newConnectorId === '') return;

    const stillExists = pickableConnectors.some((connector) => {
      return connector.id === newConnectorId;
    });

    if (!stillExists) {
      setNewConnectorId('');
    }
  }, [pickableConnectors, newConnectorId]);

  const handleAddStep = useCallback(() => {
    if (!selectedFlow || !newConnectorId) return;

    // Defense in depth alongside the disabled button below and the clearing
    // effect above: never create a step pointing at a connector that isn't
    // actually in the current view's connector list.
    const connectorExists = pickableConnectors.some((connector) => {
      return connector.id === newConnectorId;
    });
    if (!connectorExists) return;

    // Same rules as saving an edit: one definition of what an empty or
    // whitespace-only field means, so adding and editing cannot disagree.
    createFlowStep(selectedFlow.id, {
      id: generateId(),
      ...buildFlowStepUpdates(
        newConnectorId,
        newDirection,
        newLabel,
        newDurationMs
      )
    });

    setNewLabel('');
    setNewDurationMs('');
  }, [
    selectedFlow,
    newConnectorId,
    newDirection,
    newLabel,
    newDurationMs,
    pickableConnectors,
    createFlowStep
  ]);

  const handleSaveStep = useCallback(() => {
    if (!selectedFlow || !editingStepId || !newConnectorId) return;

    // Same defense in depth as handleAddStep above.
    const connectorExists = pickableConnectors.some((connector) => {
      return connector.id === newConnectorId;
    });
    if (!connectorExists) return;

    updateFlowStep(
      selectedFlow.id,
      editingStepId,
      buildFlowStepUpdates(
        newConnectorId,
        newDirection,
        newLabel,
        newDurationMs
      )
    );

    handleCancelEdit();
  }, [
    selectedFlow,
    editingStepId,
    newConnectorId,
    newDirection,
    newLabel,
    newDurationMs,
    pickableConnectors,
    updateFlowStep,
    handleCancelEdit
  ]);

  const handleSubmitStep = editingStepId ? handleSaveStep : handleAddStep;

  const requestStepsCount = useMemo(() => {
    return (selectedFlow?.steps ?? []).filter((step) => {
      return step.direction === 'REQUEST';
    }).length;
  }, [selectedFlow]);

  // Only the steps not already mirrored at the end of the flow (see
  // getMissingReturnPathSteps) — used both to build the return path and to
  // disable the button once there is nothing left to add
  // (R3-return-path-not-idempotent).
  const missingReturnPathSteps = useMemo(() => {
    if (!selectedFlow) return [];

    return getMissingReturnPathSteps(
      selectedFlow.steps,
      () => {
        return '';
      },
      views
    );
  }, [selectedFlow, views]);

  const handleAddReturnPath = useCallback(() => {
    if (!selectedFlow) return;

    const returnSteps = getMissingReturnPathSteps(
      selectedFlow.steps,
      generateId,
      views
    );

    returnSteps.forEach((step) => {
      createFlowStep(selectedFlow.id, step);
    });
  }, [selectedFlow, createFlowStep, views]);

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Flows</DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={3} sx={{ minHeight: 420 }}>
          <Box sx={{ width: 220 }}>
            <Stack spacing={1}>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={handleCreateFlow}
              >
                New flow
              </Button>

              {flows.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No flows yet.
                </Typography>
              )}

              <List dense disablePadding>
                {flows.map((flow) => {
                  return (
                    <ListItemButton
                      key={flow.id}
                      selected={flow.id === selectedFlowId}
                      onClick={() => {
                        setSelectedFlowId(flow.id);
                      }}
                      sx={{ pr: 5 }}
                    >
                      <ListItemText
                        primary={flow.name}
                        secondary={`${flow.steps.length} step(s)`}
                      />
                      <IconButton
                        size="small"
                        sx={{ position: 'absolute', right: 4 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFlow(flow.id);
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </ListItemButton>
                  );
                })}
              </List>
            </Stack>
          </Box>

          <Divider orientation="vertical" flexItem />

          <Box sx={{ flex: 1, minWidth: 0 }}>
            {!selectedFlow && (
              <Typography variant="body2" color="text.secondary">
                Select or create a flow to edit its steps.
              </Typography>
            )}

            {selectedFlow && (
              <Stack spacing={3}>
                <TextField
                  label="Name"
                  size="small"
                  value={selectedFlow.name}
                  inputProps={{ maxLength: 100 }}
                  onChange={(e) => {
                    updateFlow(selectedFlow.id, { name: e.target.value });
                  }}
                />

                <Stack spacing={1}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    textTransform="uppercase"
                  >
                    Steps
                  </Typography>

                  {selectedFlow.steps.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No steps yet — add one below.
                    </Typography>
                  )}

                  <List dense disablePadding>
                    {selectedFlow.steps.map((step, index) => {
                      // Resolved across all views (not just the current
                      // one), since a step's connector may live in a view
                      // other than whichever one is open right now
                      // (R3-editor-connectors-view-scoped).
                      const stepConnector = findFlowStepConnector(views, step);
                      const connectorLabel = stepConnector
                        ? getConnectorEndpointLabel(stepConnector, items)
                        : 'Missing connector';

                      return (
                        <ListItem
                          key={step.id}
                          disablePadding
                          sx={{
                            py: 0.5,
                            ...(editingStepId === step.id
                              ? { bgcolor: 'action.selected' }
                              : {})
                          }}
                          secondaryAction={
                            <Stack direction="row" spacing={0.5}>
                              <IconButton
                                size="small"
                                disabled={index === 0}
                                onClick={() => {
                                  reorderFlowSteps(
                                    selectedFlow.id,
                                    step.id,
                                    index - 1
                                  );
                                }}
                              >
                                <UpIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                disabled={
                                  index === selectedFlow.steps.length - 1
                                }
                                onClick={() => {
                                  reorderFlowSteps(
                                    selectedFlow.id,
                                    step.id,
                                    index + 1
                                  );
                                }}
                              >
                                <DownIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  handleStartEdit(step);
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  // Deleting the step currently being edited
                                  // must leave the form in add mode instead
                                  // of pointing at a step that no longer
                                  // exists.
                                  if (editingStepId === step.id) {
                                    handleCancelEdit();
                                  }
                                  deleteFlowStep(selectedFlow.id, step.id);
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                          }
                        >
                          <ListItemText
                            primary={`${index + 1}. ${connectorLabel}`}
                            secondary={`${DIRECTION_LABELS[step.direction]}${
                              step.label ? ` — ${step.label}` : ''
                            }`}
                          />
                        </ListItem>
                      );
                    })}
                  </List>

                  <Box>
                    <Button
                      size="small"
                      startIcon={<ReturnPathIcon />}
                      disabled={
                        requestStepsCount === 0 ||
                        missingReturnPathSteps.length === 0
                      }
                      onClick={handleAddReturnPath}
                    >
                      Add return path
                    </Button>
                  </Box>
                </Stack>

                <Stack spacing={1}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    textTransform="uppercase"
                  >
                    {editingStepId ? 'Edit step' : 'Add step'}
                  </Typography>

                  <Typography variant="caption" color="text.secondary">
                    Only connectors in the current view can be picked here —
                    switch views to add a step for a connector elsewhere.
                  </Typography>

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Select
                      size="small"
                      displayEmpty
                      value={newConnectorId}
                      onChange={(e) => {
                        setNewConnectorId(e.target.value as string);
                      }}
                      sx={{ minWidth: 220 }}
                    >
                      <MenuItem value="">
                        <em>Select a connector</em>
                      </MenuItem>
                      {pickableConnectors.map((connector) => {
                        return (
                          <MenuItem key={connector.id} value={connector.id}>
                            {getConnectorEndpointLabel(connector, items)}
                          </MenuItem>
                        );
                      })}
                    </Select>

                    <Select
                      size="small"
                      value={newDirection}
                      onChange={(e) => {
                        setNewDirection(e.target.value as FlowStepDirection);
                      }}
                    >
                      {flowStepDirectionOptions.map((direction) => {
                        return (
                          <MenuItem key={direction} value={direction}>
                            {DIRECTION_LABELS[direction]}
                          </MenuItem>
                        );
                      })}
                    </Select>

                    <TextField
                      size="small"
                      label="Label (optional)"
                      value={newLabel}
                      inputProps={{ maxLength: 60 }}
                      onChange={(e) => {
                        setNewLabel(e.target.value);
                      }}
                    />

                    <TextField
                      size="small"
                      label="Duration ms (optional)"
                      type="number"
                      value={newDurationMs}
                      onChange={(e) => {
                        setNewDurationMs(e.target.value);
                      }}
                      sx={{ width: 160 }}
                    />
                  </Stack>

                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      startIcon={editingStepId ? undefined : <AddIcon />}
                      disabled={!newConnectorId}
                      onClick={handleSubmitStep}
                    >
                      {editingStepId ? 'Save changes' : 'Add step'}
                    </Button>

                    {editingStepId && (
                      <Button size="small" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Stack>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
