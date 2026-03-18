export const userRoles = ["ADMIN", "MEMBER"] as const;
export const imageModels = ["NANO_BANANA_2", "NANO_BANANA_PRO"] as const;
export const videoModels = [
  "VEO_3_1",
  "VEO_3_1_FAST",
  "VEO_3_1_LANDSCAPE",
  "VEO_3_1_LANDSCAPE_FAST",
  "SORA_2",
  "SORA_2_PRO"
] as const;

export const soraCapableModels = ["SORA_2", "SORA_2_PRO"] as const;
export const soraSeconds = [10, 15] as const;
export const defaultAssetRetentionHours = 24;

export const imageModelLabels: Record<(typeof imageModels)[number], string> = {
  NANO_BANANA_2: "Nano Banana2",
  NANO_BANANA_PRO: "Nano Banana Pro"
};

export const videoModelLabels: Record<(typeof videoModels)[number], string> = {
  VEO_3_1: "Veo 3.1",
  VEO_3_1_FAST: "Veo 3.1 Fast",
  VEO_3_1_LANDSCAPE: "Veo 3.1 横屏",
  VEO_3_1_LANDSCAPE_FAST: "Veo 3.1 横屏 Fast",
  SORA_2: "Sora 2",
  SORA_2_PRO: "Sora 2 Pro"
};

export const jobKinds = ["GENERATE_SHOT_BATCH", "REGENERATE_SHOT", "GENERATE_VIDEO_VERSION"] as const;

export function modelSupportsSeconds(model: (typeof videoModels)[number]) {
  return soraCapableModels.includes(model as (typeof soraCapableModels)[number]);
}

