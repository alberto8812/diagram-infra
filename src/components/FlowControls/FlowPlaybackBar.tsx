import React, { useCallback, useMemo } from 'react';
import {
  Box,
  Select,
  MenuItem,
  Typography,
  Stack,
  Divider,
  Button,
  Tooltip
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  SkipPrevious as PrevIcon,
  SkipNext as NextIcon,
  Edit as EditIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { UiElement } from 'src/components/UiElement/UiElement';
import { IconButton } from 'src/components/IconButton/IconButton';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useModelStore } from 'src/stores/modelStore';
import { useScene } from 'src/hooks/useScene';
import { useFlowPlayback } from 'src/hooks/useFlowPlayback';
import { generateId } from 'src/utils';
import { FLOW_PLAYBACK_SPEED_OPTIONS } from 'src/config';

// Playback controls for the currently selected flow: flow picker, transport
// (play/pause, stop, prev/next step), speed, and a "step n / total — label"
// indicator. Docked at the bottom center of the UiOverlay (the label
// truncates with a tooltip on narrow viewports). Shown for both EDITABLE and
// EXPLORABLE_READONLY editor modes (see UiOverlay.tsx); the "Edit flows"
// entry point and the "create the first flow" prompt only render in
// EDITABLE mode.
export const FlowPlaybackBar = () => {
  const editorMode = useUiStateStore((state) => {
    return state.editorMode;
  });
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });
  const flows = useModelStore((state) => {
    return state.flows ?? [];
  });
  const { createFlow } = useScene();
  const {
    flow,
    steps,
    flowPlayback,
    currentStep,
    selectFlow,
    play,
    pause,
    stop,
    nextStep,
    prevStep,
    setSpeed
  } = useFlowPlayback();

  const isEditable = editorMode === 'EDITABLE';

  const createFirstFlow = useCallback(() => {
    const id = generateId();
    createFlow({ id, name: 'New flow', steps: [] });
    selectFlow(id);
    uiStateActions.setDialog('FLOW_EDITOR');
  }, [createFlow, selectFlow, uiStateActions]);

  const stepLabel = useMemo(() => {
    if (!flow) return 'No flow selected';
    if (steps.length === 0) return 'No steps yet';

    const position = `Step ${flowPlayback.stepIndex + 1} / ${steps.length}`;

    return currentStep?.label ? `${position} — ${currentStep.label}` : position;
  }, [flow, steps.length, flowPlayback.stepIndex, currentStep]);

  // Hidden entirely when the model has no flows, except in EDITABLE mode
  // where a "create the first flow" prompt is shown instead.
  if (flows.length === 0) {
    if (!isEditable) return null;

    return (
      <UiElement>
        <Box sx={{ px: 1 }}>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={createFirstFlow}
          >
            Create a flow
          </Button>
        </Box>
      </UiElement>
    );
  }

  return (
    <UiElement sx={{ maxWidth: '100%' }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 1, minWidth: 0 }}
      >
        <Select
          size="small"
          variant="standard"
          disableUnderline
          displayEmpty
          value={flowPlayback.flowId ?? ''}
          onChange={(e) => {
            selectFlow((e.target.value as string) || null);
          }}
          sx={{ minWidth: 110, maxWidth: 180, flexShrink: 0, fontSize: 14 }}
        >
          <MenuItem value="">
            <em>Select a flow</em>
          </MenuItem>
          {flows.map((_flow) => {
            return (
              <MenuItem key={_flow.id} value={_flow.id}>
                {_flow.name}
              </MenuItem>
            );
          })}
        </Select>

        <Divider orientation="vertical" flexItem />

        <IconButton
          name="Previous step"
          Icon={<PrevIcon />}
          onClick={prevStep}
          disabled={!flow || steps.length === 0}
        />
        <IconButton
          name={flowPlayback.status === 'PLAYING' ? 'Pause' : 'Play'}
          Icon={
            flowPlayback.status === 'PLAYING' ? <PauseIcon /> : <PlayIcon />
          }
          onClick={() => {
            if (flowPlayback.status === 'PLAYING') {
              pause();
            } else {
              play();
            }
          }}
          disabled={!flow || steps.length === 0}
        />
        <IconButton
          name="Stop"
          Icon={<StopIcon />}
          onClick={stop}
          disabled={!flow}
        />
        <IconButton
          name="Next step"
          Icon={<NextIcon />}
          onClick={nextStep}
          disabled={!flow || steps.length === 0}
        />

        <Divider orientation="vertical" flexItem />

        <Select
          size="small"
          variant="standard"
          disableUnderline
          value={flowPlayback.speed}
          onChange={(e) => {
            setSpeed(Number(e.target.value));
          }}
          sx={{ minWidth: 48, flexShrink: 0, fontSize: 14 }}
        >
          {FLOW_PLAYBACK_SPEED_OPTIONS.map((speed) => {
            return (
              <MenuItem key={speed} value={speed}>
                {speed}x
              </MenuItem>
            );
          })}
        </Select>

        <Divider orientation="vertical" flexItem />

        <Tooltip title={stepLabel} placement="top" enterDelay={500}>
          <Typography
            variant="body2"
            color="text.secondary"
            noWrap
            sx={{ flex: '1 1 auto', minWidth: 60, maxWidth: 260 }}
          >
            {stepLabel}
          </Typography>
        </Tooltip>

        {isEditable && (
          <>
            <Divider orientation="vertical" flexItem />
            <IconButton
              name="Edit flows"
              Icon={<EditIcon />}
              onClick={() => {
                uiStateActions.setDialog('FLOW_EDITOR');
              }}
            />
          </>
        )}
      </Stack>
    </UiElement>
  );
};
