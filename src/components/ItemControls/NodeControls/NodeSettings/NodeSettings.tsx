import React, { useEffect, useMemo, useState } from 'react';
import {
  Slider,
  Box,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Select,
  MenuItem,
  Typography
} from '@mui/material';
import {
  ModelItem,
  ViewItem,
  iconStyleOptions,
  IconStyle,
  resourceKindOptions,
  ResourceKind,
  environmentOptions,
  Environment,
  dataClassificationOptions,
  DataClassification
} from 'src/types';
import { MarkdownEditor } from 'src/components/MarkdownEditor/MarkdownEditor';
import { useModelItem } from 'src/hooks/useModelItem';
import { useIcon } from 'src/hooks/useIcon';
import { useScene } from 'src/hooks/useScene';
import { NODE_ICON_STYLE_DEFAULT } from 'src/config';
import { LABEL_MAX_LENGTH } from 'src/schemas/common';
import { parsePortInput, PORT_MIN, PORT_MAX } from 'src/utils/parsePortInput';
import {
  parseNumberInput,
  decideBufferedNumberInput
} from 'src/utils/parseNumberInput';
import { getItemZones } from 'src/utils/containment';
import { ZONE_KIND_LABELS } from 'src/utils/zoneLabels';
import { catalog, estimateItemCost } from 'src/cost';
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

const DATA_CLASSIFICATION_LABELS: Record<DataClassification, string> = {
  public: 'Public',
  internal: 'Internal',
  confidential: 'Confidential',
  restricted: 'Restricted'
};

// A tri-state (yes/no/unset) toggle pair backed by an exclusive
// ToggleButtonGroup — clicking the currently-selected option deselects it
// (MUI reports `null`), which this maps back to `undefined`. Mirrors the
// existing environment ToggleButtonGroup's clear-by-reclick behavior above.
type TriStateValue = boolean | undefined;

const triStateToToggleValue = (value: TriStateValue): 'yes' | 'no' | null => {
  if (value === undefined) return null;
  return value ? 'yes' : 'no';
};

