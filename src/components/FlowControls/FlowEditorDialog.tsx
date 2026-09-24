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
  SelectChangeEvent,
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
  FlowStepOutcome,
  flowStepDirectionOptions,
  flowStepOutcomeOptions
} from 'src/types';
import { useModelStore } from 'src/stores/modelStore';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import {
  generateId,
  getConnectorEndpointLabel,
  getMissingReturnPathSteps,
  findFlowStepConnector,
  buildFlowStepUpdates,
  parseDurationInput,
  resolvePickableConnectors,
  hasExplicitSuccessors
} from 'src/utils';

interface Props {
  onClose: () => void;
}

const DIRECTION_LABELS: Record<FlowStepDirection, string> = {
  REQUEST: 'Request',
  RESPONSE: 'Response'
};

const OUTCOME_LABELS: Record<FlowStepOutcome, string> = {
  SUCCESS: 'Success',
  FAILURE: 'Failure'
};

// Tooltip/title shown on the disabled reorder buttons once a flow declares
// successors (see hasExplicitSuccessors, src/utils/flow.ts): reordering the
// array no longer changes playback in that case, since resolveNextSteps
// never falls back to array order for a graph flow. Explaining why beats
// leaving the buttons silently inert.
const REORDER_DISABLED_TITLE =
  'This flow sets its own step order through successors';

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
    reorderFlowSteps,
    setFlowStepSuccessors
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
  const [newOutcome, setNewOutcome] = useState<FlowStepOutcome | ''>('');

  // Successors are only editable while editing an existing step (see the
  // Select below), and are only ever written when the user actually opens
  // the control — see `successorsTouched`.
  const [newSuccessors, setNewSuccessors] = useState<string[]>([]);

  // Guards setFlowStepSuccessors from firing on every ordinary save. Saving
  // the rest of the form (connector/direction/label/duration/outcome) must
  // never, by itself, turn a list flow into a graph flow — only an explicit
  // edit to the successors control does that (see setFlowStepSuccessors,
  // src/stores/reducers/flow.ts, and its backfill rule).
  const [successorsTouched, setSuccessorsTouched] = useState(false);

  // `null` means the form below is in "add" mode; a step id means it is
  // editing that step instead. The fields above are shared between both
  // modes — there is only ever one form.
  const [editingStepId, setEditingStepId] = useState<string | null>(null);

  const handleCancelEdit = useCallback(() => {
    setEditingStepId(null);
    setNewConnectorId('');
    setNewDirection('REQUEST');
    setNewLabel('');
    setNewDurationMs('');
    setNewOutcome('');
    setNewSuccessors([]);
    setSuccessorsTouched(false);
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
    setNewOutcome(step.outcome ?? '');
    setNewSuccessors(step.next ?? []);
    setSuccessorsTouched(false);
  }, []);

  const editingStep = useMemo(() => {
    if (!selectedFlow || !editingStepId) return undefined;

    return selectedFlow.steps.find((step) => {
      return step.id === editingStepId;
    });
  }, [selectedFlow, editingStepId]);

  // `editingStepId` only gets cleared by the flow-switch effect above and by
  // this dialog's own delete button. If the step disappears any other way
  // (undo, deletion elsewhere, model replacement), nothing else would leave
  // edit mode, and the form would stay stuck pointing at a step that no
  // longer exists.
  useEffect(() => {
    if (editingStepId && !editingStep) {
      handleCancelEdit();
    }
  }, [editingStepId, editingStep, handleCancelEdit]);

  // See resolvePickableConnectors (src/utils/flow.ts) for the rule: a step
  // being edited keeps its own connector in the picker even if that
  // connector belongs to another view, since that is the only thing keeping
  // such a step editable.
  const pickableConnectors = useMemo(() => {
    return resolvePickableConnectors(
      connectors,
      findFlowStepConnector(views, editingStep)
    );
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

  // One parse of the duration field per render, shared by the disabled
  // submit button, the TextField's error state, and the guards in
  // handleAddStep/handleSaveStep below — so all three agree on what counts
  // as invalid (see parseDurationInput, src/utils/flow.ts).
  const parsedDuration = useMemo(() => {
    return parseDurationInput(newDurationMs);
  }, [newDurationMs]);

  const handleAddStep = useCallback(() => {
    if (!selectedFlow || !newConnectorId || !parsedDuration.isValid) return;

    // Defense in depth alongside the disabled button below and the clearing
    // effect above: never create a step pointing at a connector that isn't
    // actually in the current view's connector list.
    const connectorExists = pickableConnectors.some((connector) => {
      return connector.id === newConnectorId;
    });
    if (!connectorExists) return;

    // Same rules as saving an edit: one definition of what an empty or
    // whitespace-only field means, so adding and editing cannot disagree. A
    // step being added has no id yet for another step to point at, so it
    // never carries `next` here — successors only ever apply while editing
    // an existing step (see the successors Select below).
    createFlowStep(selectedFlow.id, {
      id: generateId(),
      ...buildFlowStepUpdates(
        newConnectorId,
        newDirection,
        newLabel,
        newDurationMs
      ),
      outcome: newOutcome === '' ? undefined : newOutcome
    });

    setNewLabel('');
    setNewDurationMs('');
    setNewOutcome('');
  }, [
    selectedFlow,
    newConnectorId,
    newDirection,
    newLabel,
    newDurationMs,
    newOutcome,
    parsedDuration,
    pickableConnectors,
    createFlowStep
  ]);

  const handleSaveStep = useCallback(() => {
    if (
      !selectedFlow ||
      !editingStepId ||
      !newConnectorId ||
      !parsedDuration.isValid
    )
      return;

    // Same defense in depth as handleAddStep above.
    const connectorExists = pickableConnectors.some((connector) => {
      return connector.id === newConnectorId;
    });
    if (!connectorExists) return;

    updateFlowStep(selectedFlow.id, editingStepId, {
      ...buildFlowStepUpdates(
        newConnectorId,
        newDirection,
        newLabel,
        newDurationMs
      ),
      outcome: newOutcome === '' ? undefined : newOutcome
    });

    // Only touches `next` — and only ever backfills the rest of the flow —
    // when the user actually opened the successors control. Otherwise an
    // ordinary edit (label, duration, ...) would silently convert a list
    // flow into a graph flow (see setFlowStepSuccessors's backfill rule).
    if (successorsTouched) {
      setFlowStepSuccessors(selectedFlow.id, editingStepId, newSuccessors);
    }

    handleCancelEdit();
  }, [
    selectedFlow,
    editingStepId,
    parsedDuration,
    newConnectorId,
    newDirection,
    newLabel,
    newDurationMs,
    newOutcome,
    newSuccessors,
    successorsTouched,
    pickableConnectors,
    updateFlowStep,
    setFlowStepSuccessors,
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

  // Labels every step of the selected flow the same way the step rows below
  // are labelled ("1. Item A -> Item B"), so the successors picker lists
  // options the user recognises instead of raw ids.
  const stepLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    if (!selectedFlow) return labels;

    selectedFlow.steps.forEach((step, index) => {
      const stepConnector = findFlowStepConnector(views, step);
      const connectorLabel = stepConnector
        ? getConnectorEndpointLabel(stepConnector, items)
        : 'Missing connector';

      labels[step.id] = `${index + 1}. ${connectorLabel}`;
    });

    return labels;
  }, [selectedFlow, views, items]);

  // Candidates for the successors picker: every OTHER step of the selected
  // flow — a step must never be offered as its own successor.
  const successorCandidates = useMemo(() => {
    if (!selectedFlow || !editingStepId) return [];

    return selectedFlow.steps.filter((step) => {
      return step.id !== editingStepId;
    });
  }, [selectedFlow, editingStepId]);

  // See hasExplicitSuccessors (src/utils/flow.ts): once any step of the flow
  // declares `next`, resolveNextSteps stops consulting array order
  // altogether, so reordering rows here would move them without changing
  // playback at all.
  const isGraphFlow = useMemo(() => {
    return selectedFlow ? hasExplicitSuccessors(selectedFlow.steps) : false;
  }, [selectedFlow]);

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
                                disabled={index === 0 || isGraphFlow}
                                title={
                                  isGraphFlow
                                    ? REORDER_DISABLED_TITLE
                                    : undefined
                                }
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
                                  index === selectedFlow.steps.length - 1 ||
                                  isGraphFlow
                                }
                                title={
                                  isGraphFlow
                                    ? REORDER_DISABLED_TITLE
                                    : undefined
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
                      error={!parsedDuration.isValid}
                      helperText={
                        parsedDuration.isValid
                          ? undefined
                          : 'Must be a positive whole number'
                      }
                      sx={{ width: 160 }}
                    />

                    <Select
                      size="small"
                      displayEmpty
                      value={newOutcome}
                      onChange={(e) => {
                        setNewOutcome(e.target.value as FlowStepOutcome | '');
                      }}
                      sx={{ minWidth: 160 }}
                    >
                      <MenuItem value="">
                        <em>No outcome</em>
                      </MenuItem>
                      {flowStepOutcomeOptions.map((outcome) => {
                        return (
                          <MenuItem key={outcome} value={outcome}>
                            {OUTCOME_LABELS[outcome]}
                          </MenuItem>
                        );
                      })}
                    </Select>

                    {editingStepId && (
                      <Select
                        size="small"
                        multiple
                        displayEmpty
                        value={newSuccessors}
                        onChange={(e: SelectChangeEvent<string[]>) => {
                          const { value } = e.target;
                          setNewSuccessors(
                            typeof value === 'string' ? value.split(',') : value
                          );
                          setSuccessorsTouched(true);
                        }}
                        renderValue={(selected) => {
                          if (selected.length === 0) return 'No successors';

                          return selected
                            .map((id) => {
                              return stepLabels[id] ?? id;
                            })
                            .join(', ');
                        }}
                        sx={{ minWidth: 220 }}
                      >
                        {successorCandidates.map((step) => {
                          return (
                            <MenuItem key={step.id} value={step.id}>
                              {stepLabels[step.id]}
                            </MenuItem>
                          );
                        })}
                      </Select>
                    )}
                  </Stack>

                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      startIcon={editingStepId ? undefined : <AddIcon />}
                      disabled={!newConnectorId || !parsedDuration.isValid}
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
