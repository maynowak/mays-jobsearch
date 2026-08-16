export interface AppInfo {
  version: string;
  env: string;
  commitSha: string;
  branch: string;
}

export const appInfo: AppInfo = {
  version: __APP_VERSION__,
  env: __APP_ENV__,
  commitSha: __APP_COMMIT_SHA__,
  branch: __APP_BRANCH__,
};
