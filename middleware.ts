import NextAuth from "next-auth";
import { authConfig } from "./src/platform/auth/config";

export default NextAuth(authConfig).auth((req) => {
  if (!req.auth) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: ["/apps/:path*", "/admin/:path*"],
};
