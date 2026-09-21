import React, { useMemo } from 'react';
import { Box, Typography, Stack, useTheme } from '@mui/material';
import { keyframes } from '@emotion/react';
import {
  PROJECTED_TILE_SIZE,
  DEFAULT_LABEL_HEIGHT,
  MARKDOWN_EMPTY_VALUE
} from 'src/config';
import { getTilePosition } from 'src/utils';
import { useIcon } from 'src/hooks/useIcon';
import { ViewItem } from 'src/types';
import { useModelItem } from 'src/hooks/useModelItem';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { ExpandableLabel } from 'src/components/Label/ExpandableLabel';
import { MarkdownEditor } from 'src/components/MarkdownEditor/MarkdownEditor';

// Short, subtle glow shown on a node when a flow playback packet arrives
// (src/components/SceneLayers/Connectors/ConnectorPacket.tsx sets
// uiStateStore.activeNodePulse; see src/hooks/useFlowPlayback.ts).
const pulseAnimation = keyframes`
  0% { opacity: 0; transform: scale(0.7); }
  35% { opacity: 0.8; }
  100% { opacity: 0; transform: scale(1.5); }
`;

interface Props {
  node: ViewItem;
  order: number;
}

export const Node = ({ node, order }: Props) => {
  const theme = useTheme();
  const modelItem = useModelItem(node.id);
  const { iconComponent } = useIcon(modelItem.icon);

  const activeNodePulse = useUiStateStore((state) => {
    return state.activeNodePulse;
  });

  const isPulsing = activeNodePulse?.nodeId === node.id;

  const position = useMemo(() => {
    return getTilePosition({
      tile: node.tile,
      origin: 'BOTTOM'
    });
  }, [node.tile]);

  const description = useMemo(() => {
    if (
      modelItem.description === undefined ||
      modelItem.description === MARKDOWN_EMPTY_VALUE
    )
      return null;

    return modelItem.description;
  }, [modelItem.description]);

  return (
    <Box
      sx={{
        position: 'absolute',
        zIndex: order
      }}
    >
      <Box
        sx={{ position: 'absolute' }}
        style={{
          left: position.x,
          top: position.y
        }}
      >
        {(modelItem.name || description) && (
          <Box
            sx={{ position: 'absolute' }}
            style={{ bottom: PROJECTED_TILE_SIZE.height / 2 }}
          >
            <ExpandableLabel
              maxWidth={250}
              expandDirection="BOTTOM"
              labelHeight={node.labelHeight ?? DEFAULT_LABEL_HEIGHT}
            >
              <Stack spacing={1}>
                {modelItem.name && (
                  <Typography fontWeight={600}>{modelItem.name}</Typography>
                )}
                {modelItem.description &&
                  modelItem.description !== MARKDOWN_EMPTY_VALUE && (
                    <MarkdownEditor value={modelItem.description} readOnly />
                  )}
              </Stack>
            </ExpandableLabel>
          </Box>
        )}
        {isPulsing && (
          <Box
            key={activeNodePulse?.token}
            sx={{
              position: 'absolute',
              pointerEvents: 'none',
              width: PROJECTED_TILE_SIZE.width,
              height: PROJECTED_TILE_SIZE.height,
              left: -PROJECTED_TILE_SIZE.width / 2,
              top: -PROJECTED_TILE_SIZE.height,
              borderRadius: '50%',
              backgroundColor: theme.palette.primary.main,
              opacity: 0,
              animation: `${pulseAnimation} 600ms ease-out forwards`,
              '@media (prefers-reduced-motion: reduce)': {
                animation: 'none'
              }
            }}
          />
        )}
        {iconComponent && (
          <Box
            sx={{
              position: 'absolute',
              pointerEvents: 'none'
            }}
          >
            {iconComponent}
          </Box>
        )}
      </Box>
    </Box>
  );
};
