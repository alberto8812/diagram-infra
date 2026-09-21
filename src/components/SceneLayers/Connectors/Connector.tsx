import React, { useMemo } from 'react';
import { useTheme, Box } from '@mui/material';
import { keyframes } from '@emotion/react';
import { UNPROJECTED_TILE_SIZE } from 'src/config';
import {
  getAnchorTile,
  getColorVariant,
  getConnectorDirectionIcon,
  getPacketPathPoints,
  getPacketDestinationItemId,
  getStepDurationMs
} from 'src/utils';
import { Circle } from 'src/components/Circle/Circle';
import { Svg } from 'src/components/Svg/Svg';
import { useIsoProjection } from 'src/hooks/useIsoProjection';
import { useConnector } from 'src/hooks/useConnector';
import { useScene } from 'src/hooks/useScene';
import { useColor } from 'src/hooks/useColor';
import { useFlowPlayback } from 'src/hooks/useFlowPlayback';
import { useReducedMotion } from 'src/hooks/useReducedMotion';
import { ConnectorPacket } from './ConnectorPacket';

interface Props {
  connector: ReturnType<typeof useScene>['connectors'][0];
  isSelected?: boolean;
}

export const Connector = ({ connector: _connector, isSelected }: Props) => {
  const theme = useTheme();
  const color = useColor(_connector.color);
  const { currentView } = useScene();
  const connector = useConnector(_connector.id);
  const { css, pxSize } = useIsoProjection({
    ...connector.path.rectangle
  });

  const drawOffset = useMemo(() => {
    return {
      x: UNPROJECTED_TILE_SIZE / 2,
      y: UNPROJECTED_TILE_SIZE / 2
    };
  }, []);

  const pathString = useMemo(() => {
    return connector.path.tiles.reduce((acc, tile) => {
      return `${acc} ${tile.x * UNPROJECTED_TILE_SIZE + drawOffset.x},${
        tile.y * UNPROJECTED_TILE_SIZE + drawOffset.y
      }`;
    }, '');
  }, [connector.path.tiles, drawOffset]);

  const anchorPositions = useMemo(() => {
    if (!isSelected) return [];

    return connector.anchors.map((anchor) => {
      const position = getAnchorTile(anchor, currentView);

      return {
        id: anchor.id,
        x:
          (connector.path.rectangle.from.x - position.x) *
            UNPROJECTED_TILE_SIZE +
          drawOffset.x,
        y:
          (connector.path.rectangle.from.y - position.y) *
            UNPROJECTED_TILE_SIZE +
          drawOffset.y
      };
    });
  }, [
    currentView,
    connector.path.rectangle,
    connector.anchors,
    drawOffset,
    isSelected
  ]);

  const directionIcon = useMemo(() => {
    return getConnectorDirectionIcon(connector.path.tiles);
  }, [connector.path.tiles]);

  const connectorWidthPx = useMemo(() => {
    return (UNPROJECTED_TILE_SIZE / 100) * connector.width;
  }, [connector.width]);

  const strokeDashArray = useMemo(() => {
    switch (connector.style) {
      case 'DASHED':
        return `${connectorWidthPx * 2}, ${connectorWidthPx * 2}`;
      case 'DOTTED':
        return `0, ${connectorWidthPx * 1.8}`;
      case 'SOLID':
      default:
        return 'none';
    }
  }, [connector.style, connectorWidthPx]);

  // Flow direction follows the order of connector.path.tiles (start -> end).
  // A negative stroke-dashoffset animates the dash pattern in that same
  // direction; a positive one animates it in reverse.
  const flow = useMemo(() => {
    const dashLength = connectorWidthPx * 1.2;
    const gapLength = connectorWidthPx * 2.4;
    const period = dashLength + gapLength;

    return {
      dashArray: `${dashLength}, ${gapLength}`,
      forward: keyframes`
        from { stroke-dashoffset: 0; }
        to { stroke-dashoffset: ${-period}; }
      `,
      reverse: keyframes`
        from { stroke-dashoffset: 0; }
        to { stroke-dashoffset: ${period}; }
      `
    };
  }, [connectorWidthPx]);

  const flowOverlays = useMemo(() => {
    if (!connector.animated) return [];

    if (connector.direction === 'REVERSE') return ['REVERSE' as const];
    if (connector.direction === 'BOTH') {
      return ['FORWARD' as const, 'REVERSE' as const];
    }

    return ['FORWARD' as const];
  }, [connector.animated, connector.direction]);

  const {
    flowPlayback,
    currentStep,
    currentConnector,
    advance,
    setActiveNodePulse
  } = useFlowPlayback();
  const reducedMotion = useReducedMotion();

  const packet = useMemo(() => {
    if (flowPlayback.status === 'IDLE') return null;
    if (!currentStep || !currentConnector) return null;
    if (currentConnector.id !== connector.id) return null;

    const tiles = getPacketPathPoints(
      connector.path.tiles,
      currentStep.direction
    );
    const packetPoints = tiles.map((tile) => {
      return {
        x: tile.x * UNPROJECTED_TILE_SIZE + drawOffset.x,
        y: tile.y * UNPROJECTED_TILE_SIZE + drawOffset.y
      };
    });

    const packetColor =
      currentStep.direction === 'RESPONSE'
        ? theme.palette.secondary.main
        : theme.palette.primary.main;

    const destinationItemId = getPacketDestinationItemId(
      connector.anchors,
      currentStep.direction
    );

    return {
      stepId: currentStep.id,
      points: packetPoints,
      color: packetColor,
      label: currentStep.label,
      durationMs: getStepDurationMs(currentStep, flowPlayback.speed),
      destinationItemId
    };
  }, [
    flowPlayback.status,
    flowPlayback.speed,
    currentStep,
    currentConnector,
    connector.id,
    connector.path.tiles,
    connector.anchors,
    drawOffset,
    theme.palette.primary.main,
    theme.palette.secondary.main
  ]);

  return (
    <Box style={css}>
      <Svg
        style={{
          // TODO: The original x coordinates of each tile seems to be calculated wrongly.
          // They are mirrored along the x-axis.  The hack below fixes this, but we should
          // try to fix this issue at the root of the problem (might have further implications).
          transform: 'scale(-1, 1)'
        }}
        viewboxSize={pxSize}
      >
        <polyline
          points={pathString}
          stroke={theme.palette.common.white}
          strokeWidth={connectorWidthPx * 1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={0.7}
          strokeDasharray={strokeDashArray}
          fill="none"
        />
        <polyline
          points={pathString}
          stroke={getColorVariant(color.value, 'dark', { grade: 1 })}
          strokeWidth={connectorWidthPx}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={strokeDashArray}
          fill="none"
        />

        {flowOverlays.map((direction) => {
          const isReverse = direction === 'REVERSE';
          // When both directions are shown, the reverse overlay is the
          // second one: dim it and phase-shift it so both streams read.
          const isSecondary = flowOverlays.length > 1 && isReverse;

          return (
            <Box
              key={direction}
              component="polyline"
              points={pathString}
              stroke={theme.palette.common.white}
              strokeOpacity={isSecondary ? 0.35 : 0.85}
              strokeWidth={connectorWidthPx}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={flow.dashArray}
              fill="none"
              sx={{
                animation: `${
                  isReverse ? flow.reverse : flow.forward
                } 1.4s linear infinite`,
                animationDelay: isSecondary ? '-0.7s' : '0s',
                '@media (prefers-reduced-motion: reduce)': {
                  animation: 'none'
                }
              }}
            />
          );
        })}

        {anchorPositions.map((anchor) => {
          return (
            <g key={anchor.id}>
              <Circle
                tile={anchor}
                radius={18}
                fill={theme.palette.common.white}
                fillOpacity={0.7}
              />
              <Circle
                tile={anchor}
                radius={12}
                stroke={theme.palette.common.black}
                fill={theme.palette.common.white}
                strokeWidth={6}
              />
            </g>
          );
        })}

        {directionIcon && (
          <g transform={`translate(${directionIcon.x}, ${directionIcon.y})`}>
            <g transform={`rotate(${directionIcon.rotation})`}>
              <polygon
                fill="black"
                stroke={theme.palette.common.white}
                strokeWidth={4}
                points="17.58,17.01 0,-17.01 -17.58,17.01"
              />
            </g>
          </g>
        )}

        {packet && (
          <ConnectorPacket
            key={packet.stepId}
            points={packet.points}
            color={packet.color}
            label={packet.label}
            durationMs={packet.durationMs}
            status={flowPlayback.status === 'PAUSED' ? 'PAUSED' : 'PLAYING'}
            reducedMotion={reducedMotion}
            onArrive={() => {
              if (packet.destinationItemId) {
                setActiveNodePulse({
                  nodeId: packet.destinationItemId,
                  token: Date.now()
                });
              }

              advance();
            }}
          />
        )}
      </Svg>
    </Box>
  );
};
