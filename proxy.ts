import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request
  });
  response.headers.set("x-pathname", request.nextUrl.pathname);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
