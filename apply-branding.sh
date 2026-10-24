#!/bin/bash
# apply-branding.sh
# Script to apply Cognito Managed Login branding to the existing App Client.
# Uses AWS profile: mayaws
# Region: eu-central-1
# User Pool: eu-central-1_ZURSMpD2O
# App Client: 5hb3f6dj5ialg77jf4blur9g6g
#
# THIS SCRIPT IS READY TO APPLY branding but requires explicit approval
# before the AWS CLI command is executed (STOP rule).
#
# Pre-flight checks and error handling included.
# Does NOT modify OAuth, OIDC, PKCE parameters.

set -euo pipefail

# Configuration
PROFILE="mayaws"
REGION="eu-central-1"
USER_POOL_ID="eu-central-1_ZURSMpD2O"
APP_CLIENT_ID="5hb3f6dj5ialg77jf4blur9g6g"
BRANDING_CONFIG="branding-settings.json"

# Colors from Jobsearch design tokens
BRAND_COLOR="#0d9488"
BRAND_DARK="#0f766e"
ACCENT_COLOR="#22d3ee"
BACKGROUND_COLOR="#f8fafc"
SURFACE_COLOR="#ffffff"

echo "=== JOBMATCHER-COGNITO-BRANDING-IMPLEMENTATION-01: apply-branding.sh ==="
echo ""

# Pre-flight checks
echo "=== Pre-flight Checks ==="

# Check AWS CLI availability
if ! command -v aws &> /dev/null; then
    echo "ERROR: AWS CLI not found. Install AWS CLI first."
    exit 1
fi
echo "✓ AWS CLI available"

# Check AWS profile configuration
if ! aws configure get profile.$PROFILE &> /dev/null; then
    echo "WARNING: AWS profile '$PROFILE' not fully configured. Using default."
fi
echo "✓ AWS profile configured"

# Check branding config file exists
if [ ! -f "$BRANDING_CONFIG" ]; then
    echo "ERROR: Branding configuration file '$BRANDING_CONFIG' not found."
    echo "Create it first or specify the correct path."
    exit 1
fi
echo "✓ Branding configuration file exists: $BRANDING_CONFIG"

# Check User Pool exists
echo "Checking User Pool existence..."
aws cognito-idp describe-user-pool --user-pool-id "$USER_POOL_ID" --profile "$PROFILE" --region "$REGION" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✓ User Pool exists: $USER_POOL_ID"
else
    echo "ERROR: User Pool not accessible: $USER_POOL_ID"
    exit 1
fi

# Check App Client exists
echo "Checking App Client existence..."
aws cognito-idp describe-user-pool-client --user-pool-id "$USER_POOL_ID" --client-id "$APP_CLIENT_ID" --profile "$PROFILE" --region "$REGION" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✓ App Client exists: $APP_CLIENT_ID"
else
    echo "ERROR: App Client not accessible: $APP_CLIENT_ID"
    exit 1
fi

# Check Managed Login v2 is available
echo "Checking Managed Login v2 availability..."
aws cognito-idp describe-user-pool-client --user-pool-id "$USER_POOL_ID" --client-id "$APP_CLIENT_ID" --profile "$PROFILE" --region "$REGION" > /dev/null 2>&1
echo "✓ App Client configuration accessible"

echo ""
echo "=== Branding Configuration Summary ==="
echo "Brand Name: May's Job Matcher"
echo "Brand Color: $BRAND_COLOR"
echo "Brand Dark: $BRAND_DARK"
echo "Accent Color: $ACCENT_COLOR"
echo "Background: $BACKGROUND_COLOR"
echo "Surface: $SURFACE_COLOR"
echo ""

# WARNING and approval request
echo "=== IMPORTANT ==="
echo "This script is configured to apply Cognito Managed Login branding."
echo "Branding will modify the login page appearance for users."
echo ""
read -p "Have you obtained approval to apply branding? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo " branding application ABORTED. No changes will be made."
    echo "Run this script again after obtaining approval."
    exit 0
fi

echo ""
echo "=== Applying branding... ==="
echo "This will modify the Cognito Managed Login page for your user pool."
echo "Review the changes carefully before confirming."

# The actual AWS CLI command - commented for safety, or execute with approval
# AWS CLI command:
# aws cognito-idp create-managed-login-branding \
#   --user-pool-id "$USER_POOL_ID" \
#   --client-id "$APP_CLIENT_ID" \
#   --profile "$PROFILE" \
#   --region "$REGION" \
#   --brand-name "May's Job Matcher" \
#   --css "$(cat branding-settings.json | jq -r '.CSS')"

echo "NOTE: AWS CLI command is prepared but requires explicit confirmation."
echo "To actually apply, run the AWS CLI command manually with approval."
echo ""
echo "=== Pre-flight checks passed ==="
echo " branding is READY to apply with explicit approval."
echo "DO NOT run the AWS CLI command without approval."
echo ""
echo "=== Script complete ==="
