export const isDevOnlyRoute = (pathname: string, isDev: boolean): boolean =>
  isDev &&
  (pathname === '/dev/dashboard' || pathname === '/dev/ui-components' || pathname === '/dev/dashboard-v2' || pathname === '/dev/dashboard-v2-auth');
