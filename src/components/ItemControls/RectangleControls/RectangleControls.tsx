import React from 'react';
import {
  Box,
  Select,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Stack
} from '@mui/material';
import { useRectangle } from 'src/hooks/useRectangle';
import { ColorSelector } from 'src/components/ColorSelector/ColorSelector';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import {
  zoneKindOptions,
  ZoneKind,
  zoneVisibilityOptions,
  ZoneVisibility
} from 'src/types';
import { LABEL_MAX_LENGTH } from 'src/schemas/common';
import { ZONE_KIND_LABELS, ZONE_VISIBILITY_LABELS } from 'src/utils/zoneLabels';
import { ControlsContainer } from '../components/ControlsContainer';
import { Section } from '../components/Section';
import { DeleteButton } from '../components/DeleteButton';

interface Props {
  id: string;
}

export const RectangleControls = ({ id }: Props) => {
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });
  const rectangle = useRectangle(id);
  const { updateRectangle, deleteRectangle } = useScene();

  return (
    <ControlsContainer>
      <Section>
        <ColorSelector
          onChange={(color) => {
            updateRectangle(rectangle.id, { color });
          }}
          activeColor={rectangle.color}
        />
      </Section>
      <Section title="Zone">
        <Stack spacing={2}>
          <Select
            size="small"
            displayEmpty
            value={rectangle.zone ?? ''}
            onChange={(e) => {
              const value = e.target.value as ZoneKind | '';

              if (value === '') {
                // Clearing the zone kind also clears the zone-only fields —
                // a rectangle without `zone` is plain decoration again (see
                // src/utils/containment.ts), so a stale name/visibility
                // shouldn't linger on it.
                updateRectangle(rectangle.id, {
                  zone: undefined,
                  name: undefined,
                  visibility: undefined
                });
                return;
              }

              updateRectangle(rectangle.id, { zone: value });
            }}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {zoneKindOptions.map((kind) => {
              return (
                <MenuItem key={kind} value={kind}>
                  {ZONE_KIND_LABELS[kind]}
                </MenuItem>
              );
            })}
          </Select>

          {rectangle.zone && (
            <TextField
              label="Name"
              size="small"
              inputProps={{ maxLength: LABEL_MAX_LENGTH }}
              value={rectangle.name ?? ''}
              onChange={(e) => {
                const text = e.target.value.slice(0, LABEL_MAX_LENGTH);
                if ((rectangle.name ?? '') === text) return;

                updateRectangle(rectangle.id, {
                  name: text === '' ? undefined : text
                });
              }}
            />
          )}

          {rectangle.zone === 'subnet' && (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={rectangle.visibility ?? null}
              onChange={(e, newVisibility: ZoneVisibility | null) => {
                if (newVisibility === (rectangle.visibility ?? null)) return;

                updateRectangle(rectangle.id, {
                  visibility: newVisibility ?? undefined
                });
              }}
            >
              {zoneVisibilityOptions.map((visibility) => {
                return (
                  <ToggleButton key={visibility} value={visibility}>
                    {ZONE_VISIBILITY_LABELS[visibility]}
                  </ToggleButton>
                );
              })}
            </ToggleButtonGroup>
          )}
        </Stack>
      </Section>
      <Section>
        <Box>
          <DeleteButton
            onClick={() => {
              uiStateActions.setItemControls(null);
              deleteRectangle(rectangle.id);
            }}
          />
        </Box>
      </Section>
    </ControlsContainer>
  );
};