const toggleValueToTriState = (value: 'yes' | 'no' | null): TriStateValue => {
  if (value === null) return undefined;
  return value === 'yes';
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
  const { currentView } = useScene();

  // Read-only: the node's containing zones for the current view, innermost
  // to outermost (P0 containment zones, src/utils/containment.ts). Zones
  // are edited on the rectangle itself (RectangleControls), not here.
  const zones = useMemo(() => {
    return getItemZones(currentView, node.id);
  }, [currentView, node.id]);
  // Local buffer for the port field only: a `type="number"` input reports
  // '' for both a genuinely empty field and invalid/partial text (e.g. "-"),
  // so the committed model value alone can't drive the displayed text
  // without either reverting in-progress keystrokes or clearing the stored
  // port. See parsePortInput().
  const [portText, setPortText] = useState(() => {
    return modelItem.port !== undefined ? String(modelItem.port) : '';
  });

  // Re-sync the buffer when the model's port changes for a reason other
  // than this field's own onChange (e.g. undo/redo, a remote update).
  // Comparing through parsePortInput (rather than the raw string) avoids
  // clobbering an in-progress, not-yet-committed keystroke that still
  // represents the same stored value.
  useEffect(() => {
    const buffered = parsePortInput(portText, false);
    const bufferedValue =
      buffered.action === 'set' ? buffered.value : undefined;

    if (bufferedValue !== modelItem.port) {
      setPortText(modelItem.port !== undefined ? String(modelItem.port) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelItem.port]);

  // Same local-buffer reasoning as portText above (P4 cost estimation
  // sizing fields).
  const [countText, setCountText] = useState(() => {
    return modelItem.count !== undefined ? String(modelItem.count) : '';
  });
  useEffect(() => {
    const buffered = parseNumberInput(countText, false, {
      min: 1,
      integer: true
    });
    const bufferedValue =
      buffered.action === 'set' ? buffered.value : undefined;

    if (bufferedValue !== modelItem.count) {
      setCountText(
        modelItem.count !== undefined ? String(modelItem.count) : ''
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelItem.count]);

  const [storageText, setStorageText] = useState(() => {
    return modelItem.storageGb !== undefined ? String(modelItem.storageGb) : '';
  });
  useEffect(() => {
    const buffered = parseNumberInput(storageText, false, { min: 0 });
    const bufferedValue =
      buffered.action === 'set' ? buffered.value : undefined;

    if (bufferedValue !== modelItem.storageGb) {
      setStorageText(
        modelItem.storageGb !== undefined ? String(modelItem.storageGb) : ''
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelItem.storageGb]);

  // Read-only: a rough monthly estimate from the local price catalog (P4
  // cost estimation, src/cost) — recomputed from the current sizing fields
  // on every render rather than stored, since it's cheap and must never
  // drift from what's actually set.
  const costEstimate = useMemo(() => {
    return estimateItemCost(modelItem, catalog);
  }, [modelItem]);

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
      {zones.length > 0 && (
        <Section title="Located in">
          <Typography variant="body2" color="text.secondary">
            {zones
              .map((zone) => {
                return zone.name ?? ZONE_KIND_LABELS[zone.zone];
              })
              .join(' → ')}
          </Typography>
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

          <TextField
            label="Group"
            size="small"
            inputProps={{ maxLength: LABEL_MAX_LENGTH }}
            value={modelItem.group ?? ''}
            onChange={(e) => {
              const text = e.target.value.slice(0, LABEL_MAX_LENGTH);
              if ((modelItem.group ?? '') === text) return;

              onModelItemUpdated({ group: text === '' ? undefined : text });
            }}
          />

          <TextField
            label="Size"
            size="small"
            placeholder="e.g. db.t3.medium"
            helperText="Instance type/tier — used for the cost estimate below."
            inputProps={{ maxLength: LABEL_MAX_LENGTH }}
            value={modelItem.size ?? ''}
            onChange={(e) => {
              const text = e.target.value.slice(0, LABEL_MAX_LENGTH);
              if ((modelItem.size ?? '') === text) return;

              onModelItemUpdated({ size: text === '' ? undefined : text });
            }}
          />

          <TextField
            label="Count"
            size="small"
            type="number"
            inputProps={{ min: 1, step: 1 }}
            value={countText}
            onChange={(e) => {
              const text = e.target.value;
              setCountText(text);

              const decision = decideBufferedNumberInput(
                text,
                e.target.validity.badInput,
                { min: 1, integer: true },
                modelItem.count
              );

              if (decision.commit)
                onModelItemUpdated({ count: decision.value });
            }}
          />

          <TextField
            label="Storage (GB)"
            size="small"
            type="number"
            inputProps={{ min: 0, step: 1 }}
            value={storageText}
            onChange={(e) => {
              const text = e.target.value;
              setStorageText(text);

              const decision = decideBufferedNumberInput(
                text,
                e.target.validity.badInput,
                { min: 0 },
                modelItem.storageGb
              );

              if (decision.commit)
                onModelItemUpdated({ storageGb: decision.value });
            }}
          />

          {costEstimate.confidence !== 'unknown' && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Estimated cost
              </Typography>
              <Typography variant="body2">
                ${costEstimate.monthlyUsd.toFixed(2)}/month
                {costEstimate.confidence === 'approximate'
                  ? ' (approximate)'
                  : ''}
              </Typography>
            </Box>
          )}
        </Stack>
      </Section>
      <Section title="Security">
        <Stack spacing={2}>
          <Select
            size="small"
            displayEmpty
            value={modelItem.dataClassification ?? ''}
            onChange={(e) => {
              const value = e.target.value as DataClassification | '';
              onModelItemUpdated({
                dataClassification: value === '' ? undefined : value
              });
            }}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {dataClassificationOptions.map((classification) => {
              return (
                <MenuItem key={classification} value={classification}>
                  {DATA_CLASSIFICATION_LABELS[classification]}
                </MenuItem>
              );
            })}
          </Select>

          <Box>
            <Typography variant="caption" color="text.secondary">
              Encrypted at rest
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={triStateToToggleValue(modelItem.encryptedAtRest)}
              onChange={(e, newValue: 'yes' | 'no' | null) => {
                onModelItemUpdated({
                  encryptedAtRest: toggleValueToTriState(newValue)
                });
              }}
            >
              <ToggleButton value="yes">Yes</ToggleButton>
              <ToggleButton value="no">No</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary">
              Internet-facing
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={triStateToToggleValue(modelItem.internetFacing)}
              onChange={(e, newValue: 'yes' | 'no' | null) => {
                onModelItemUpdated({
                  internetFacing: toggleValueToTriState(newValue)
                });
              }}
            >
              <ToggleButton value="yes">Yes</ToggleButton>
              <ToggleButton value="no">No</ToggleButton>
            </ToggleButtonGroup>
          </Box>
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
