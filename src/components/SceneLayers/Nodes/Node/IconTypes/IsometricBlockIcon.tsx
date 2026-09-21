import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { Icon } from 'src/types';
import {
  PROJECTED_TILE_SIZE,
  ICON_BLOCK_EXTRUDE_HEIGHT,
  ICON_BLOCK_BASE_COLOR
} from 'src/config';
import {
  getColorVariant,
  getIsoProjectionCss,
  getIsometricCuboidFaces,
  toSvgPoints
} from 'src/utils';
import { Svg } from 'src/components/Svg/Svg';

interface Props {
  icon: Icon;
}

// Gives a non-isometric (flat) icon volume by rendering it on an extruded
// isometric block instead of directly on the floor tile — e.g. the Simple
// Icons CI/CD brand logos in src/examples/initialData.ts. Product decision
// (T6, see odd/tasks/animated-flow-simulation.md): stays inside the
// current 2.5D CSS/SVG engine, no three.js.
//
// The block's three visible faces (top/left/right) are plain SVG polygons,
// their geometry coming from the pure, unit-tested
// src/utils/isometricBlock.ts. The logo overlay on top reuses, unchanged,
// the exact flat-icon isometric transform NonIsometricIcon already applies
// (getIsoProjectionCss()) — the same matrix getIsoMatrix() in
// src/utils/renderer.ts uses to project grid tiles — just raised onto the
// lid by the block's extrude height. Picked over clipping the <image> into
// the top polygon: it keeps the already-working, already-export-safe <img>
// markup untouched (ExportImageDialog/dom-to-image), at the cost of the
// logo being the same CSS-skewed parallelogram approximation
// NonIsometricIcon already renders today, rather than a pixel-exact fit to
// the true tile diamond.
export const IsometricBlockIcon = ({ icon }: Props) => {
  const footprint = PROJECTED_TILE_SIZE;
  const extrudeHeight = ICON_BLOCK_EXTRUDE_HEIGHT;
  const totalHeight = footprint.height + extrudeHeight;

  const faces = useMemo(() => {
    return getIsometricCuboidFaces(footprint, extrudeHeight);
  }, [footprint, extrudeHeight]);

  const leftFaceColor = useMemo(() => {
    return getColorVariant(ICON_BLOCK_BASE_COLOR, 'dark', { grade: 2 });
  }, []);

  const rightFaceColor = useMemo(() => {
    return getColorVariant(ICON_BLOCK_BASE_COLOR, 'dark', { grade: 1 });
  }, []);

  const topStrokeColor = useMemo(() => {
    return getColorVariant(ICON_BLOCK_BASE_COLOR, 'dark', { grade: 3 });
  }, []);

  return (
    <Box sx={{ pointerEvents: 'none' }}>
      <Svg
        viewBox={`${-footprint.width / 2} ${-totalHeight} ${
          footprint.width
        } ${totalHeight}`}
        width={footprint.width}
        height={totalHeight}
        style={{
          position: 'absolute',
          left: -footprint.width / 2,
          top: -totalHeight
        }}
      >
        {/* Subtle ground-contact shadow, centered on the block's near
        (front-bottom) vertex — the same anchor the block itself stands on. */}
        <ellipse
          cx={0}
          cy={0}
          rx={footprint.width * 0.22}
          ry={footprint.height * 0.1}
          fill="rgba(0, 0, 0, 0.18)"
        />
        <polygon points={toSvgPoints(faces.left)} fill={leftFaceColor} />
        <polygon points={toSvgPoints(faces.right)} fill={rightFaceColor} />
        <polygon
          points={toSvgPoints(faces.top)}
          fill={ICON_BLOCK_BASE_COLOR}
          stroke={topStrokeColor}
          strokeWidth={1}
        />
      </Svg>
      <Box
        sx={{
          position: 'absolute',
          left: -PROJECTED_TILE_SIZE.width / 2,
          top: -PROJECTED_TILE_SIZE.height / 2 - extrudeHeight,
          transformOrigin: 'top left',
          transform: getIsoProjectionCss()
        }}
      >
        <Box
          component="img"
          src={icon.url}
          alt={`icon-${icon.id}`}
          sx={{ width: PROJECTED_TILE_SIZE.width * 0.7 }}
        />
      </Box>
    </Box>
  );
};
