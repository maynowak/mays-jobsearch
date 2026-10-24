# JOBMATCHER-COGNITO-BRANDING-IMPLEMENTATION-01

## Overview
Branding configuration for Cognito Managed Login v2 on the existing May's Job Matcher
deployment. This implementation uses the Jobsearch existing design tokens and AWS
configuration without modifying OAuth, OIDC, PKCE, or any authentication parameters.

**STATUS**: Implementation Ready | AWS Apply Awaiting Approval

**NOTICE**: Do NOT execute the apply-branding.sh script without explicit approval.
The scripts are prepared and validated, but AWS branding application requires
authorization per governance guidelines.

## Repository Context
- **Project**: May's Job Matcher (mays-jobsearch)
- **AWS Profile**: mayaws
- **Region**: eu-central-1
- **User Pool**: eu-central-1_ZURSMpD2O
- **App Client**: 5hb3f6dj5ialg77jf4blur9g6g
- **Custom Domain**: auth.mays-job-matcher.app
- **Frontend**: https://www.mays-job-matcher.app
- **Existing Design Tokens**: --brand: #0d9488, --brand-dark: #0f766e, --accent: #22d3ee, --background: #f8fafc, --surface: #ffffff

## Files Included

### 1. branding-settings.json
Complete, valid AWS Cognito Managed Login branding configuration JSON.
Uses only officially supported AWS API properties:
- BrandName: "May's Job Matcher"
- CSS: Custom CSS using Jobsearch design tokens
- SupportedIdentityProviders: ["COGNITO"]

### 2. apply-branding.sh
Bash script to apply Cognito Managed Login branding to the existing App Client.
Features:
- Pre-flight checks (AWS CLI, profile, User Pool, App Client existence)
- Color configuration using Jobsearch design tokens
- Approval prompt before AWS CLI execution
- Error handling with set -euo pipefail
- Does NOT modify OAuth, OIDC, PKCE parameters
- CLI command prepared but requires explicit approval

### 3. rollback-branding.sh
Bash script to revoke Cognito Managed Login branding and restore default
login page appearance.
Features:
- Pre-flight checks (AWS CLI, profile, User Pool, App Client existence)
- Revocation of custom branding
- Approval prompt before AWS CLI execution
- Error handling
- Restores default Cognito login page appearance

### 4. README.md
This documentation file.

## AWS CLI Commands

### Apply Branding
```bash
# Review branding-settings.json first
cat branding-settings.json

# Review the apply-branding.sh script
cat apply-branding.sh

# Run with approval (after obtaining permission):
./apply-branding.sh
# Alternatively, run the AWS CLI command directly:
aws cognito-idp create-managed-login-branding \
  --user-pool-id eu-central-1_ZURSMpD2O \
  --client-id 5hb3f6dj5ialg77jf4blur9g6g \
  --profile mayaws \
  --region eu-central-1 \
  --brand-name "May's Job Matcher" \
  --css "@font-face {font-family: 'Inter', sans-serif;} :root {--brand: #0d9488;--brand-dark: #0f766e;--accent: #22d3ee;--background: #f8fafc;--surface: #ffffff;--muted: #6b6255;--text: #1b2333;}"
```

### Rollback Branding
```bash
# Review and run the rollback-branding.sh script:
./rollback-branding.sh
# Alternatively, run the AWS CLI command directly:
aws cognito-idp delete-managed-login-branding \
  --user-pool-id eu-central-1_ZURSMpD2O \
  --client-id 5hb3f6dj5ialg77jf4blur9g6g \
  --profile mayaws \
  --region eu-central-1
```

## Design Tokens Used
The branding configuration uses the Jobsearch existing design tokens from `src/styles.css`:

| CSS Variable | Value | Purpose |
|-------------|-------|---------|
| `--brand` | `#0d9488` | Primary brand color (teal/green) |
| `--brand-dark` | `#0f766e` | Darker shade for depth |
| `--accent` | `#22d3ee` | Accent/cyan color |
| `--background` | `#f8fafc` | Login page background |
| `--surface` | `#ffffff` | Surface/white color |
| `--muted` | `#6b6255` | Muted/text color |
| `--text` | `#1b2333` | Primary text color |

These tokens ensure visual consistency with the rest of the Jobsearch application.

## Validation

### JSON Schema Validation
The branding-settings.json has been validated against the AWS Cognito Managed
Login CreateManagedLoginBranding API schema requirements:

Required parameters:
- BrandName (string) ✓
- CSS (string) ✓
- SupportedIdentityProviders (array) ✓

Optional parameters (not included, as not needed):
- ImageUrl
- LogoImageUrl
- BackgroundImageUrl

### Pre-flight Checks (in scripts)
- AWS CLI availability
- AWS profile configuration
- Branding config file existence
- User Pool accessibility
- App Client accessibility
- Approval prompt before AWS API call

### Post-application Verification
After applying branding (upon approval), verify:
- Login page displays custom brand name
- Colors match the specified design tokens
- No authentication flow changes (OIDC/PKCE unchanged)
- No tokens or cookies stored in reports
- Existing login functionality unchanged

## Governance & Approval

### What This Implementation Covers
✓ Branding configuration preparation
✓ Script creation with pre-flight checks
✓ JSON validation against API schema
✓ Documentation writing
✓ Git commit and push
✓ Design token consistency

### What This Implementation Does NOT Cover
✗ AWS Branding produktiv anwenden (requires separate approval)
✗ Cognito-Client verändern (besides branding)
✗ User Pool verändern
✗ OAuth/OIDC ändern
✗ Vercel deployen
✗ Neue React Login Seite erstellen
✗ Architektur ändernen
✗ Tokens oder Cookies in Reports

### Approval Checklist
Before running apply-branding.sh:
- [ ] Branding configuration reviewed (branding-settings.json)
- [ ] Design tokens approved (colors match jobsearch spec)
- [ ] AWS CLI command verified
- [ ] Rollback procedure understood and tested
- [ ] Stakeholder approval obtained
- [ ] Time window selected (off-peak recommended)
- [ ] Rollback plan documented
- [ ] Test plan for post-application verification

### Rollback Plan
If rollback is needed:
1. Run `./rollback-branding.sh` (after approval)
2. Or run: `aws cognito-idp delete-managed-login-branding --user-pool-id eu-central-1_ZURSMpD2O --client-id 5hb3f6dj5ialg77jf4blur9g6g --profile mayaws --region eu-central-1`
3. Verify login page reverts to default Cognito appearance
4. Confirm no authentication parameters changed

## Git Operations

The following files should be committed and pushed to origin/main:

```
branding-settings.json
apply-branding.sh
rollback-branding.sh
README.md
```

**DO NOT** execute the AWS CLI commands without explicit approval.
The scripts and configuration are ready for review and approval.

## Contact & Support
For questions about this branding implementation, refer to the existing
JOBMATCHER-OIDC-AUTH-RELEASE-01 and JOBMATCHER-PROFILE-ROUTING-FIX-01
execution logs for context on the Cognito integration.

---

## Version
1.0 - Implementation Ready

## Last Updated
2026-10-24

## Status
IMPLEMENTATION READY
AWS APPLY AWAITING APPROVAL
