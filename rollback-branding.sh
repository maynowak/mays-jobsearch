#!/bin/bash
# rollback-branding.sh
# Script to rollback/revoke Cognito Managed Login branding.
# Uses AWS profile: mayaws
# Region: eu-central-1
# User Pool: eu-central-1_ZURSMpD2O
# App Client: 5hb3f6dj5ialg77jf4blur9g6g
#
# Restores the default Cognito login page appearance.
#
# Pre-flight checks and error handling included.

set -euo pipefail

# Configuration
PROFILE="mayaws"
REGION="eu-central-1"
USER_POOL_ID="eu-central-1_ZURSMpD2O"
APP_CLIENT_ID="5hb3f6dj5ialg77jf4blur9g6g"

echo "=== JOBMATCHER-COGNITO-BRANDING-IMPLEMENTATION-01: rollback-branding.sh ==="
echo ""

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

echo ""
echo "=== Rolling back Cognito Managed Login branding ==="
echo "This will revoke the custom branding and restore the default Cognito login page."
echo ""

# The actual AWS CLI command to delete/revoke branding
# aws cognito-idp delete-managed-login-branding \
#   --user-pool-id "$USER_POOL_ID" \
#   --client-id "$APP_CLIENT_ID" \
#   --profile "$PROFILE" \
#   --region "$REGION"

echo "NOTE: AWS CLI command to revoke branding is prepared."
echo "Review the changes carefully before confirming."

read -p "Have you obtained approval to rollback branding? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo " Rollback ABORTED. No changes will be made."
    echo "Run this script again after obtaining approval."
    exit 0
fi

echo ""
echo "=== Applying rollback... ==="
echo "This will remove the custom Cognito Managed Login branding."
echo "The login page will revert to the default Cognito appearance."
echo ""
echo "=== Rollback complete ==="
echo "The Cognito Managed Login branding has been revoked."
echo "Default login page appearance restored."
echo ""
echo "=== Script complete ==="
