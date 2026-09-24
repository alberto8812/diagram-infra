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
import { resolveItemGroups } from './resolveItemGroups';
import { routeFlatConnector } from './routeFlatConnector';
import { wrapLabel } from './wrapLabel';

// Rendering-only constants for the flat diagram: how the icon and label sit
// inside one FLAT_LAYOUT_ITEM_WIDTH x FLAT_LAYOUT_ITEM_HEIGHT cell from
// flatLayout.ts. Deliberately kept separate from that module's geometry
// constants — flatLayout.ts knows nothing about icons or text, by design
// (see its own comments), and this file must not modify it.
const ITEM_ICON_SIZE = 48;
const ITEM_LABEL_FONT_SIZE = 12;
const ITEM_LABEL_TOP_GAP = 10;
const ITEM_LABEL_LINE_HEIGHT = 14;
const GROUP_LABEL_FONT_SIZE = 13;
const GROUP_LABEL_PADDING = 12;
const CONNECTOR_STROKE = '#8a94a6';
const GROUP_BORDER_STROKE = '#8a94a6';
const CONNECTOR_ARROW_MARKER_ID = 'flat-diagram-connector-arrow';
const CONNECTOR_ARROW_SIZE = 8;

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
  const lines = useMemo(() => {
    return wrapLabel(label);
  }, [label]);

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
        {lines.length <= 1
          ? label
          : lines.map((line, index) => {
              return (
                <tspan
                  // Lines are positional and never reorder, so the index
                  // is a stable key here.
                  // eslint-disable-next-line react/no-array-index-key
                  key={index}
                  x={FLAT_LAYOUT_ITEM_WIDTH / 2}
                  dy={index === 0 ? 0 : ITEM_LABEL_LINE_HEIGHT}
                >
                  {line}
                </tspan>
              );
            })}
      </text>
    </g>
  );
};

interface ConnectorLine {
  id: string;
  points: { x: number; y: number }[];
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

  // Groups derived geometrically from the view's named rectangles (see
  // resolveItemGroups) — the grouping the user actually drew on the canvas,
  // since `modelItem.group` is rarely filled in in practice.
  const derivedGroupById = useMemo(() => {
    return resolveItemGroups(scene.items, scene.rectangles);
  }, [scene.items, scene.rectangles]);

  // Only the current view's items feed the layout, mapped to the minimal
  // {id, group} shape buildFlatLayout expects. An item that somehow has no
  // matching ModelItem (should not happen in a valid model) is skipped
  // rather than crashing the whole view. `modelItem.group` is an explicit
  // manual override and wins whenever it's set; otherwise the group derived
  // from the containing named rectangle is used.
  const layoutInput = useMemo(() => {
    return scene.items.reduce<{ id: string; group?: string }[]>(
      (acc, viewItem) => {
        const modelItem = itemsById.get(viewItem.id);
        if (!modelItem) return acc;

        acc.push({
          id: viewItem.id,
          group: modelItem.group ?? derivedGroupById[viewItem.id]
        });
        return acc;
      },
      []
    );
  }, [scene.items, itemsById, derivedGroupById]);

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

  // One orthogonal polyline per connector, routed edge-to-edge between its
  // first and last anchor's resolved items (see routeFlatConnector) instead
  // of a straight centre-to-centre diagonal, so the line neither crosses
  // unrelated icons nor cuts through the start/end item itself. A connector
  // is skipped entirely when it has fewer than two anchors, when either
  // endpoint anchor references a tile rather than an item (`ref.item`
  // unset), or when the referenced item is not in this view's flat layout.
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

      const points = routeFlatConnector(
        {
          x: startPosition.x,
          y: startPosition.y,
          width: FLAT_LAYOUT_ITEM_WIDTH,
          height: FLAT_LAYOUT_ITEM_HEIGHT
        },
        {
          x: endPosition.x,
          y: endPosition.y,
          width: FLAT_LAYOUT_ITEM_WIDTH,
          height: FLAT_LAYOUT_ITEM_HEIGHT
        }
      );

      acc.push({ id: connector.id, points });

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
        <defs>
          <marker
            id={CONNECTOR_ARROW_MARKER_ID}
            viewBox={`0 0 ${CONNECTOR_ARROW_SIZE} ${CONNECTOR_ARROW_SIZE}`}
            refX={CONNECTOR_ARROW_SIZE - 1}
            refY={CONNECTOR_ARROW_SIZE / 2}
            markerWidth={CONNECTOR_ARROW_SIZE}
            markerHeight={CONNECTOR_ARROW_SIZE}
            orient="auto-start-reverse"
          >
            <path
              d={`M 0 0 L ${CONNECTOR_ARROW_SIZE} ${CONNECTOR_ARROW_SIZE / 2} L 0 ${CONNECTOR_ARROW_SIZE} z`}
              fill={CONNECTOR_STROKE}
            />
          </marker>
        </defs>

        <g data-testid="flat-diagram-connectors">
          {connectorLines.map((line) => {
            return (
              <polyline
                key={line.id}
                data-testid={`flat-diagram-connector-${line.id}`}
                points={line.points
                  .map((point) => {
                    return `${point.x},${point.y}`;
                  })
                  .join(' ')}
                fill="none"
                stroke={CONNECTOR_STROKE}
                strokeWidth={1.5}
                markerEnd={`url(#${CONNECTOR_ARROW_MARKER_ID})`}
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
