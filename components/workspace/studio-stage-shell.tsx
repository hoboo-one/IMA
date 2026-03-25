"use client";

import { type ReactNode, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export type StudioStageId = "reference" | "candidates" | "storyboard" | "video";

type StudioStage = {
  id: StudioStageId;
  label: string;
  hint: string;
  count?: string;
  preview: ReactNode;
  body: ReactNode;
  inspector: ReactNode;
};

type StudioStageShellProps = {
  title: string;
  subtitle: string;
  status: ReactNode;
  rail: ReactNode;
  footer?: ReactNode;
  initialStage: StudioStageId;
  stages: StudioStage[];
  storageKey: string;
};

export function StudioStageShell({
  title,
  subtitle,
  status,
  rail,
  footer,
  initialStage,
  stages,
  storageKey
}: StudioStageShellProps) {
  const [activeStageId, setActiveStageId] = useState<StudioStageId>(() => {
    if (typeof window === "undefined") {
      return initialStage;
    }

    const savedStage = window.sessionStorage.getItem(storageKey);

    if (savedStage && stages.some((stage) => stage.id === savedStage)) {
      return savedStage as StudioStageId;
    }

    return initialStage;
  });

  useEffect(() => {
    window.sessionStorage.setItem(storageKey, activeStageId);
  }, [activeStageId, storageKey]);

  const activeStage = stages.find((stage) => stage.id === activeStageId) ?? stages[0];

  return (
    <div className="generator-shell">
      <aside className="generator-rail">{rail}</aside>

      <main className="generator-main">
        <section className="generator-hero">
          <div className="generator-hero-header">
            <div className="generator-hero-copy">
              <p className="section-kicker">Creative Studio</p>
              <h2 className="generator-title">{title}</h2>
              <p className="generator-subtitle">{subtitle}</p>
            </div>
            <div className="generator-status">{status}</div>
          </div>

          <div className="stage-tab-row" role="tablist" aria-label="Workspace stages">
            {stages.map((stage) => {
              const isActive = activeStage.id === stage.id;

              return (
                <button
                  key={stage.id}
                  aria-selected={isActive}
                  className={cn("stage-tab", isActive && "stage-tab-active")}
                  role="tab"
                  type="button"
                  onClick={() => setActiveStageId(stage.id)}
                >
                  <span className="stage-tab-label">{stage.label}</span>
                  <span className="stage-tab-hint">{stage.hint}</span>
                  {stage.count ? <span className="stage-tab-count">{stage.count}</span> : null}
                </button>
              );
            })}
          </div>

          <div className="generator-preview-panel">{activeStage.preview}</div>
        </section>

        <section className="generator-body">{activeStage.body}</section>
      </main>

      <aside className="generator-inspector">
        {activeStage.inspector}
        {footer}
      </aside>
    </div>
  );
}
