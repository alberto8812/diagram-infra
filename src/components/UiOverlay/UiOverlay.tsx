import React, { useCallback, useMemo, useRef } from 'react';
import { Box, useTheme, Typography, Stack } from '@mui/material';
import { ChevronRight } from '@mui/icons-material';
import { EditorModeEnum } from 'src/types';
import { UiElement } from 'components/UiElement/UiElement';
import { SceneLayer } from 'src/components/SceneLayer/SceneLayer';
import { DragAndDrop } from 'src/components/DragAndDrop/DragAndDrop';
import { ItemControlsManager } from 'src/components/ItemControls/ItemControlsManager';
import { ToolMenu } from 'src/components/ToolMenu/ToolMenu';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { MainMenu } from 'src/components/MainMenu/MainMenu';
import { ZoomControls } from 'src/components/ZoomControls/ZoomControls';
import { DebugUtils } from 'src/components/DebugUtils/DebugUtils';
import { useResizeObserver } from 'src/hooks/useResizeObserver';
import { ContextMenuManager } from 'src/components/ContextMenu/ContextMenuManager';
import { useModelStore } from 'src/stores/modelStore';
import { FlowPlaybackBar } from 'src/components/FlowControls/FlowPlaybackBar';
import { FlowEditorDialog } from 'src/components/FlowControls/FlowEditorDialog';
import { ViewSwitcher } from 'src/components/ViewSwitcher/ViewSwitcher';
import { IssuesPanel } from 'src/components/IssuesPanel/IssuesPanel';
import { SecurityReportDialog } from 'src/components/SecurityReportDialog/SecurityReportDialog';
import { CostReportDialog } from 'src/components/CostReportDialog/CostReportDialog';
import { FlatDiagramDialog } from 'src/components/FlatDiagram/FlatDiagramDialog';
import { ExportImageDialog } from '../ExportImageDialog/ExportImageDialog';

const ToolsEnum = {
  MAIN_MENU: 'MAIN_MENU',
  ZOOM_CONTROLS: 'ZOOM_CONTROLS',
  TOOL_MENU: 'TOOL_MENU',
  ITEM_CONTROLS: 'ITEM_CONTROLS',
  VIEW_TITLE: 'VIEW_TITLE',
  FLOW_CONTROLS: 'FLOW_CONTROLS'
} as const;

interface EditorModeMapping {
  [k: string]: (keyof typeof ToolsEnum)[];
}

const EDITOR_MODE_MAPPING: EditorModeMapping = {
  [EditorModeEnum.EDITABLE]: [
    'ITEM_CONTROLS',
    'ZOOM_CONTROLS',
    'TOOL_MENU',
    'MAIN_MENU',
    'VIEW_TITLE',
    'FLOW_CONTROLS'
  ],
  [EditorModeEnum.EXPLORABLE_READONLY]: [
    'ZOOM_CONTROLS',
    'VIEW_TITLE',
    'FLOW_CONTROLS'
  ],
  [EditorModeEnum.NON_INTERACTIVE]: []
};

const getEditorModeMapping = (editorMode: keyof typeof EditorModeEnum) => {
  const availableUiFeatures = EDITOR_MODE_MAPPING[editorMode];

  return availableUiFeatures;
};

