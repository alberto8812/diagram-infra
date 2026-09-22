import React, { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  Menu,
  MenuItem,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  TextField
} from '@mui/material';
import {
  ArrowDropDown as ArrowDropDownIcon,
  Check as CheckIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useModelStore } from 'src/stores/modelStore';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useView } from 'src/hooks/useView';
import {
  modelFromModelStore,
  VIEW_LAYER_PRESETS,
  getAvailableViewPresets,
  generateUniqueViewName,
  isValidViewName
} from 'src/utils';

// A small dialog offering the layer presets (Network, Application, Data,
// CI/CD) plus a custom name, for creating a new view ("Add layer").
const AddLayerDialog = ({
  existingNames,
  onClose,
  onCreate
}: {
  existingNames: string[];
  onClose: () => void;
  onCreate: (name: string) => void;
}) => {
  const [customName, setCustomName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const availablePresets = useMemo(() => {
    return getAvailableViewPresets(existingNames);
  }, [existingNames]);

  const handlePresetClick = useCallback(
    (preset: string) => {
      onCreate(generateUniqueViewName(preset, existingNames));
    },
    [existingNames, onCreate]
  );

  const handleCustomSubmit = useCallback(() => {
    if (!isValidViewName(customName)) {
      setError('Enter a name between 1 and 100 characters.');
      return;
    }

    onCreate(generateUniqueViewName(customName.trim(), existingNames));
  }, [customName, existingNames, onCreate]);

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add layer</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Layers are separate views of the same model. Pick a preset or name
          your own.
        </Typography>

        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
          {VIEW_LAYER_PRESETS.map((preset) => {
            const isAvailable = availablePresets.includes(preset);

            return (
              <Chip
                key={preset}
                label={preset}
                clickable={isAvailable}
                disabled={!isAvailable}
                onClick={
                  isAvailable
                    ? () => {
                        return handlePresetClick(preset);
                      }
                    : undefined
                }
              />
            );
          })}
        </Stack>

        <Divider sx={{ mb: 2 }} />

        <TextField
          autoFocus
          fullWidth
          size="small"
          label="Custom layer name"
          placeholder="e.g. Security"
          value={customName}
          error={Boolean(error)}
          helperText={error ?? ' '}
          onChange={(e) => {
            setCustomName(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCustomSubmit();
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleCustomSubmit}
          disabled={customName.trim().length === 0}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};

interface Props {
  // Whether view-creation ("Add layer") is offered. Switching between
  // existing views is always offered when there's more than one. Callers
  // pass false in read-only editor modes, where the model can't be mutated.
  editable?: boolean;
}

// Compact view switcher shown in the header breadcrumb: click the current
// view's name to switch between the model's views, or add a new one from a
// layer preset. Stays reachable (via "Add layer") even with a single view,
// as long as the editor is editable.
export const ViewSwitcher = ({ editable = true }: Props) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [addLayerOpen, setAddLayerOpen] = useState(false);

  const views = useModelStore((state) => {
    return state.views;
  });
  const currentViewId = useUiStateStore((state) => {
    return state.view;
  });
  // Only `actions` is subscribed here (a stable reference for the store's
  // lifetime), not the model itself: changeView/createView only need the
  // model inside their click handlers below, not for rendering, so reading
  // it through actions.get() at call time avoids re-rendering this component
  // on every model change (the previous `modelFromModelStore(state)`
  // selector returned a fresh object on every store update).
  const modelActions = useModelStore((state) => {
    return state.actions;
  });
  const { changeView, createView } = useView();

  const currentViewName = useMemo(() => {
    return (
      views.find((v) => {
        return v.id === currentViewId;
      })?.name ?? ''
    );
  }, [views, currentViewId]);

  const existingNames = useMemo(() => {
    return views.map((v) => {
      return v.name;
    });
  }, [views]);

  const openMenu = useCallback((e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  }, []);

  const closeMenu = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleSwitch = useCallback(
    (viewId: string) => {
      closeMenu();
      if (viewId !== currentViewId) {
        changeView(viewId, modelFromModelStore(modelActions.get()));
      }
    },
    [closeMenu, currentViewId, changeView, modelActions]
  );

  const handleOpenAddLayer = useCallback(() => {
    closeMenu();
    setAddLayerOpen(true);
  }, [closeMenu]);

  const handleCreate = useCallback(
    (name: string) => {
      setAddLayerOpen(false);
      createView({ name }, modelFromModelStore(modelActions.get()));
    },
    [createView, modelActions]
  );

  // With one view and nothing to switch to or add, fall back to the plain
  // (non-interactive) label the breadcrumb showed before this component.
  const isInteractive = editable || views.length > 1;

  if (!isInteractive) {
    return (
      <Typography variant="body2" fontWeight={600} color="text.primary" noWrap>
        {currentViewName}
      </Typography>
    );
  }

  return (
    <>
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.25}
        onClick={openMenu}
        // The breadcrumb container this sits in is pointerEvents: 'none' (it
        // is otherwise read-only text), so this, the one interactive element
        // in it, opts back in explicitly.
        sx={{ cursor: 'pointer', minWidth: 0, pointerEvents: 'auto' }}
      >
        <Typography
          variant="body2"
          fontWeight={600}
          color="text.primary"
          noWrap
        >
          {currentViewName}
        </Typography>
        <ArrowDropDownIcon fontSize="small" sx={{ color: 'text.secondary' }} />
      </Stack>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeMenu}>
        {views.length > 1 && [
          ...views.map((v) => {
            return (
              <MenuItem
                key={v.id}
                onClick={() => {
                  return handleSwitch(v.id);
                }}
              >
                <Box
                  sx={{
                    width: 20,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {v.id === currentViewId && (
                    <CheckIcon fontSize="small" color="primary" />
                  )}
                </Box>
                {v.name}
              </MenuItem>
            );
          }),
          editable && <Divider key="divider" />
        ]}

        {editable && (
          <MenuItem onClick={handleOpenAddLayer}>
            <Box
              sx={{
                width: 20,
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <AddIcon fontSize="small" />
            </Box>
            Add layer
          </MenuItem>
        )}
      </Menu>

      {editable && addLayerOpen && (
        <AddLayerDialog
          existingNames={existingNames}
          onClose={() => {
            setAddLayerOpen(false);
          }}
          onCreate={handleCreate}
        />
      )}
    </>
  );
};
