# Cloud Run Deployment Guide

## Overview
This guide covers deploying AI Recruiter to Google Cloud Run with proper configuration management via Google Cloud Secret Manager.

## Current Deployment Status

### Frontend
- **Service Name**: `ai-recruiter-frontend`
- **Region**: `us-west1`
- **URL**: https://ai-recruiter-frontend-167160983469.us-west1.run.app
- **Runtime**: Node.js (Next.js)

### Backend
- **Service Name**: `ai-recruiter-api`
- **Region**: `us-west1`
- **URL**: https://ai-recruiter-api-167160983469.us-west1.run.app
- **Runtime**: Python 3.11 (FastAPI)

### Database
- **Type**: MySQL 8.0
- **Location**: Google Cloud VM (separate VM)
- **Authentication**: Firebase Authentication

## Secret Manager Configuration

### Current Secrets (JSON format in `ai-recruiter-config`)

Your secret should be stored in Google Cloud Secret Manager as a JSON object named `ai-recruiter-config`:

```json
{
  "DATABASE_URL": "mysql+pymysql://user:password@vm-ip:3306/ai_recruiter",
  "SECRET_KEY": "your-production-secret-key",
  "GEMINI_API_KEY": "your-gemini-api-key",
  "OUTLOOK_CLIENT_ID": "your-client-id",
  "OUTLOOK_CLIENT_SECRET": "your-client-secret",
  "OUTLOOK_TENANT_ID": "your-tenant-id",
  "DATAGENIUS_API_KEY": "your-api-key",
  "CORS_ORIGINS": "https://ai-recruiter-frontend-167160983469.us-west1.run.app,http://localhost:3000",
  "FRONTEND_URL": "https://ai-recruiter-frontend-167160983469.us-west1.run.app"
}
```

### Key Fields

| Field | Purpose | Example |
|-------|---------|---------|
| `DATABASE_URL` | MySQL connection string | `mysql+pymysql://user:pass@10.0.0.5:3306/ai_recruiter` |
| `SECRET_KEY` | FastAPI secret key | Generate with: `openssl rand -hex 32` |
| `GEMINI_API_KEY` | Google Gemini AI API key | From Google Cloud Console |
| `CORS_ORIGINS` | Allowed frontend origins | `https://ai-recruiter-frontend-167160983469.us-west1.run.app` |
| `FRONTEND_URL` | Frontend URL for shareable links | `https://ai-recruiter-frontend-167160983469.us-west1.run.app` |
| `OUTLOOK_*` | Microsoft Graph API credentials | From Azure AD app |
| `DATAGENIUS_API_KEY` | datagenius integration API key | Your API key |

## Deployment Steps

### 1. Update Secret Manager

```bash
# Update the secret with new FRONTEND_URL
gcloud secrets versions add ai-recruiter-config --data-file=-
# Paste the JSON with updated FRONTEND_URL
```

**Important**: Make sure `FRONTEND_URL` matches your deployed frontend URL exactly.

### 2. Deploy Backend to Cloud Run

```bash
cd backend

# Build and push to Cloud Run
gcloud run deploy ai-recruiter-api \
  --source . \
  --region us-west1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars ENVIRONMENT=production,GOOGLE_CLOUD_PROJECT=cloudmetica-apps \
  --memory 2Gi \
  --timeout 3600
```

### 3. Deploy Frontend to Cloud Run

```bash
cd frontend

# Build and push to Cloud Run
gcloud run deploy ai-recruiter-frontend \
  --source . \
  --region us-west1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --timeout 300
```

**Note**: For Next.js, you may need a custom `Dockerfile` in the frontend directory.

### 4. Verify Deployment

```bash
# Test backend health
curl https://ai-recruiter-api-167160983469.us-west1.run.app/health

# Test shareable link endpoint
curl "https://ai-recruiter-api-167160983469.us-west1.run.app/api/v1/jobs/{job_id}/application-link" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Important: Shareable Links Configuration

### Before Deployment ✅
- Application link: `http://localhost:3000/apply/{token}`
- Interview link: `http://localhost:3000/interview/{token}`

### After Deployment ✅
- Application link: `https://ai-recruiter-frontend-167160983469.us-west1.run.app/apply/{token}`
- Interview link: `https://ai-recruiter-frontend-167160983469.us-west1.run.app/interview/{token}`

**This is controlled by the `FRONTEND_URL` environment variable in Secret Manager.**

## Environment Variables for Backend

### Automatically loaded from Secret Manager (Production)
- `DATABASE_URL`
- `SECRET_KEY`
- `GEMINI_API_KEY`
- `CORS_ORIGINS`
- `FRONTEND_URL` ← **NEW**
- `OUTLOOK_CLIENT_ID`
- `OUTLOOK_CLIENT_SECRET`
- `OUTLOOK_TENANT_ID`
- `DATAGENIUS_API_KEY`

### Set on Cloud Run Service
- `ENVIRONMENT=production` ← **Critical for Secret Manager loading**
- `GOOGLE_CLOUD_PROJECT=cloudmetica-apps`

## Troubleshooting

### Issue: Shareable links still show localhost

**Solution**: 
1. Verify `FRONTEND_URL` is set in Secret Manager
2. Check that `ENVIRONMENT=production` is set on the Cloud Run service
3. Restart the Cloud Run service to clear cached settings

```bash
# Verify environment variables
gcloud run services describe ai-recruiter-api --region us-west1

# Verify secret is readable
gcloud secrets versions access latest --secret="ai-recruiter-config"
```

### Issue: 403 Forbidden when accessing Secret Manager

**Solution**: Ensure the Cloud Run service has the `Secret Manager Secret Accessor` role:

```bash
# Grant permission
gcloud projects add-iam-policy-binding cloudmetica-apps \
  --member=serviceAccount:ai-recruiter-api@cloudmetica-apps.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

## Database Connection from Cloud Run

Ensure your MySQL VM is accessible from Cloud Run:

1. **Firewall Rules**: VM must accept connections from Cloud Run on port 3306
2. **Network**: For best security, use Cloud SQL Proxy or VPC connector
3. **Connection String**: Use VM's internal IP if in same VPC, external IP otherwise

## Similar Deployment (datagenius Reference)

Your previous deployment for datagenius used the same pattern:
- Service: `datagenius-api` in Cloud Run
- Database: MySQL on separate VM
- Configuration: Via Secret Manager

This AI Recruiter deployment follows the same architecture.

## Next Steps

1. ✅ Update Secret Manager with `FRONTEND_URL`
2. ✅ Restart backend Cloud Run service
3. ✅ Test shareable links in UI
4. ✅ Monitor logs for any issues

```bash
# View real-time logs
gcloud run services logs read ai-recruiter-api --region us-west1 --limit 50 --follow
```

---

**Last Updated**: March 21, 2026
