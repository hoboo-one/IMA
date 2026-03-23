"use server";

import { redirect } from "next/navigation";

import { clearAppSessionCookie } from "@/lib/session-cookie";

export async function signOutAction() {
  await clearAppSessionCookie();
  redirect("/login");
}
