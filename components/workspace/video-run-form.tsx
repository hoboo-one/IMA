"use client";

import { type FormEvent, useMemo, useState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";
import { modelSupportsSeconds, soraSeconds, videoModelLabels, videoModels } from "@/shared";

type VideoRunFormProps = {
  action: (formData: FormData) => void;
  formId: string;
  frameCount: number;
  projectId: string;
  sourceId: string;
  sourceType: "STORYBOARD" | "BATCH";
};

export function VideoRunForm({
  action,
  formId,
  frameCount,
  projectId,
  sourceId,
  sourceType
}: VideoRunFormProps) {
  const [model, setModel] = useState<(typeof videoModels)[number]>("VEO_3_1");
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const supportsSeconds = modelSupportsSeconds(model);
  const selectionLabel = useMemo(() => {
    if (sourceType === "BATCH") {
      return "直接使用上方勾选的分镜图生成视频";
    }

    return "从当前分镜里勾选要用于视频的图像";
  }, [sourceType]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);

    if (formData.getAll("frameIds").length === 0) {
      event.preventDefault();
      setSelectionError("至少勾选 1 张分镜图后再生成视频。");
      return;
    }

    setSelectionError(null);
  }

  return (
    <form id={formId} action={action} className="stack-form" onSubmit={handleSubmit}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="sourceType" value={sourceType} />
      <input type="hidden" name="sourceId" value={sourceId} />

      <div className="smart-inline-note">
        <strong>{selectionLabel}</strong>
        <span>默认全选，当前最多可从上方 {frameCount} 张分镜图里自由勾选后直接生成视频。</span>
      </div>

      <label className="field">
        <span>视频模型</span>
        <select name="model" value={model} onChange={(event) => setModel(event.target.value as (typeof videoModels)[number])}>
          {videoModels.map((item) => (
            <option key={item} value={item}>
              {videoModelLabels[item]}
            </option>
          ))}
        </select>
      </label>

      {supportsSeconds ? (
        <label className="field">
          <span>Sora 原始生成时长</span>
          <select name="seconds" defaultValue={String(soraSeconds[0])}>
            {soraSeconds.map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds} 秒
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {selectionError ? <p className="field-error">{selectionError}</p> : null}

      <SubmitButton type="submit" pendingText="正在生成视频...">
        使用勾选分镜生成视频
      </SubmitButton>
    </form>
  );
}
