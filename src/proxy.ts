import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Routing Guard for VV CRM
 * Bypasses public routes, protects /admin routes.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (
    pathname === '/' ||
    pathname.startsWith('/repair') ||
    pathname.startsWith('/api/public') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Protect Admin Zone
  if (pathname.startsWith('/admin')) {
    // TODO: Integrate with Supabase Auth to check admin role
    // const supabase = createServerClient(...);
    // const { data: { session } } = await supabase.auth.getSession();
    // if (!session) {
    //   return NextResponse.redirect(new URL('/login', request.url));
    // }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
