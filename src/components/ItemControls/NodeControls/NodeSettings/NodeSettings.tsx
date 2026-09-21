import React from 'react';
import {
  Slider,
  Box,
  TextField,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import { ModelItem, ViewItem, iconStyleOptions, IconStyle } from 'src/types';
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
      <Section>
        <Box>
          <DeleteButton onClick={onDeleted} />
        </Box>
      </Section>
    </>
  );
};
