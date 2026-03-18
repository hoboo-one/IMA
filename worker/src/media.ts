import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function ffmpeg(args: string[]) {
  await execFileAsync("ffmpeg", args);
}

export async function stitchVideoSegments(segments: Array<{ buffer: Buffer; targetSeconds: number }>) {
  const workingDir = await mkdtemp(join(tmpdir(), "storyboard-video-"));

  try {
    const trimmedPaths: string[] = [];

    for (const [index, segment] of segments.entries()) {
      const inputPath = join(workingDir, `segment-${index}.mp4`);
      const trimmedPath = join(workingDir, `segment-${index}-trimmed.mp4`);
      await writeFile(inputPath, segment.buffer);
      await ffmpeg([
        "-y",
        "-i",
        inputPath,
        "-t",
        String(segment.targetSeconds),
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        trimmedPath
      ]);
      trimmedPaths.push(trimmedPath);
    }

    const concatFile = join(workingDir, "concat.txt");
    await writeFile(concatFile, trimmedPaths.map((path) => `file '${path.replace(/\\/g, "/")}'`).join("\n"));

    const outputPath = join(workingDir, "stitched.mp4");
    const previewPath = join(workingDir, "preview.jpg");

    await ffmpeg([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatFile,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      outputPath
    ]);

    await ffmpeg(["-y", "-ss", "1", "-i", outputPath, "-frames:v", "1", previewPath]);

    const [videoBuffer, previewBuffer] = await Promise.all([
      import("node:fs/promises").then((fs) => fs.readFile(outputPath)),
      import("node:fs/promises").then((fs) => fs.readFile(previewPath))
    ]);

    return { videoBuffer, previewBuffer };
  } finally {
    await rm(workingDir, { recursive: true, force: true });
  }
}

