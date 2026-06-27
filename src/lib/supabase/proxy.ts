import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function redirectWithCookies(url: URL, sourceResponse: NextResponse) {
  const response = NextResponse.redirect(url);
  sourceResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));

  for (const header of ["Cache-Control", "Expires", "Pragma"]) {
    const value = sourceResponse.headers.get(header);
    if (value) response.headers.set(header, value);
  }

  return response;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Public Supabase environment variables are not configured.");
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([name, value]) => {
          supabaseResponse.headers.set(name, value);
        });
      },
    },
  });

  // Keep this call immediately after client creation so token refresh stays reliable.
  const { data } = await supabase.auth.getClaims();
  supabaseResponse.headers.set("Cache-Control", "private, no-store");
  const isAuthenticated = Boolean(data?.claims);
  const pathname = request.nextUrl.pathname;
  const isProtectedRoute =
    pathname.startsWith("/admin/dashboard") || pathname.startsWith("/admin/settings");

  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";
    return redirectWithCookies(loginUrl, supabaseResponse);
  }

  if (pathname === "/admin/login" && isAuthenticated) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/admin/dashboard";
    dashboardUrl.search = "";
    return redirectWithCookies(dashboardUrl, supabaseResponse);
  }

  return supabaseResponse;
}
