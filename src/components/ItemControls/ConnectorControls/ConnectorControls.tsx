import React from 'react';
import {
  Connector,
  connectorStyleOptions,
  connectorDirectionOptions
} from 'src/types';
import {
  Box,
  Slider,
  Select,
  MenuItem,
  TextField,
  FormControlLabel,
  Switch
} from '@mui/material';
import { useConnector } from 'src/hooks/useConnector';
import { ColorSelector } from 'src/components/ColorSelector/ColorSelector';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import { ControlsContainer } from '../components/ControlsContainer';
import { Section } from '../components/Section';
import { DeleteButton } from '../components/DeleteButton';

interface Props {
  id: string;
}

const DIRECTION_LABELS: Record<Connector['direction'] & string, string> = {
  FORWARD: 'Forward',
  REVERSE: 'Reverse',
  BOTH: 'Both'
};

export const ConnectorControls = ({ id }: Props) => {
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });
  const connector = useConnector(id);
  const { updateConnector, deleteConnector } = useScene();

  return (
    <ControlsContainer>
      <Section>
        <TextField
          label="Description"
          value={connector.description}
          onChange={(e) => {
            updateConnector(connector.id, {
              description: e.target.value as string
            });
          }}
        />
      </Section>
      <Section>
        <ColorSelector
          onChange={(color) => {
            return updateConnector(connector.id, { color });
          }}
          activeColor={connector.color}
        />
      </Section>
      <Section title="Width">
        <Slider
          marks
          step={10}
          min={10}
          max={30}
          value={connector.width}
          onChange={(e, newWidth) => {
            updateConnector(connector.id, { width: newWidth as number });
          }}
        />
      </Section>
      <Section title="Style">
        <Select
          value={connector.style}
          onChange={(e) => {
            updateConnector(connector.id, {
              style: e.target.value as Connector['style']
            });
          }}
        >
          {Object.values(connectorStyleOptions).map((style) => {
            return <MenuItem value={style}>{style}</MenuItem>;
          })}
        </Select>
      </Section>
      <Section title="Flow">
        <FormControlLabel
          label="Animated flow"
          control={
            <Switch
              checked={connector.animated ?? false}
              onChange={(e) => {
                updateConnector(connector.id, {
                  animated: e.target.checked
                });
              }}
            />
          }
        />
        <Select
          value={connector.direction ?? 'FORWARD'}
          disabled={!connector.animated}
          onChange={(e) => {
            updateConnector(connector.id, {
              direction: e.target.value as Connector['direction']
            });
          }}
        >
          {Object.values(connectorDirectionOptions).map((direction) => {
            return (
              <MenuItem key={direction} value={direction}>
                {DIRECTION_LABELS[direction]}
              </MenuItem>
            );
          })}
        </Select>
      </Section>
      <Section>
        <Box>
          <DeleteButton
            onClick={() => {
              uiStateActions.setItemControls(null);
              deleteConnector(connector.id);
            }}
          />
        </Box>
      </Section>
    </ControlsContainer>
  );
};
