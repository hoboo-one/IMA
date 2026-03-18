import { type ImageModel, type VideoModel } from "@prisma/client";

import { workerEnv } from "./env.js";

const jsonHeaders = {
  Authorization: `Bearer ${workerEnv.LAOZHANG_API_KEY}`,
  "Content-Type": "application/json"
};

type ReferenceImage = {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
};

function mapImageModel(model: ImageModel) {
  return model === "NANO_BANANA_PRO" ? "gemini-3-pro-image-preview" : "gemini-3.1-flash-image-preview";
}

function mapVideoModel(model: VideoModel) {
  switch (model) {
    case "VEO_3_1":
      return "veo-3.1";
    case "VEO_3_1_FAST":
      return "veo-3.1-fast";
    case "VEO_3_1_LANDSCAPE":
      return "veo-3.1-landscape";
    case "VEO_3_1_LANDSCAPE_FAST":
      return "veo-3.1-landscape-fast";
    case "SORA_2":
      return "sora-2";
    case "SORA_2_PRO":
      return "sora-2-pro";
  }

  throw new Error(`Unsupported video model: ${model satisfies never}`);
}

function extractDataUriImages(value: unknown) {
  const images: string[] = [];

  if (typeof value === "string") {
    const matches = value.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g) ?? [];
    images.push(...matches);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") {
        images.push(...extractDataUriImages(item));
        continue;
      }

      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        if (typeof record.image_url === "string") {
          images.push(...extractDataUriImages(record.image_url));
        }
        if (record.image_url && typeof record.image_url === "object") {
          const imageUrl = record.image_url as Record<string, unknown>;
          if (typeof imageUrl.url === "string") {
            images.push(...extractDataUriImages(imageUrl.url));
          }
        }
        if (typeof record.text === "string") {
          images.push(...extractDataUriImages(record.text));
        }
      }
    }
  }

  return images;
}

export async function generateCandidateImages(input: {
  model: ImageModel;
  prompt: string;
  targetCount: number;
  referenceImages: ReferenceImage[];
}) {
  const results: Array<{ mimeType: string; buffer: Buffer }> = [];

  for (let index = 0; index < input.targetCount; index += 1) {
    const body = {
      model: mapImageModel(input.model),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${input.prompt}\n\n请输出第 ${index + 1} 张镜头候选图，与其他候选保持明显构图差异。`
            },
            ...input.referenceImages.map((image) => ({
              type: "image_url",
              image_url: {
                url: `data:${image.mimeType};base64,${image.buffer.toString("base64")}`
              }
            }))
          ]
        }
      ]
    };

    const response = await fetch(`${workerEnv.LAOZHANG_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const failureText = await response.text();
      throw new Error(`LaoZhang image request failed: ${failureText}`);
    }

    const payload = await response.json();
    const messageContent = payload.choices?.[0]?.message?.content;
    const dataUris = extractDataUriImages(messageContent);

    if (dataUris.length === 0) {
      throw new Error("Image response did not contain any base64 images");
    }

    const [header, encoded] = dataUris[0].split(",", 2);
    const mimeType = header.match(/^data:(.*);base64$/)?.[1] ?? "image/png";
    results.push({
      mimeType,
      buffer: Buffer.from(encoded, "base64")
    });
  }

  return results;
}

async function createVideoTask(input: {
  model: VideoModel;
  prompt: string;
  referenceImages: ReferenceImage[];
  soraRawSeconds?: number | null;
}) {
  const formData = new FormData();
  formData.set("model", mapVideoModel(input.model));
  formData.set("prompt", input.prompt);

  if ((input.model === "SORA_2" || input.model === "SORA_2_PRO") && input.soraRawSeconds) {
    formData.set("seconds", String(input.soraRawSeconds));
  }

  input.referenceImages.forEach((image) => {
    formData.append(
      "input_reference",
      new Blob([new Uint8Array(image.buffer)], { type: image.mimeType }),
      image.fileName
    );
  });

  const response = await fetch(`${workerEnv.LAOZHANG_BASE_URL}/v1/videos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${workerEnv.LAOZHANG_API_KEY}`
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = await response.json();
  return payload.id ?? payload.video_id ?? payload.data?.id;
}

async function pollVideoTask(videoId: string) {
  while (true) {
    const response = await fetch(`${workerEnv.LAOZHANG_BASE_URL}/v1/videos/${videoId}`, {
      headers: {
        Authorization: `Bearer ${workerEnv.LAOZHANG_API_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const payload = await response.json();
    const status = payload.status ?? payload.data?.status;

    if (status === "completed") {
      return;
    }

    if (status === "failed") {
      throw new Error(payload.error?.message ?? payload.message ?? "Video task failed");
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

export async function generateVideoClip(input: {
  model: VideoModel;
  prompt: string;
  referenceImages: ReferenceImage[];
  soraRawSeconds?: number | null;
}) {
  const videoId = await createVideoTask(input);
  if (!videoId) {
    throw new Error("Video task id missing from LaoZhang response");
  }

  await pollVideoTask(videoId);

  const contentResponse = await fetch(`${workerEnv.LAOZHANG_BASE_URL}/v1/videos/${videoId}/content`, {
    headers: {
      Authorization: `Bearer ${workerEnv.LAOZHANG_API_KEY}`
    }
  });

  if (!contentResponse.ok) {
    throw new Error(await contentResponse.text());
  }

  const arrayBuffer = await contentResponse.arrayBuffer();
  return {
    vendorTaskId: videoId,
    buffer: Buffer.from(arrayBuffer),
    mimeType: contentResponse.headers.get("content-type") ?? "video/mp4"
  };
}
