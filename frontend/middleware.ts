export { default } from 'next-auth/middleware';

export const config = {
  matcher: ['/dashboard/:path*', '/credentials/:path*', '/invoices/:path*', '/analytics/:path*', '/users/:path*', '/settings/:path*'],
};
