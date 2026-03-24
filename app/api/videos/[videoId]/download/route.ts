import { NextResponse, type NextRequest } from "next/server";

import { getActiveProfileOrNull } from "@/lib/auth";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { signStoragePath } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ videoId: string }> }
) {
  const session = await getActiveProfileOrNull();
  if (!session) {
    return NextResponse.redirect(new URL("/login", _request.nextUrl.origin));
  }

  const { videoId } = await context.params;
  const video = await db.videoVersion.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      stitchedVideoPath: true
    }
  });

  if (!video?.stitchedVideoPath) {
    return NextResponse.json(
      {
        message: "Video file is not ready yet."
      },
      { status: 404 }
    );
  }

  const signedUrl = await signStoragePath(getServerEnv().STORAGE_BUCKET_VIDEO, video.stitchedVideoPath);
  if (!signedUrl) {
    return NextResponse.json(
      {
        message: "Could not sign the video download link."
      },
      { status: 500 }
    );
  }

  return NextResponse.redirect(signedUrl, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
