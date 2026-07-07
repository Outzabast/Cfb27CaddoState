"use client";

import { toast } from "sonner";

type SaveFormProps = Omit<React.ComponentProps<"form">, "action"> & {
  action: (formData: FormData) => Promise<unknown>;
  loadingText?: string;
  successText?: string;
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
  children,
  ...rest
}: SaveFormProps) {
  return (
    <form
      {...rest}
      action={async (formData) => {
        const id = toast.loading(loadingText);
        try {
          await action(formData);
          toast.success(successText, { id });
        } catch (e) {
          if (isControlFlowError(e)) {
            toast.success(successText, { id });
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
