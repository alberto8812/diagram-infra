import React, { useMemo, useEffect } from 'react';
import { useModelStore } from 'src/stores/modelStore';
import { getItemByIdOrThrow } from 'src/utils';
import { IsometricIcon } from 'src/components/SceneLayers/Nodes/Node/IconTypes/IsometricIcon';
import { NonIsometricIcon } from 'src/components/SceneLayers/Nodes/Node/IconTypes/NonIsometricIcon';
import { IsometricBlockIcon } from 'src/components/SceneLayers/Nodes/Node/IconTypes/IsometricBlockIcon';
import { DEFAULT_ICON, NODE_ICON_STYLE_DEFAULT } from 'src/config';
import { IconStyle } from 'src/types';

// `iconStyle` is the owning model item's own T6 override (optional, falls
// back to NODE_ICON_STYLE_DEFAULT) — see src/schemas/modelItems.ts. It only
// affects non-isometric icons; isometric ones always render as-is.
export const useIcon = (id: string | undefined, iconStyle?: IconStyle) => {
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const icons = useModelStore((state) => {
    return state.icons;
  });

  const icon = useMemo(() => {
    if (!id) return DEFAULT_ICON;

    return getItemByIdOrThrow(icons, id).value;
  }, [icons, id]);

  useEffect(() => {
    setHasLoaded(false);
  }, [icon.url]);

  const iconComponent = useMemo(() => {
    if (!icon.isIsometric) {
      setHasLoaded(true);

      const effectiveStyle = iconStyle ?? NODE_ICON_STYLE_DEFAULT;

      if (effectiveStyle === 'BLOCK') {
        return <IsometricBlockIcon icon={icon} />;
      }

      return <NonIsometricIcon icon={icon} />;
    }

    return (
      <IsometricIcon
        url={icon.url}
        onImageLoaded={() => {
          setHasLoaded(true);
        }}
      />
    );
  }, [icon, iconStyle]);

  return {
    icon,
    iconComponent,
    hasLoaded
  };
};
