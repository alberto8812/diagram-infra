import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  Box,
  Stack,
  Select,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  useTheme
} from '@mui/material';
import Isoflow, { Model, InitialData } from 'src/Isoflow';
import { initialData, icons } from '../initialData';
import {
  saveDiagram,
  loadDiagram,
  listDiagrams,
  createDiagram,
  duplicateDiagram,
  debounce,
  createRequestGuard,
  isValidDiagramName,
  DEFAULT_DIAGRAM_NAME,
  DiagramApiError,
  DiagramSummary
} from '../persistence';

const SAVE_DEBOUNCE_MS = 500;
const CURRENT_DIAGRAM_STORAGE_KEY = 'isoflow:currentDiagram';

const readStoredDiagramName = (): string => {
  try {
    const stored = window.localStorage.getItem(CURRENT_DIAGRAM_STORAGE_KEY);

    return stored && isValidDiagramName(stored) ? stored : DEFAULT_DIAGRAM_NAME;
  } catch (err) {
    return DEFAULT_DIAGRAM_NAME;
  }
};

const writeStoredDiagramName = (name: string) => {
  try {
    window.localStorage.setItem(CURRENT_DIAGRAM_STORAGE_KEY, name);
  } catch (err) {
    // Best-effort only; the picker still works without it.
  }
};

type DialogMode = 'new' | 'duplicate' | null;

