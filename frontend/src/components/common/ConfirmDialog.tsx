import React, { useCallback, useEffect, useRef, useState } from 'react';

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  // 'danger' for actions that remove or reset something
  tone?: 'default' | 'danger';
};

type PendingConfirm = ConfirmOptions & { resolve: (confirmed: boolean) => void };

type ConfirmDialogProps = ConfirmOptions & {
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Themed replacement for window.confirm, styled like the inventory modals.
 * Focus starts on Cancel so Enter never confirms a destructive action by accident.
 */
export function ConfirmDialog({ title, message, confirmLabel, tone = 'default', onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--overlay-backdrop)' }}
      role="presentation"
      onMouseDown={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-[0_30px_80px_rgba(15,23,42,0.28)]"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h3 id="confirm-dialog-title" className="text-lg font-semibold text-text">{title}</h3>
        <p id="confirm-dialog-message" className="mt-2 text-sm leading-relaxed text-muted">{message}</p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border bg-app px-4 py-2 text-sm font-medium text-text transition hover:border-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg px-4 py-2 text-sm font-medium transition hover:opacity-90"
            style={tone === 'danger'
              ? { backgroundColor: 'var(--danger-text)', color: '#ffffff' }
              : { backgroundColor: 'var(--primary)', color: 'var(--on-primary)' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Promise-based confirmation: `if (!(await confirm({...}))) return;`
 * Render the returned element somewhere in the page.
 */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, React.ReactNode] {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const close = useCallback((confirmed: boolean) => {
    setPending((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  const handleConfirm = useCallback(() => close(true), [close]);
  const handleCancel = useCallback(() => close(false), [close]);

  const dialog = pending ? (
    <ConfirmDialog
      title={pending.title}
      message={pending.message}
      confirmLabel={pending.confirmLabel}
      tone={pending.tone}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return [confirm, dialog];
}
