import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useActions } from '@/shared/hooks/useActions';
import { useWorkspaceContext } from '@/shared/hooks/useWorkspaceContext';
import { usePush } from '@/shared/hooks/usePush';
import { useRebase } from '@/shared/hooks/useRebase';
import { useRenameBranch } from '@/shared/hooks/useRenameBranch';
import { useBranchStatus } from '@/shared/hooks/useBranchStatus';
import { useUiPreferencesStore } from '@/shared/stores/useUiPreferencesStore';
import { ConfirmDialog } from '@vibe/ui/components/ConfirmDialog';
import { ForcePushDialog } from '@/shared/dialogs/command-bar/ForcePushDialog';
import { CommandBarDialog } from '@/shared/dialogs/command-bar/CommandBarDialog';
import { ResolveConflictsDialog } from '@/shared/dialogs/tasks/ResolveConflictsDialog';
import { GitPanel, type RepoInfo } from '@vibe/ui/components/GitPanel';
import { Actions } from '@/shared/actions';
import type { RepoAction } from '@vibe/ui/components/RepoCard';
import { workspacesApi, type Result } from '@/shared/lib/api';
import type {
  Workspace,
  RepoWithTargetBranch,
  Merge,
  GitOperationError,
} from 'shared/types';
import { RebaseInProgressDialog } from '@vibe/ui/components/RebaseInProgressDialog';

export interface GitPanelContainerProps {
  selectedWorkspace: Workspace | undefined;
  repos: RepoWithTargetBranch[];
}

type PushState = 'idle' | 'pending' | 'success' | 'error';

