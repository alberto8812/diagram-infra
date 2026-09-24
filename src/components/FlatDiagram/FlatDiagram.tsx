import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { useModelStore } from 'src/stores/modelStore';
import { useScene } from 'src/hooks/useScene';
import { useIcon } from 'src/hooks/useIcon';
import { ModelItem } from 'src/types';
import {
  buildFlatLayout,
  FLAT_LAYOUT_ITEM_WIDTH,
  FLAT_LAYOUT_ITEM_HEIGHT
} from 'src/utils/flatLayout';
import { resolveItemLabels } from './resolveItemLabels';

// Rendering-only constants for the flat diagram: how the icon and label sit
// inside one FLAT_LAYOUT_ITEM_WIDTH x FLAT_LAYOUT_ITEM_HEIGHT cell from
// flatLayout.ts. Deliberately kept separate from that module's geometry
// constants — flatLayout.ts knows nothing about icons or text, by design
// (see its own comments), and this file must not modify it.
const ITEM_ICON_SIZE = 48;
const ITEM_LABEL_FONT_SIZE = 12;
const ITEM_LABEL_TOP_GAP = 10;
const GROUP_LABEL_FONT_SIZE = 13;
const GROUP_LABEL_PADDING = 12;
const CONNECTOR_STROKE = '#8a94a6';
const GROUP_BORDER_STROKE = '#8a94a6';

interface FlatDiagramItemNodeProps {
  modelItem: ModelItem;
  x: number;
  y: number;
  label: string;
}

// One item's icon + label. A separate component (not inlined in a loop) so
// each item can call the useIcon hook for itself, as React's rules of hooks
// require. Renders the icon flat, on purpose: it reads `icon.url` straight
// off the resolved Icon and draws its own plain <image>, rather than using
// useIcon's `iconComponent` (which would pick the extruded isometric block
// by default per NODE_ICON_STYLE_DEFAULT) or reusing NonIsometricIcon (which
// applies the isometric CSS transform for placement inside the projected
// scene). Neither is appropriate here: this view always wants a flat icon,
// regardless of the item's own iconStyle or the isometric projection.
const FlatDiagramItemNode = ({
  modelItem,
  x,
  y,
  label
}: FlatDiagramItemNodeProps) => {
  const { icon } = useIcon(modelItem.icon);

  return (
    <g
      transform={`translate(${x}, ${y})`}
      data-testid={`flat-diagram-item-${modelItem.id}`}
    >
      <title>{modelItem.name || '(untitled)'}</title>
      {icon.url && (
        <image
          href={icon.url}
          x={(FLAT_LAYOUT_ITEM_WIDTH - ITEM_ICON_SIZE) / 2}
          y={0}
          width={ITEM_ICON_SIZE}
          height={ITEM_ICON_SIZE}
        />
      )}
      <text
        x={FLAT_LAYOUT_ITEM_WIDTH / 2}
        y={ITEM_ICON_SIZE + ITEM_LABEL_TOP_GAP}
        textAnchor="middle"
        fontSize={ITEM_LABEL_FONT_SIZE}
      >
        {label}
      </text>
    </g>
  );
};

