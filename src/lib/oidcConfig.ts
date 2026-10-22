const REGION = import.meta.env.VITE_AWS_REGION || 'eu-central-1';
const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID || 'eu-central-1_ojbmoiYGM';
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || '7ldhihlpdgsgcl3puvu4oi7ksv';
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI || 'http://localhost:5173/auth/callback';
const POST_LOGOUT_REDIRECT_URI = import.meta.env.VITE_POST_LOGOUT_REDIRECT_URI || 'http://localhost:5173/';

// JOBMATCHER-RIS-COGNITO-INTEGRATION-04: Region + Client-ID für die
// Cognito-Self-Service-API (cognitoAuthApi.ts) — gleiche Quelle, kein Drift.
export { REGION, CLIENT_ID };

export const oidcConfig = {
  authority: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  post_logout_redirect_uri: POST_LOGOUT_REDIRECT_URI,
  response_type: 'code',
  scope: 'openid email profile',
};
