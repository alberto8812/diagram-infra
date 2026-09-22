import React from 'react';
import {
  Connector,
  connectorStyleOptions,
  connectorDirectionOptions,
  connectorProtocolOptions,
  ConnectorProtocol,
  connectorModeOptions,
  ConnectorCommunicationMode,
  connectorAuthOptions,
  ConnectorAuth
} from 'src/types';
import {
  Box,
  Stack,
  Slider,
  Select,
  MenuItem,
  TextField,
  FormControlLabel,
  Switch,
  ToggleButton,
  ToggleButtonGroup
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

const MODE_LABELS: Record<ConnectorCommunicationMode, string> = {
  sync: 'Sync',
  async: 'Async'
};

const AUTH_LABELS: Record<ConnectorAuth, string> = {
  none: 'None',
  basic: 'Basic',
  token: 'Token',
  mtls: 'mTLS',
  iam: 'IAM'
};

const MIN_PORT = 1;
const MAX_PORT = 65535;

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
      <Section title="Semantics">
        <Stack spacing={2}>
          <Select
            size="small"
            displayEmpty
            value={connector.protocol ?? ''}
            onChange={(e) => {
              const value = e.target.value as ConnectorProtocol | '';
              updateConnector(connector.id, {
                protocol: value === '' ? undefined : value
              });
            }}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {connectorProtocolOptions.map((protocol) => {
              return (
                <MenuItem key={protocol} value={protocol}>
                  {protocol}
                </MenuItem>
              );
            })}
          </Select>

          <TextField
            label="Port"
            size="small"
            type="number"
            inputProps={{ min: MIN_PORT, max: MAX_PORT }}
            value={connector.port ?? ''}
            onChange={(e) => {
              const text = e.target.value;

              if (text === '') {
                if (connector.port !== undefined)
                  updateConnector(connector.id, { port: undefined });
                return;
              }

              const parsed = Number(text);
              if (
                !Number.isInteger(parsed) ||
                parsed < MIN_PORT ||
                parsed > MAX_PORT
              )
                return;

              if (connector.port !== parsed)
                updateConnector(connector.id, { port: parsed });
            }}
          />

          <ToggleButtonGroup
            exclusive
            size="small"
            value={connector.mode ?? null}
            onChange={(e, newMode: ConnectorCommunicationMode | null) => {
              if (newMode === (connector.mode ?? null)) return;

              updateConnector(connector.id, { mode: newMode ?? undefined });
            }}
          >
            {connectorModeOptions.map((mode) => {
              return (
                <ToggleButton key={mode} value={mode}>
                  {MODE_LABELS[mode]}
                </ToggleButton>
              );
            })}
          </ToggleButtonGroup>

          <Select
            size="small"
            displayEmpty
            value={connector.auth ?? ''}
            onChange={(e) => {
              const value = e.target.value as ConnectorAuth | '';
              updateConnector(connector.id, {
                auth: value === '' ? undefined : value
              });
            }}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {connectorAuthOptions.map((auth) => {
              return (
                <MenuItem key={auth} value={auth}>
                  {AUTH_LABELS[auth]}
                </MenuItem>
              );
            })}
          </Select>
        </Stack>
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
