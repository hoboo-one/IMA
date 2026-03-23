import { type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return <button className={cn("button", `button-${variant}`, className)} {...props} />;
}
