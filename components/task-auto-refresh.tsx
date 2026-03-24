"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

function isEditingElement(node: Element | null) {
  if (!node) {
    return false;
  }

  if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement) {
    return true;
  }

  return node.getAttribute("contenteditable") === "true";
}

export function TaskAutoRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timer = window.setInterval(() => {
      if (document.hidden || isEditingElement(document.activeElement)) {
        return;
      }

      router.refresh();
    }, 8000);

    return () => window.clearInterval(timer);
  }, [enabled, router]);

  return null;
}
