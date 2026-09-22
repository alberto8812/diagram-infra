import React, { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Chip,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import {
  Close as CloseIcon,
  ErrorOutline as ErrorIcon,
  InfoOutlined as InfoIcon,
  SecurityOutlined as SecurityIcon,
  WarningAmberOutlined as WarningIcon
} from '@mui/icons-material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useModelStore } from 'src/stores/modelStore';
import { useView } from 'src/hooks/useView';
import { useIssues } from 'src/hooks/useIssues';
import { Issue, RULES, RuleSeverity } from 'src/rules';
import { modelFromModelStore } from 'src/utils';

interface Props {
  onClose: () => void;
}

const SEVERITY_ORDER: RuleSeverity[] = ['error', 'warning', 'info'];

const SEVERITY_LABELS: Record<RuleSeverity, string> = {
  error: 'Errors',
  warning: 'Warnings',
  info: 'Info'
};

const SEVERITY_ICONS: Record<RuleSeverity, React.ReactNode> = {
  error: <ErrorIcon fontSize="small" color="error" />,
  warning: <WarningIcon fontSize="small" color="warning" />,
  info: <InfoIcon fontSize="small" color="info" />
};

const RULE_TITLES: Record<string, string> = RULES.reduce(
  (acc, rule) => {
    return { ...acc, [rule.id]: rule.title };
  },
  {} as Record<string, string>
);

// Reachable from the toolbar (see the "Issues" button in ToolMenu.tsx),
// this lists every lintDiagram() finding (src/rules), grouped by severity
// and filtered to the current view by default. Not a modal — it stays open
// as a floating panel so clicking an issue can select/open its target on
// the canvas underneath (src/components/UiOverlay/UiOverlay.tsx positions
// it the same way as ItemControls).
export const IssuesPanel = ({ onClose }: Props) => {
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });
  const currentViewId = useUiStateStore((state) => {
    return state.view;
  });
  // Only `actions` (a stable reference) is subscribed here — the model
  // itself is read through actions.get() at click time, when switching
  // views for a cross-view issue, so this panel doesn't re-render on every
  // model change on top of the narrower re-render useIssues() already does
  // (see src/hooks/useIssues.ts and the ViewSwitcher fix it mirrors).
  const modelActions = useModelStore((state) => {
    return state.actions;
  });
  const { changeView } = useView();

  const issues = useIssues();
  const [showAllViews, setShowAllViews] = useState(false);

  const visibleIssues = useMemo(() => {
    if (showAllViews) return issues;

    return issues.filter((issue) => {
      return issue.viewId === currentViewId;
    });
  }, [issues, showAllViews, currentViewId]);

  const counts = useMemo(() => {
    return issues.reduce(
      (acc, issue) => {
        return { ...acc, [issue.severity]: acc[issue.severity] + 1 };
      },
      { error: 0, warning: 0, info: 0 } as Record<RuleSeverity, number>
    );
  }, [issues]);

  const groups = useMemo(() => {
    return SEVERITY_ORDER.map((severity) => {
      return {
        severity,
        issues: visibleIssues.filter((issue) => {
          return issue.severity === severity;
        })
      };
    }).filter((group) => {
      return group.issues.length > 0;
    });
  }, [visibleIssues]);

  const handleSelect = useCallback(
    (issue: Issue) => {
      const target = issue.targets[0];
      if (!target) return;

      if (issue.viewId !== currentViewId) {
        changeView(issue.viewId, modelFromModelStore(modelActions.get()));
      }

      uiStateActions.setItemControls({ type: target.type, id: target.id });
    },
    [currentViewId, changeView, modelActions, uiStateActions]
  );

  return (
    <Box sx={{ width: 360, maxHeight: 'inherit', overflowY: 'auto', p: 2 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 1 }}
      >
        <Typography variant="subtitle1" fontWeight={600}>
          Issues
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <IconButton
            size="small"
            title="Security report"
            onClick={() => {
              uiStateActions.setDialog('SECURITY_REPORT');
            }}
          >
            <SecurityIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
        <Chip
          size="small"
          icon={SEVERITY_ICONS.error as React.ReactElement}
          label={counts.error}
          color={counts.error > 0 ? 'error' : 'default'}
          variant={counts.error > 0 ? 'filled' : 'outlined'}
        />
        <Chip
          size="small"
          icon={SEVERITY_ICONS.warning as React.ReactElement}
          label={counts.warning}
          color={counts.warning > 0 ? 'warning' : 'default'}
          variant={counts.warning > 0 ? 'filled' : 'outlined'}
        />
        <Chip
          size="small"
          icon={SEVERITY_ICONS.info as React.ReactElement}
          label={counts.info}
          variant="outlined"
        />
      </Stack>

      <ToggleButtonGroup
        exclusive
        size="small"
        value={showAllViews ? 'all' : 'current'}
        onChange={(e, value: 'current' | 'all' | null) => {
          if (value) setShowAllViews(value === 'all');
        }}
        sx={{ mb: 1.5 }}
      >
        <ToggleButton value="current">Current view</ToggleButton>
        <ToggleButton value="all">All views</ToggleButton>
      </ToggleButtonGroup>

      {visibleIssues.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No issues.
        </Typography>
      )}

      {groups.map((group, groupIndex) => {
        return (
          <Box key={group.severity} sx={{ mb: 1 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              textTransform="uppercase"
            >
              {SEVERITY_LABELS[group.severity]} ({group.issues.length})
            </Typography>

            <List dense disablePadding>
              {group.issues.map((issue, issueIndex) => {
                return (
                  <ListItemButton
                    // eslint-disable-next-line react/no-array-index-key
                    key={`${issue.ruleId}-${issue.viewId}-${issueIndex}`}
                    onClick={() => {
                      handleSelect(issue);
                    }}
                  >
                    <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
                      <Box sx={{ pt: 0.5 }}>
                        {SEVERITY_ICONS[issue.severity]}
                      </Box>
                      <ListItemText
                        primary={RULE_TITLES[issue.ruleId] ?? issue.ruleId}
                        secondary={issue.message}
                      />
                    </Stack>
                  </ListItemButton>
                );
              })}
            </List>

            {groupIndex < groups.length - 1 && <Divider sx={{ mt: 1 }} />}
          </Box>
        );
      })}
    </Box>
  );
};
