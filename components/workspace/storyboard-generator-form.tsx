"use client";

import { useState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";
import { imageModelLabels, imageModels } from "@/shared";

type StoryboardGeneratorFormProps = {
  action: (formData: FormData) => void;
  defaultPrompt?: string;
  notes?: string | null;
  productName: string;
  projectId: string;
};

function buildSuggestedPrompt(input: {
  defaultPrompt?: string;
  notes?: string | null;
  productName: string;
}) {
  if (input.defaultPrompt?.trim()) {
    return input.defaultPrompt.trim();
  }

  const noteLine = input.notes?.trim()
    ? `补充信息：${input.notes.trim()}。`
    : "补充信息：保持产品主体、颜色、材质和轮廓与参考图一致。";

  return [
    `请基于参考产品图，为“${input.productName}”生成一组适合后续视频生成的产品分镜图。`,
    noteLine,
    "镜头要求：包含主体展示、细节特写、结构材质表现和一张更有氛围感的产品展示图。",
    "风格要求：高级感、电商产品视觉、背景简洁、光线干净、构图差异清晰。"
  ].join("\n");
}

export function StoryboardGeneratorForm({
  action,
  defaultPrompt,
  notes,
  productName,
  projectId
}: StoryboardGeneratorFormProps) {
  const [prompt, setPrompt] = useState(() => buildSuggestedPrompt({ defaultPrompt, notes, productName }));

  return (
    <form action={action} className="stack-form">
      <input type="hidden" name="projectId" value={projectId} />

      <div className="inline-meta">
        <span className="field-hint">系统可以先帮你起一版提示词，你再按需要微调。</span>
        <button
          type="button"
          className="button button-ghost"
          onClick={() => setPrompt(buildSuggestedPrompt({ defaultPrompt, notes, productName }))}
        >
          一键生成推荐提示词
        </button>
      </div>

      <label className="field">
        <span>分镜提示词</span>
        <textarea
          name="prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="描述你希望这组分镜图呈现的镜头感、材质和氛围。"
          required
        />
      </label>

      <div className="two-up-grid">
        <label className="field">
          <span>分镜张数</span>
          <select name="targetCount" defaultValue="4">
            {[2, 4, 6, 8, 10, 12].map((count) => (
              <option key={count} value={count}>
                {count} 张
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>图片模型</span>
          <select name="model" defaultValue="NANO_BANANA_2">
            {imageModels.map((model) => (
              <option key={model} value={model}>
                {imageModelLabels[model]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <SubmitButton type="submit" pendingText="生成分镜中...">
        生成分镜图
      </SubmitButton>
    </form>
  );
}
