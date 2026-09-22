import React, { useState } from 'react';
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
import { LABEL_MAX_LENGTH } from 'src/schemas/common';
import { parsePortInput, PORT_MIN, PORT_MAX } from 'src/utils/parsePortInput';
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
  // Local buffer for the port field only: a `type="number"` input reports
  // '' for both a genuinely empty field and invalid/partial text (e.g. "-"),
  // so the committed model value alone can't drive the displayed text
  // without either reverting in-progress keystrokes or clearing the stored
  // port. See parsePortInput().
  const [portText, setPortText] = useState(() => {
    return modelItem.port !== undefined ? String(modelItem.port) : '';
  });

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
            inputProps={{ maxLength: LABEL_MAX_LENGTH }}
            value={modelItem.engine ?? ''}
            onChange={(e) => {
              const text = e.target.value.slice(0, LABEL_MAX_LENGTH);
              if ((modelItem.engine ?? '') === text) return;

              onModelItemUpdated({ engine: text === '' ? undefined : text });
            }}
          />

          <TextField
            label="Version"
            size="small"
            inputProps={{ maxLength: LABEL_MAX_LENGTH }}
            value={modelItem.version ?? ''}
            onChange={(e) => {
              const text = e.target.value.slice(0, LABEL_MAX_LENGTH);
              if ((modelItem.version ?? '') === text) return;

              onModelItemUpdated({ version: text === '' ? undefined : text });
            }}
          />

          <TextField
            label="Port"
            size="small"
            type="number"
            inputProps={{ min: PORT_MIN, max: PORT_MAX }}
            value={portText}
            onChange={(e) => {
              const text = e.target.value;
              setPortText(text);

              const result = parsePortInput(text, e.target.validity.badInput);

              if (result.action === 'ignore') return;

              if (result.action === 'clear') {
                if (modelItem.port !== undefined)
                  onModelItemUpdated({ port: undefined });
                return;
              }

              if (modelItem.port !== result.value)
                onModelItemUpdated({ port: result.value });
            }}
          />

          <TextField
            label="Region"
            size="small"
            inputProps={{ maxLength: LABEL_MAX_LENGTH }}
            value={modelItem.region ?? ''}
            onChange={(e) => {
              const text = e.target.value.slice(0, LABEL_MAX_LENGTH);
              if ((modelItem.region ?? '') === text) return;

              onModelItemUpdated({ region: text === '' ? undefined : text });
            }}
          />

          <TextField
            label="Owner"
            size="small"
            inputProps={{ maxLength: LABEL_MAX_LENGTH }}
            value={modelItem.owner ?? ''}
            onChange={(e) => {
              const text = e.target.value.slice(0, LABEL_MAX_LENGTH);
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