interface ConnectorLine {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Renders the current view's items/connectors as a flat, deterministic
// architecture diagram — an entirely separate, additive read-only view
// alongside the isometric one. Layout comes straight from
// src/utils/flatLayout.ts (not reimplemented here); this component only
// resolves item/group/connector data and draws it as plain SVG, which
// exports cleanly and keeps this view independent of useIsoProjection and
// the isometric rendering pipeline.
export const FlatDiagram = () => {
  const scene = useScene();
  const modelItems = useModelStore((state) => {
    return state.items;
  });

  const itemsById = useMemo(() => {
    return new Map(
      modelItems.map((item) => {
        return [item.id, item] as const;
      })
    );
  }, [modelItems]);

  // Only the current view's items feed the layout, mapped to the minimal
  // {id, group} shape buildFlatLayout expects. An item that somehow has no
  // matching ModelItem (should not happen in a valid model) is skipped
  // rather than crashing the whole view.
  const layoutInput = useMemo(() => {
    return scene.items.reduce<{ id: string; group?: string }[]>(
      (acc, viewItem) => {
        const modelItem = itemsById.get(viewItem.id);
        if (!modelItem) return acc;

        acc.push({ id: viewItem.id, group: modelItem.group });
        return acc;
      },
      []
    );
  }, [scene.items, itemsById]);

  const layout = useMemo(() => {
    return buildFlatLayout(layoutInput);
  }, [layoutInput]);

  // Flattened in layout (left-to-right, top-to-bottom) order, since that is
  // the order duplicate-name numbering should read in.
  const orderedLayoutItems = useMemo(() => {
    return layout.groups.flatMap((group) => {
      return group.items;
    });
  }, [layout]);

  const labelById = useMemo(() => {
    const namedItems = orderedLayoutItems.reduce<
      { id: string; name: string }[]
    >((acc, item) => {
      const modelItem = itemsById.get(item.id);
      if (!modelItem) return acc;

      acc.push({ id: item.id, name: modelItem.name });
      return acc;
    }, []);

    return resolveItemLabels(namedItems);
  }, [orderedLayoutItems, itemsById]);

  const positionById = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();

    orderedLayoutItems.forEach((item) => {
      map.set(item.id, { x: item.x, y: item.y });
    });

    return map;
  }, [orderedLayoutItems]);

  // One straight line per connector between its first and last anchor's
  // resolved item centres. No orthogonal routing (explicitly out of scope).
  // A connector is skipped entirely when it has fewer than two anchors, when
  // either endpoint anchor references a tile rather than an item
  // (`ref.item` unset), or when the referenced item is not in this view's
  // flat layout.
  const connectorLines = useMemo(() => {
    return scene.connectors.reduce<ConnectorLine[]>((acc, connector) => {
      const { anchors } = connector;
      if (anchors.length < 2) return acc;

      const firstItemId = anchors[0].ref.item;
      const lastItemId = anchors[anchors.length - 1].ref.item;
      if (!firstItemId || !lastItemId) return acc;

      const startPosition = positionById.get(firstItemId);
      const endPosition = positionById.get(lastItemId);
      if (!startPosition || !endPosition) return acc;

      acc.push({
        id: connector.id,
        x1: startPosition.x + FLAT_LAYOUT_ITEM_WIDTH / 2,
        y1: startPosition.y + FLAT_LAYOUT_ITEM_HEIGHT / 2,
        x2: endPosition.x + FLAT_LAYOUT_ITEM_WIDTH / 2,
        y2: endPosition.y + FLAT_LAYOUT_ITEM_HEIGHT / 2
      });

      return acc;
    }, []);
  }, [scene.connectors, positionById]);

  const width = Math.max(layout.width, 1);
  const height = Math.max(layout.height, 1);

  return (
    <Box data-testid="flat-diagram" sx={{ display: 'inline-block' }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Flat architecture diagram"
      >
        <g data-testid="flat-diagram-connectors">
          {connectorLines.map((line) => {
            return (
              <line
                key={line.id}
                data-testid={`flat-diagram-connector-${line.id}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={CONNECTOR_STROKE}
                strokeWidth={2}
              />
            );
          })}
        </g>

        {layout.groups.map((group) => {
          return (
            <g
              key={group.name ?? '__ungrouped__'}
              data-testid={`flat-diagram-group-${group.name ?? '__ungrouped__'}`}
            >
              {group.name !== null && (
                <>
                  <rect
                    data-testid={`flat-diagram-group-border-${group.name}`}
                    x={group.x}
                    y={group.y}
                    width={group.width}
                    height={group.height}
                    fill="none"
                    stroke={GROUP_BORDER_STROKE}
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                    rx={8}
                  />
                  <text
                    data-testid="flat-diagram-group-label"
                    x={group.x + GROUP_LABEL_PADDING}
                    y={group.y + GROUP_LABEL_PADDING + GROUP_LABEL_FONT_SIZE}
                    fontSize={GROUP_LABEL_FONT_SIZE}
                    fontWeight={600}
                  >
                    {group.name}
                  </text>
                </>
              )}

              {group.items.map((item) => {
                const modelItem = itemsById.get(item.id);
                if (!modelItem) return null;

                return (
                  <FlatDiagramItemNode
                    key={item.id}
                    modelItem={modelItem}
                    x={item.x}
                    y={item.y}
                    label={labelById.get(item.id) ?? modelItem.name}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
    </Box>
  );
};
