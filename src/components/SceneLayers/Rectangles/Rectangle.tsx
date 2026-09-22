import React from 'react';
import { Box, Typography } from '@mui/material';
import { useScene } from 'src/hooks/useScene';
import { IsoTileArea } from 'src/components/IsoTileArea/IsoTileArea';
import { getColorVariant } from 'src/utils';
import { useColor } from 'src/hooks/useColor';
import { useIsoProjection } from 'src/hooks/useIsoProjection';
import { ZONE_KIND_LABELS } from 'src/utils/zoneLabels';

type Props = ReturnType<typeof useScene>['rectangles'][0];

export const Rectangle = ({ from, to, color: colorId, zone, name }: Props) => {
  const color = useColor(colorId);
  // Reuses the same origin-corner pixel position IsoTileArea derives
  // internally, so the label anchors exactly at the rectangle's own corner
  // without duplicating its bounding-box math. Unlike the tile area itself,
  // the label is rendered outside the skewed iso-projection box (same
  // pattern as a node's own label, src/components/SceneLayers/Nodes/Node/
  // Node.tsx), so its text stays flat and readable.
  const { position } = useIsoProjection({ from, to });

  return (
    <>
      <IsoTileArea
        from={from}
        to={to}
        fill={color.value}
        cornerRadius={22}
        stroke={{
          color: getColorVariant(color.value, 'dark', { grade: 2 }),
          width: 1
        }}
      />
      {zone && (
        <Box
          sx={{ position: 'absolute', pointerEvents: 'none' }}
          style={{ left: position.x, top: position.y }}
        >
          <Box
            sx={{
              position: 'absolute',
              bgcolor: 'common.white',
              border: '1px solid',
              borderColor: 'grey.400',
              borderRadius: 1,
              px: 0.75,
              py: 0.25,
              whiteSpace: 'nowrap'
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {name ?? ZONE_KIND_LABELS[zone]}
            </Typography>
          </Box>
        </Box>
      )}
    </>
  );
};
