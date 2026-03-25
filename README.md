# AI Recruiter 🚀

[![Deploy to Cloud Run](https://github.com/cloudmetica/AI_Recruiter/actions/workflows/deploy.yml/badge.badge.svg)](https://github.com/cloudmetica/AI_Recruiter/actions/workflows/deploy.yml)

Agentic AI-led recruitment tracker and screening portal.

## Architecture
- **Frontend**: Next.js (TypeScript, Tailwind CSS)
- **Backend**: FastAPI (Python, SQLAlchemy with MySQL)
- **AI Engine**: Google Gemini 2.0 (Multimodal Live API for interviews)
- **Email/Calendar**: Microsoft Graph API (Outlook)
- **Storage**: SharePoint (Microsoft Graph API) & Firebase Storage

## Key Features
- **Public Job Portal**: Shareable links for candidates to apply.
- **AI Screening**: Automatic resume parsing and scoring against JD requirements.
- **AI Interviews**: Voice-led, real-time interviews using Gemini Multimodal Live.
- **Recruiter Dashboard**: Comprehensive tracking of candidates, scores, and recordings.
- **Outlook/SharePoint Integration**: Automatic email communications and resume storage.

## Deployment
- Deployed on **Google Cloud Run**.
- Database: **Google Cloud SQL (MySQL)**.
- Secrets: Managed via **Google Secret Manager**.

## Documentation
Refer to the `docs/` folder for detailed guides:
- [Cloud Run Deployment](docs/CLOUD_RUN_DEPLOYMENT.md)
- [Project Playbook](docs/PLAYBOOK.md)
- [UI/UX Refinement](docs/UI_UX_REFINEMENT_CHECKLIST.md)

## Local Development
To run the entire stack locally with hot-reloading:
1.  **Clone the repository**.
2.  **Environment Setup**:
    - Copy `backend/.env.example` to `backend/.env`.
    - Copy `frontend/.env.example` to `frontend/.env.local`.
    - Fill in the required API keys (Gemini, Firebase, Microsoft Graph).
3.  **Start with Docker**:
    ```bash
    docker-compose up --build
    ```
4.  **Access**:
    - Frontend: [http://localhost:3000](http://localhost:3000)
    - Backend API: [http://localhost:8001](http://localhost:8001)
    - Database: Local MySQL on port `3307`.