export function GitPanelContainer({
  selectedWorkspace,
  repos,
}: GitPanelContainerProps) {
  const queryClient = useQueryClient();
  const { executeAction } = useActions();
  const { activeWorkspaces, archivedWorkspaces } = useWorkspaceContext();
  const repoActions = useUiPreferencesStore((s) => s.repoActions);
  const setRepoAction = useUiPreferencesStore((s) => s.setRepoAction);

  // Hooks for branch management (moved from WorkspacesLayout)
  const renameBranch = useRenameBranch(selectedWorkspace?.id);
  const { data: branchStatus } = useBranchStatus(selectedWorkspace?.id);
  const rebaseMutation = useRebase(selectedWorkspace?.id, undefined);

  // Get PR info from workspace summary (available immediately, no git calls needed)
  const summaryPr = useMemo(() => {
    if (!selectedWorkspace?.id) return undefined;
    const ws =
      activeWorkspaces.find((w) => w.id === selectedWorkspace.id) ??
      archivedWorkspaces.find((w) => w.id === selectedWorkspace.id);
    if (!ws?.prStatus || !ws.prNumber) return undefined;
    return {
      prNumber: ws.prNumber,
      prUrl: ws.prUrl,
      prStatus: ws.prStatus,
    };
  }, [selectedWorkspace?.id, activeWorkspaces, archivedWorkspaces]);

  const handleBranchNameChange = useCallback(
    (newName: string) => {
      renameBranch.mutate(newName);
    },
    [renameBranch]
  );

  // Transform repos to RepoInfo format (moved from WorkspacesLayout)
  // Uses workspace summary PR data as a fast fallback before branchStatus loads
  const repoInfos: RepoInfo[] = useMemo(
    () =>
      repos.map((repo) => {
        const repoStatus = branchStatus?.find((s) => s.repo_id === repo.id);

        let prNumber: number | undefined;
        let prUrl: string | undefined;
        let prStatus: 'open' | 'merged' | 'closed' | 'unknown' | undefined;

        if (repoStatus?.merges) {
          const openPR = repoStatus.merges.find(
            (m: Merge) => m.type === 'pr' && m.pr_info.status === 'open'
          );
          const mergedPR = repoStatus.merges.find(
            (m: Merge) => m.type === 'pr' && m.pr_info.status === 'merged'
          );

          const relevantPR = openPR || mergedPR;
          if (relevantPR && relevantPR.type === 'pr') {
            prNumber = Number(relevantPR.pr_info.number);
            prUrl = relevantPR.pr_info.url;
            prStatus = relevantPR.pr_info.status;
          }
        } else if (summaryPr) {
          // Use workspace summary PR data as a fast fallback while branchStatus loads.
          // The summary is fetched from the DB (no git calls) and is already cached.
          prNumber = summaryPr.prNumber;
          prUrl = summaryPr.prUrl;
          prStatus = summaryPr.prStatus;
        }

        return {
          id: repo.id,
          name: repo.display_name || repo.name,
          targetBranch: repo.target_branch || 'main',
          commitsAhead: repoStatus?.commits_ahead ?? 0,
          commitsBehind: repoStatus?.commits_behind ?? 0,
          remoteCommitsAhead: repoStatus?.remote_commits_ahead ?? 0,
          prNumber,
          prUrl,
          prStatus,
          isTargetRemote: repoStatus?.is_target_remote ?? false,
        };
      }),
    [repos, branchStatus, summaryPr]
  );

  // Track push state per repo: idle, pending, success, or error
  const [pushStates, setPushStates] = useState<Record<string, PushState>>({});
  const pushStatesRef = useRef<Record<string, PushState>>({});
  pushStatesRef.current = pushStates;
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentPushRepoRef = useRef<string | null>(null);

  // Reset push-related state when the selected workspace changes to avoid
  // leaking push state across workspaces with repos that share the same ID.
  useEffect(() => {
    setPushStates({});
    pushStatesRef.current = {};
    currentPushRepoRef.current = null;

    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
  }, [selectedWorkspace?.id]);
  // Use push hook for direct API access with proper error handling
  const pushMutation = usePush(
    selectedWorkspace?.id,
    // onSuccess
    () => {
      const repoId = currentPushRepoRef.current;
      if (!repoId) return;
      setPushStates((prev) => ({ ...prev, [repoId]: 'success' }));
      // Clear success state after 2 seconds
      successTimeoutRef.current = setTimeout(() => {
        setPushStates((prev) => ({ ...prev, [repoId]: 'idle' }));
      }, 2000);
    },
    // onError
    async (err, errorData) => {
      const repoId = currentPushRepoRef.current;
      if (!repoId) return;

      // Handle force push required - show confirmation dialog
      if (errorData?.type === 'force_push_required' && selectedWorkspace?.id) {
        setPushStates((prev) => ({ ...prev, [repoId]: 'idle' }));
        await ForcePushDialog.show({
          workspaceId: selectedWorkspace.id,
          repoId,
        });
        return;
      }

      // Show error state and dialog for other errors
      setPushStates((prev) => ({ ...prev, [repoId]: 'error' }));
      const message =
        err instanceof Error ? err.message : 'Failed to push changes';
      ConfirmDialog.show({
        title: 'Error',
        message,
        confirmText: 'OK',
        showCancelButton: false,
        variant: 'destructive',
      });
      // Clear error state after 3 seconds
      successTimeoutRef.current = setTimeout(() => {
        setPushStates((prev) => ({ ...prev, [repoId]: 'idle' }));
      }, 3000);
    }
  );

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const invalidateBranchStatus = useCallback(async () => {
    if (!selectedWorkspace?.id) return;
    await queryClient.invalidateQueries({
      queryKey: ['branchStatus', selectedWorkspace.id],
    });
  }, [queryClient, selectedWorkspace?.id]);

  const handleDirectRebase = useCallback(
    async (repoId: string) => {
      if (!selectedWorkspace?.id) return;

      const repoInfo = repoInfos.find((repo) => repo.id === repoId);
      if (!repoInfo) return;

      const targetBranch = repoInfo.targetBranch;

      try {
        await rebaseMutation.mutateAsync({
          repoId,
          newBaseBranch: targetBranch,
          oldBaseBranch: targetBranch,
        });
      } catch (err) {
        const resultErr = err as Result<void, GitOperationError> | undefined;
        const errorData =
          resultErr && !resultErr.success ? resultErr.error : undefined;

        if (errorData?.type === 'merge_conflicts') {
          await ResolveConflictsDialog.show({
            workspaceId: selectedWorkspace.id,
            conflictOp: errorData.op,
            sourceBranch: selectedWorkspace.branch,
            targetBranch: errorData.target_branch,
            conflictedFiles: errorData.conflicted_files,
            repoName: repoInfo.name,
          });
          return;
        }

        if (errorData?.type === 'rebase_in_progress') {
          await RebaseInProgressDialog.show({
            targetBranch,
            onContinue: async () => {
              await workspacesApi.continueRebase(selectedWorkspace.id, {
                repo_id: repoId,
              });
              await invalidateBranchStatus();
            },
            onAbort: async () => {
              await workspacesApi.abortConflicts(selectedWorkspace.id, {
                repo_id: repoId,
              });
              await invalidateBranchStatus();
            },
          });
          return;
        }

        const message =
          err instanceof Error ? err.message : 'Failed to rebase changes';
        await ConfirmDialog.show({
          title: 'Error',
          message,
          confirmText: 'OK',
          showCancelButton: false,
          variant: 'destructive',
        });
      }
    },
    [
      invalidateBranchStatus,
      rebaseMutation,
      repoInfos,
      selectedWorkspace?.branch,
      selectedWorkspace?.id,
    ]
  );

  // Compute repoInfos with push button state
  const repoInfosWithPushButton = useMemo(
    () =>
      repoInfos.map((repo) => {
        const state = pushStates[repo.id] ?? 'idle';
        const hasUnpushedCommits =
          repo.prStatus === 'open' && (repo.remoteCommitsAhead ?? 0) > 0;
        // Show push button if there are unpushed commits OR if we're in a push flow
        // (pending/success/error states keep the button visible for feedback)
        const isInPushFlow = state !== 'idle';
        return {
          ...repo,
          showPushButton: hasUnpushedCommits && !isInPushFlow,
          isPushPending: state === 'pending',
          isPushSuccess: state === 'success',
          isPushError: state === 'error',
        };
      }),
    [repoInfos, pushStates]
  );

  // Handle opening command bar for repo actions
  const handleMoreClick = useCallback(
    (repoId: string) => {
      CommandBarDialog.show({
        page: 'repoActions',
        workspaceId: selectedWorkspace?.id,
        repoId,
      });
    },
    [selectedWorkspace?.id]
  );

  // Handle GitPanel actions using the action system
  const handleActionsClick = useCallback(
    async (repoId: string, action: RepoAction) => {
      if (!selectedWorkspace?.id) return;

      if (action === 'rebase') {
        await handleDirectRebase(repoId);
        return;
      }

      // Map RepoAction to Action definitions
      const actionMap = {
        'pull-request': Actions.GitCreatePR,
        'link-pr': Actions.GitLinkPR,
        merge: Actions.GitMerge,
        'change-target': Actions.GitChangeTarget,
        push: Actions.GitPush,
      };

      const actionDef = actionMap[action];
      if (!actionDef) return;

      // Execute git action with workspaceId and repoId
      await executeAction(actionDef, selectedWorkspace.id, repoId);
    },
    [selectedWorkspace, handleDirectRebase, executeAction]
  );

  // Handle push button click - use mutation for proper state tracking
  const handlePushClick = useCallback(
    (repoId: string) => {
      // Use ref to check current state to avoid stale closure
      if (pushStatesRef.current[repoId] === 'pending') return;

      // Clear any existing timeout
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = null;
      }

      // Track which repo we're pushing
      currentPushRepoRef.current = repoId;
      setPushStates((prev) => ({ ...prev, [repoId]: 'pending' }));
      pushMutation.mutate({ repo_id: repoId });
    },
    [pushMutation]
  );

  return (
    <GitPanel
      repos={repoInfosWithPushButton}
      repoSelectedActions={repoActions}
      workingBranchName={selectedWorkspace?.branch ?? ''}
      onWorkingBranchNameChange={handleBranchNameChange}
      onActionsClick={handleActionsClick}
      onRepoActionChange={setRepoAction}
      onPushClick={handlePushClick}
      onMoreClick={handleMoreClick}
      onAddRepo={() => console.log('Add repo clicked')}
    />
  );
}
