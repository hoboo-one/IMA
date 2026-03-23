"use client";

import { useMemo, useState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";
import { modelSupportsSeconds, soraSeconds, videoModelLabels, videoModels } from "@/shared";

type VideoRunFormProps = {
  action: (formData: FormData) => void;
  projectId: string;
  storyboardVersionId: string;
};

export function VideoRunForm({ action, projectId, storyboardVersionId }: VideoRunFormProps) {
  const [model, setModel] = useState<(typeof videoModels)[number]>("VEO_3_1");
  const supportsSeconds = useMemo(() => modelSupportsSeconds(model), [model]);

  return (
    <form action={action} className="stack-form">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="storyboardVersionId" value={storyboardVersionId} />
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
          <span>Sora 原始生成秒数</span>
          <select name="seconds" defaultValue={String(soraSeconds[0])}>
            {soraSeconds.map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds} 秒
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <SubmitButton type="submit" pendingText="视频生成中...">
        开始生成视频
      </SubmitButton>
    </form>
  );
}
