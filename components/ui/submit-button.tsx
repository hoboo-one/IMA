"use client";

import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";

type SubmitButtonProps = ButtonProps & {
  pendingText?: string;
};

export function SubmitButton({
  children,
  disabled,
  pendingText = "处理中...",
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-busy={pending}
      disabled={disabled || pending}
      {...props}
    >
      {pending ? pendingText : children}
    </Button>
  );
}
