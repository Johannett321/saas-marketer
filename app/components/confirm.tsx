import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type Pending = { options: ConfirmOptions; resolve: (ok: boolean) => void };

/**
 * Promise-based confirm that renders an in-app dialog instead of the browser's.
 *
 *   const { confirm, dialog } = useConfirm();
 *   if (await confirm({ title: "Delete this card?" })) submit(form);
 *   return <>… {dialog}</>;
 */
export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (pending) ref.current?.showModal();
  }, [pending]);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ options, resolve })),
    [],
  );

  // `settle` is safe to call twice — the dialog's own onClose also routes here.
  const settle = useCallback(
    (ok: boolean) => {
      setPending((current) => {
        if (!current) return null;
        current.resolve(ok);
        return null;
      });
      ref.current?.close();
    },
    [],
  );

  const options = pending?.options;

  const dialog = (
    <dialog ref={ref} className="modal" onClose={() => settle(false)}>
      {options && (
        <div className="modal-box max-w-sm border border-ink-200 bg-base-100">
          <div className="flex gap-3">
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                options.danger ? "bg-error/10 text-error" : "bg-brand-50 text-brand-600"
              }`}
            >
              <AlertTriangle className="size-4.5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-ink-900">{options.title}</h3>
              {options.description && (
                <div className="mt-1.5 text-[13.5px] leading-relaxed text-ink-600">
                  {options.description}
                </div>
              )}
            </div>
          </div>

          <div className="modal-action mt-5">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => settle(false)}>
              {options.cancelLabel ?? "Cancel"}
            </button>
            <button
              type="button"
              autoFocus
              className={`btn btn-sm ${
                options.danger
                  ? "border-error bg-error text-error-content hover:brightness-110"
                  : "btn-primary"
              }`}
              onClick={() => settle(true)}
            >
              {options.confirmLabel ?? "Confirm"}
            </button>
          </div>
        </div>
      )}
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );

  return { confirm, dialog };
}
