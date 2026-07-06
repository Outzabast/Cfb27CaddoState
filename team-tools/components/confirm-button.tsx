"use client";

import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

/**
 * A submit button that asks for confirmation before letting the form submit.
 * Cancelling the browser prompt prevents the (server action) submission.
 */
export function ConfirmButton({
  message,
  children,
  ...props
}: ComponentProps<typeof Button> & { message: string }) {
  return (
    <Button
      {...props}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