// Small MUI dialog shared by "New" and "Duplicate": both just collect and
// validate a target diagram name before calling the server.
const NameDialog = ({
  mode,
  sourceName,
  onClose,
  onSubmit
}: {
  mode: Exclude<DialogMode, null>;
  sourceName: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!isValidDiagramName(name)) {
      setError(
        'Use 1-64 lowercase letters, numbers or dashes, starting with a letter or number.'
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(name);
    } catch (err) {
      setSubmitting(false);
      setError(
        err instanceof DiagramApiError
          ? err.message
          : 'Could not reach the diagram server.'
      );
      return;
    }

    setSubmitting(false);
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {mode === 'new' ? 'New diagram' : `Duplicate "${sourceName}"`}
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          label="Diagram name"
          placeholder="e.g. network"
          value={name}
          disabled={submitting}
          error={Boolean(error)}
          helperText={error ?? ' '}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {mode === 'new' ? 'Create' : 'Duplicate'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const BasicEditor = () => {
  const theme = useTheme();
  const [diagramName, setDiagramName] = useState<string>(readStoredDiagramName);
  const [diagrams, setDiagrams] = useState<DiagramSummary[]>([]);
  const [restored, setRestored] = useState<InitialData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);

  // Read by the stable debounced save below, so the save always targets the
  // diagram currently being edited without needing to recreate the
  // debounced function (and its pending timer) on every switch.
  const currentNameRef = useRef(diagramName);

  // The most recently started save, whether triggered by the debounce timer
  // or by flush(). flush() only resolves a call it actually triggers; a call
  // the timer already started earlier (and is still in flight, e.g. waiting
  // on the PUT) leaves nothing pending for flush() to find. Tracking it here
  // lets callers wait for that in-flight save too, not just a pending one.
  const pendingSaveRef = useRef<Promise<void>>(Promise.resolve());

  // A single debounced save for the component's lifetime. onModelUpdated
  // fires on every model change, including each frame of a drag, so the
  // write is debounced rather than issued per event.
  //
  // The target name is a parameter, not a read of currentNameRef here: debounce()
  // captures its arguments when the call is *scheduled*, so passing
  // currentNameRef.current at the call site (below) binds the save to whichever
  // diagram was being edited at that moment. Reading the ref inside this
  // callback instead would read it when the timer *fires*, which can be after
  // switchDiagram has already moved the ref on to a different diagram.
  const debouncedSave = useMemo(() => {
    return debounce((name: string, model: Model) => {
      const savePromise = saveDiagram(name, model);
      pendingSaveRef.current = savePromise;
      return savePromise;
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // Ensures the save for the diagram currently being edited has actually
  // landed (or failed) before moving on, covering both a debounced call
  // still waiting out its timer and one already in flight. saveDiagram()
  // never rejects (it already falls back to localStorage on its own), but
  // the catch is kept so a future change there can't wedge switching.
  const flushPendingSave = useCallback(async () => {
    try {
      await debouncedSave.flush();
    } catch (err) {
      // Ignored: never let a save failure block switching or duplicating.
    }

    try {
      await pendingSaveRef.current;
    } catch (err) {
      // Same as above.
    }
  }, [debouncedSave]);

  // Guards against overlapping diagram switches: if the user picks A then B
  // before A's load resolves, only B's result should ever be applied.
  const switchGuard = useRef(createRequestGuard()).current;

  const refreshDiagramList = useCallback(() => {
    listDiagrams().then(setDiagrams);
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadDiagram(diagramName, icons).then((data) => {
      if (cancelled) return;

      setRestored(data);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
    // Only the initial diagram: later switches go through switchDiagram(),
    // which drives restored/isLoading itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshDiagramList();
  }, [refreshDiagramList]);

  // Switches the diagram being edited. The pending (or in-flight) save for
  // the diagram being left is flushed and AWAITED first, before
  // currentNameRef (or any state) changes — otherwise a save still landing
  // when the user switches away could apply under the new name, or a switch
  // straight back could GET stale content that hadn't been written yet.
  //
  // Overlapping switches (A then B before A's load resolves) are guarded by
  // a request token: only the call that is still the latest one when its
  // await resumes is allowed to apply its result, so the last *requested*
  // switch always wins rather than the last to *resolve*.
  const switchDiagram = useCallback(
    async (name: string) => {
      const requestId = switchGuard.next();

      await flushPendingSave();

      if (!switchGuard.isLatest(requestId)) return;

      setIsLoading(true);

      const data = await loadDiagram(name, icons);

      if (!switchGuard.isLatest(requestId)) return;

      // An edit made while awaiting flushPendingSave()/loadDiagram() above can
      // schedule a new debounced call bound (at schedule time) to the diagram
      // being left. debounce() only remembers one pending call, so once
      // editing resumes against the new diagram below, a still-pending call
      // for the old one would be silently overwritten and lost. Flushing here
      // lands it first, before currentNameRef moves on.
      await flushPendingSave();

      currentNameRef.current = name;
      setDiagramName(name);
      writeStoredDiagramName(name);
      setRestored(data);
      setIsLoading(false);
    },
    [flushPendingSave, switchGuard]
  );

  const selectOptions = useMemo(() => {
    const names = diagrams.map((d) => {
      return d.name;
    });

    return names.includes(diagramName) ? names : [diagramName, ...names];
  }, [diagrams, diagramName]);

  const handleDialogSubmit = async (name: string) => {
    if (dialogMode === 'new') {
      await createDiagram(name);
    } else {
      // Duplicate reads the source diagram server-side, so the pending (or
      // in-flight) save for it must land first — otherwise it copies
      // whatever was last written instead of what's on screen.
      await flushPendingSave();
      await duplicateDiagram(diagramName, name);
    }

    setDialogMode(null);
    await switchDiagram(name);
    refreshDiagramList();
  };

  // Mounting Isoflow before the restore resolves would seed it with the example
  // and immediately overwrite the saved diagram.
  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      {!isLoading && (
        <Isoflow
          key={diagramName}
          initialData={restored ?? { ...initialData, fitToView: true }}
          onModelUpdated={(model) => {
            debouncedSave(currentNameRef.current, model);
          }}
        />
      )}

      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{
          position: 'absolute',
          bgcolor: 'common.white',
          borderRadius: 1,
          boxShadow: 1,
          px: 1,
          py: 0.5
        }}
        style={{
          top:
            theme.customVars.appPadding.y +
            theme.customVars.toolMenu.height +
            parseInt(theme.spacing(1), 10),
          right: theme.customVars.appPadding.x
        }}
      >
        <Select
          size="small"
          value={diagramName}
          sx={{ minWidth: 140, fontSize: 14 }}
          onChange={(e) => {
            const name = e.target.value as string;
            if (name !== diagramName) switchDiagram(name);
          }}
        >
          {selectOptions.map((name) => {
            return (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            );
          })}
        </Select>
        <Button
          size="small"
          onClick={() => {
            setDialogMode('new');
          }}
        >
          New
        </Button>
        <Button
          size="small"
          onClick={() => {
            setDialogMode('duplicate');
          }}
        >
          Duplicate
        </Button>
      </Stack>

      {dialogMode && (
        <NameDialog
          mode={dialogMode}
          sourceName={diagramName}
          onClose={() => {
            setDialogMode(null);
          }}
          onSubmit={handleDialogSubmit}
        />
      )}
    </Box>
  );
};
