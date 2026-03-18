import type { Metadata } from "next";

import "@/app/globals.css";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: `${publicEnv.NEXT_PUBLIC_APP_NAME} | 内部工作台`,
  description: "基于产品参考图生成分镜与视频的内部工作台"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
