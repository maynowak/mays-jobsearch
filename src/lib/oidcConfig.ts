const REGION = import.meta.env.VITE_AWS_REGION || 'eu-central-1';
const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID || 'eu-central-1_ojbmoiYGM';
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || '24qns4st861fc72bk7cucjc375';

export const oidcConfig = {
  authority: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
  client_id: CLIENT_ID,
  redirect_uri: 'https://www.mays-job-matcher.app/auth/callback',
  post_logout_redirect_uri: 'https://www.mays-job-matcher.app/',
  response_type: 'code',
  scope: 'openid email profile',
};
