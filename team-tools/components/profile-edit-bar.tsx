"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The edit-mode action group for the player profile: Save (persist, stay), Done
 * (save & exit), Cancel (exit — confirms if there are unsaved changes). Lives
 * outside the form and drives it by `form={formId}`; Done adds a hidden `_exit`
 * value so the server action redirects out of edit mode.
 */
export function ProfileEditBar({ formId, exitHref }: { formId: string; exitHref: string }) {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!form) return;
    const mark = () => setDirty(true);
    form.addEventListener("input", mark);
    form.addEventListener("change", mark);
    return () => {
      form.removeEventListener("input", mark);
      form.removeEventListener("change", mark);
    };
  }, [formId]);

  function cancel() {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    router.push(exitHref);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="submit"
        form={formId}
        onClick={() => setDirty(false)}
        className={cn(buttonVariants({ size: "sm" }))}
      >
        Save
      </button>
      <button
        type="submit"
        form={formId}
        name="_exit"
        value="1"
        onClick={() => setDirty(false)}
        className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
      >
        Done
      </button>
      <button
        type="button"
        onClick={cancel}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
      >
        Cancel
      </button>
    </div>
  );
}