export const UiOverlay = () => {
  const theme = useTheme();
  const contextMenuAnchorRef = useRef();
  const { appPadding } = theme.customVars;
  const spacing = useCallback(
    (multiplier: number) => {
      return parseInt(theme.spacing(multiplier), 10);
    },
    [theme]
  );
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });
  const enableDebugTools = useUiStateStore((state) => {
    return state.enableDebugTools;
  });
  const mode = useUiStateStore((state) => {
    return state.mode;
  });
  const mouse = useUiStateStore((state) => {
    return state.mouse;
  });
  const dialog = useUiStateStore((state) => {
    return state.dialog;
  });
  const itemControls = useUiStateStore((state) => {
    return state.itemControls;
  });
  const editorMode = useUiStateStore((state) => {
    return state.editorMode;
  });
  const availableTools = useMemo(() => {
    return getEditorModeMapping(editorMode);
  }, [editorMode]);
  const rendererEl = useUiStateStore((state) => {
    return state.rendererEl;
  });
  const title = useModelStore((state) => {
    return state.title;
  });
  const { size: rendererSize } = useResizeObserver(rendererEl);
  const { height: controlHeight } = theme.customVars.toolMenu;

  // Enterprise layout: a compact header row (menu + breadcrumb on the left,
  // editing tools on the right) and a status row at the bottom (zoom on the
  // left, flow playback centered). Bottom-anchored elements use
  // translateY(-100%) so they stay aligned regardless of their own height.
  const headerTop = appPadding.y;
  const panelTop = headerTop + controlHeight + spacing(1);
  const bottomEdge = rendererSize.height - appPadding.y;
  // Horizontal room reserved at each bottom corner (zoom controls on the
  // left, host widgets such as the examples switcher on the right).
  const bottomCornerReserve = 220;

  return (
    <>
      <Box
        sx={{
          position: 'absolute',
          width: 0,
          height: 0,
          top: 0,
          left: 0
        }}
      >
        {availableTools.includes('ITEM_CONTROLS') && itemControls && (
          <UiElement
            sx={{
              position: 'absolute',
              width: '360px',
              overflowY: 'scroll',
              '&::-webkit-scrollbar': {
                display: 'none'
              }
            }}
            style={{
              left: appPadding.x,
              top: panelTop,
              maxHeight: bottomEdge - controlHeight - spacing(1) - panelTop
            }}
          >
            <ItemControlsManager />
          </UiElement>
        )}

        {availableTools.includes('TOOL_MENU') && (
          <Box
            sx={{
              position: 'absolute',
              transform: 'translateX(-100%)'
            }}
            style={{
              left: rendererSize.width - appPadding.x,
              top: headerTop
            }}
          >
            <ToolMenu />
          </Box>
        )}

        {availableTools.includes('TOOL_MENU') && dialog === 'ISSUES' && (
          <UiElement
            sx={{
              position: 'absolute',
              transform: 'translateX(-100%)',
              overflowY: 'scroll',
              '&::-webkit-scrollbar': {
                display: 'none'
              }
            }}
            style={{
              left: rendererSize.width - appPadding.x,
              top: panelTop,
              maxHeight: bottomEdge - controlHeight - spacing(1) - panelTop
            }}
          >
            <IssuesPanel
              onClose={() => {
                return uiStateActions.setDialog(null);
              }}
            />
          </UiElement>
        )}

        {(availableTools.includes('MAIN_MENU') ||
          availableTools.includes('VIEW_TITLE')) && (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ position: 'absolute' }}
            style={{
              top: headerTop,
              left: appPadding.x,
              maxWidth: Math.max(rendererSize.width * 0.45, 240)
            }}
          >
            {availableTools.includes('MAIN_MENU') && <MainMenu />}

            {availableTools.includes('VIEW_TITLE') && (
              <UiElement
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  minWidth: 0,
                  px: 1.5,
                  height: controlHeight,
                  // Read-only by default (title text, chevron): pass clicks
                  // through to the canvas underneath. ViewSwitcher opts back
                  // into pointer events on just its own interactive element.
                  pointerEvents: 'none'
                }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={0.5}
                  sx={{ minWidth: 0 }}
                >
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    color="text.secondary"
                    noWrap
                    sx={{ pointerEvents: 'none' }}
                  >
                    {title}
                  </Typography>
                  <ChevronRight sx={{ pointerEvents: 'none' }} />
                  <ViewSwitcher
                    editable={availableTools.includes('MAIN_MENU')}
                  />
                </Stack>
              </UiElement>
            )}
          </Stack>
        )}

        {availableTools.includes('ZOOM_CONTROLS') && (
          <Box
            sx={{
              position: 'absolute',
              transform: 'translateY(-100%)'
            }}
            style={{
              top: bottomEdge,
              left: appPadding.x
            }}
          >
            <ZoomControls />
          </Box>
        )}

        {availableTools.includes('FLOW_CONTROLS') && (
          <Box
            sx={{
              position: 'absolute',
              transform: 'translate(-50%, -100%)'
            }}
            style={{
              left: rendererSize.width / 2,
              top: bottomEdge,
              maxWidth: Math.max(
                rendererSize.width - bottomCornerReserve * 2,
                320
              )
            }}
          >
            <FlowPlaybackBar />
          </Box>
        )}

        {enableDebugTools && (
          <UiElement
            sx={{
              position: 'absolute',
              width: 350,
              transform: 'translateY(-100%)'
            }}
            style={{
              maxWidth: rendererSize.width - appPadding.x * 2,
              left: appPadding.x,
              top: bottomEdge - controlHeight - spacing(1)
            }}
          >
            <DebugUtils />
          </UiElement>
        )}
      </Box>

      {mode.type === 'PLACE_ICON' && mode.id && (
        <SceneLayer disableAnimation>
          <DragAndDrop iconId={mode.id} tile={mouse.position.tile} />
        </SceneLayer>
      )}

      {dialog === 'EXPORT_IMAGE' && (
        <ExportImageDialog
          onClose={() => {
            return uiStateActions.setDialog(null);
          }}
        />
      )}

      {dialog === 'FLOW_EDITOR' && availableTools.includes('FLOW_CONTROLS') && (
        <FlowEditorDialog
          onClose={() => {
            return uiStateActions.setDialog(null);
          }}
        />
      )}

      {dialog === 'SECURITY_REPORT' && availableTools.includes('TOOL_MENU') && (
        <SecurityReportDialog
          onClose={() => {
            return uiStateActions.setDialog(null);
          }}
        />
      )}

      {dialog === 'COST_REPORT' && availableTools.includes('TOOL_MENU') && (
        <CostReportDialog
          onClose={() => {
            return uiStateActions.setDialog(null);
          }}
        />
      )}

      {dialog === 'FLAT_DIAGRAM' && (
        <FlatDiagramDialog
          onClose={() => {
            return uiStateActions.setDialog(null);
          }}
        />
      )}

      <SceneLayer>
        <Box ref={contextMenuAnchorRef} />
        <ContextMenuManager anchorEl={contextMenuAnchorRef.current} />
      </SceneLayer>
    </>
  );
};
