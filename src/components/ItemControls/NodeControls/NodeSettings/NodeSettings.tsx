import React from 'react';
import {
  Slider,
  Box,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Select,
  MenuItem
} from '@mui/material';
import {
  ModelItem,
  ViewItem,
  iconStyleOptions,
  IconStyle,
  resourceKindOptions,
  ResourceKind,
  environmentOptions,
  Environment
} from 'src/types';
import { MarkdownEditor } from 'src/components/MarkdownEditor/MarkdownEditor';
import { useModelItem } from 'src/hooks/useModelItem';
import { useIcon } from 'src/hooks/useIcon';
import { NODE_ICON_STYLE_DEFAULT } from 'src/config';
import { DeleteButton } from '../../components/DeleteButton';
import { Section } from '../../components/Section';

const ICON_STYLE_LABELS: Record<IconStyle, string> = {
  BLOCK: 'Isometric block',
  FLAT: 'Flat'
};

const RESOURCE_KIND_LABELS: Record<ResourceKind, string> = {
  service: 'Service',
  database: 'Database',
  cache: 'Cache',
  queue: 'Queue',
  loadBalancer: 'Load balancer',
  gateway: 'Gateway',
  storage: 'Storage',
  runner: 'Runner',
  network: 'Network',
  user: 'User',
  external: 'External'
};

const ENVIRONMENT_LABELS: Record<Environment, string> = {
  dev: 'Dev',
  test: 'Test',
  prod: 'Prod'
};

const MIN_PORT = 1;
const MAX_PORT = 65535;

export type NodeUpdates = {
  model: Partial<ModelItem>;
  view: Partial<ViewItem>;
};

interface Props {
  node: ViewItem;
  onModelItemUpdated: (updates: Partial<ModelItem>) => void;
  onViewItemUpdated: (updates: Partial<ViewItem>) => void;
  onDeleted: () => void;
}

export const NodeSettings = ({
  node,
  onModelItemUpdated,
  onViewItemUpdated,
  onDeleted
}: Props) => {
  const modelItem = useModelItem(node.id);
  const { icon } = useIcon(modelItem.icon);

  return (
    <>
      <Section title="Name">
        <TextField
          value={modelItem.name}
          onChange={(e) => {
            const text = e.target.value as string;
            if (modelItem.name !== text) onModelItemUpdated({ name: text });
          }}
        />
      </Section>
      <Section title="Description">
        <MarkdownEditor
          value={modelItem.description}
          onChange={(text) => {
            if (modelItem.description !== text)
              onModelItemUpdated({ description: text });
          }}
        />
      </Section>
      {modelItem.name && (
        <Section title="Label height">
          <Slider
            marks
            step={20}
            min={60}
            max={280}
            value={node.labelHeight}
            onChange={(e, newHeight) => {
              const labelHeight = newHeight as number;
              onViewItemUpdated({ labelHeight });
            }}
          />
        </Section>
      )}
      {!icon.isIsometric && (
        <Section title="Icon style">
          <ToggleButtonGroup
            exclusive
            value={modelItem.iconStyle ?? NODE_ICON_STYLE_DEFAULT}
            onChange={(e, newStyle: IconStyle | null) => {
              if (newStyle === null || newStyle === modelItem.iconStyle) return;

              onModelItemUpdated({ iconStyle: newStyle });
            }}
          >
            {iconStyleOptions.map((style) => {
              return (
                <ToggleButton key={style} value={style}>
                  {ICON_STYLE_LABELS[style]}
                </ToggleButton>
              );
            })}
          </ToggleButtonGroup>
        </Section>
      )}
      <Section title="Resource">
        <Stack spacing={2}>
          <Select
            size="small"
            displayEmpty
            value={modelItem.kind ?? ''}
            onChange={(e) => {
              const value = e.target.value as ResourceKind | '';
              onModelItemUpdated({ kind: value === '' ? undefined : value });
            }}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {resourceKindOptions.map((kind) => {
              return (
                <MenuItem key={kind} value={kind}>
                  {RESOURCE_KIND_LABELS[kind]}
                </MenuItem>
              );
            })}
          </Select>

          <ToggleButtonGroup
            exclusive
            size="small"
            value={modelItem.environment ?? null}
            onChange={(e, newEnvironment: Environment | null) => {
              if (newEnvironment === (modelItem.environment ?? null)) return;

              onModelItemUpdated({
                environment: newEnvironment ?? undefined
              });
            }}
          >
            {environmentOptions.map((environment) => {
              return (
                <ToggleButton key={environment} value={environment}>
                  {ENVIRONMENT_LABELS[environment]}
                </ToggleButton>
              );
            })}
          </ToggleButtonGroup>

          <TextField
            label="Engine"
            size="small"
            value={modelItem.engine ?? ''}
            onChange={(e) => {
              const text = e.target.value;
              if ((modelItem.engine ?? '') === text) return;

              onModelItemUpdated({ engine: text === '' ? undefined : text });
            }}
          />

          <TextField
            label="Version"
            size="small"
            value={modelItem.version ?? ''}
            onChange={(e) => {
              const text = e.target.value;
              if ((modelItem.version ?? '') === text) return;

              onModelItemUpdated({ version: text === '' ? undefined : text });
            }}
          />

          <TextField
            label="Port"
            size="small"
            type="number"
            inputProps={{ min: MIN_PORT, max: MAX_PORT }}
            value={modelItem.port ?? ''}
            onChange={(e) => {
              const text = e.target.value;

              if (text === '') {
                if (modelItem.port !== undefined)
                  onModelItemUpdated({ port: undefined });
                return;
              }

              const parsed = Number(text);
              if (
                !Number.isInteger(parsed) ||
                parsed < MIN_PORT ||
                parsed > MAX_PORT
              )
                return;

              if (modelItem.port !== parsed)
                onModelItemUpdated({ port: parsed });
            }}
          />

          <TextField
            label="Region"
            size="small"
            value={modelItem.region ?? ''}
            onChange={(e) => {
              const text = e.target.value;
              if ((modelItem.region ?? '') === text) return;

              onModelItemUpdated({ region: text === '' ? undefined : text });
            }}
          />

          <TextField
            label="Owner"
            size="small"
            value={modelItem.owner ?? ''}
            onChange={(e) => {
              const text = e.target.value;
              if ((modelItem.owner ?? '') === text) return;

              onModelItemUpdated({ owner: text === '' ? undefined : text });
            }}
          />
        </Stack>
      </Section>
      <Section>
        <Box>
          <DeleteButton onClick={onDeleted} />
        </Box>
      </Section>
    </>
  );
};
