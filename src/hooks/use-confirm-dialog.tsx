'use client';

import { useState, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmState {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
}

/**
 * Reusable confirmation dialog hook.
 * Returns a `confirm()` function (async, returns boolean) and a JSX element to render.
 * Replaces native window.confirm() with a styled AlertDialog.
 *
 * Usage:
 *   const { confirm, ConfirmDialog } = useConfirmDialog();
 *   // In JSX: <ConfirmDialog />
 *   // In handler:
 *   const ok = await confirm('Delete?', 'This cannot be undone.');
 *   if (!ok) return;
 */
export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  const confirm = useCallback((title: string, description: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        open: true,
        title,
        description,
        onConfirm: () => {
          setState((prev) => ({ ...prev, open: false }));
          resolve(true);
        },
      });
    });
  }, []);

  const handleCancel = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const ConfirmDialog = state.open ? (
    <AlertDialog open={state.open} onOpenChange={(open) => {
      if (!open) setState((prev) => ({ ...prev, open: false }));
    }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.title}</AlertDialogTitle>
          <AlertDialogDescription>{state.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={state.onConfirm}
            className="bg-red-500 text-white hover:bg-red-600"
          >
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;

  return { confirm, ConfirmDialog };
}
