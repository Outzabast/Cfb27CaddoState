"use client";

import { toast } from "sonner";

type SaveFormProps = Omit<React.ComponentProps<"form">, "action"> & {
  action: (formData: FormData) => Promise<unknown>;
  loadingText?: string;
  successText?: string;
  /** Called after the action resolves successfully (before any redirect). */
  onSuccess?: () => void;
};

/**
 * Framework control-flow errors (redirect / notFound) are thrown by server
 * actions on success and MUST propagate so Next can handle them.
 */
function isControlFlowError(e: unknown): boolean {
  if (!e || typeof e !== "object" || !("digest" in e)) return false;
  const digest = (e as { digest?: unknown }).digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") ||
      digest === "NEXT_NOT_FOUND" ||
      digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"))
  );
}

/**
 * A drop-in replacement for `<form action={serverAction}>` that shows a
 * "Saving…" → "Saved" toast (or an error toast) around the submission.
 */
export function SaveForm({
  action,
  loadingText = "Saving…",
  successText = "Saved",
  onSuccess,
  children,
  // React manages encoding/method for function actions and warns if they're
  // set explicitly — drop them so callers with file inputs don't trip it.
  encType: _encType,
  method: _method,
  ...rest
}: SaveFormProps) {
  void _encType;
  void _method;
  return (
    <form
      {...rest}
      action={async (formData) => {
        const id = toast.loading(loadingText);
        try {
          await action(formData);
          toast.success(successText, { id });
          onSuccess?.();
        } catch (e) {
          if (isControlFlowError(e)) {
            toast.success(successText, { id });
            onSuccess?.();
            throw e; // let Next perform the redirect / notFound
          }
          toast.error(e instanceof Error ? e.message : "Something went wrong", {
            id,
          });
        }
      }}
    >
      {children}
    </form>
  );
}
