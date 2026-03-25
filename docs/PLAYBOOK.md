# 📖 AI Recruiter — Demo Playbook

This document explains how to run, manage, and troubleshoot the **AI Recruiter Public Prototype**.

## 🚀 Quick Start (Public Access)

To expose the application to the internet for a demo, use the automated tunnel management script:

```bash
./manage_tunnels.sh start
```

-   **Frontend**: Ngrok URL (printed in console)
-   **Backend**: Localtunnel URL (printed in console)
-   **LT Password**: `65.50.136.228`

---

## 🛠️ Management Commands

We use a combination of **Ngrok** (for the heavy frontend assets) and **Localtunnel** (for the backend API) to provide a stable, free public experience.

| Command | Description |
| :--- | :--- |
| `./manage_tunnels.sh start` | Kills old tunnels, starts new ones, updates configs, and restarts services. |
| `./manage_tunnels.sh stop` | Stops all tunnels, the Next.js dev server, and Docker containers. |
| `./manage_tunnels.sh status` | Shows the current active tunnel URLs. |

---

## 🔐 Important: First Access (The "Bypass" Step)

Because we use Localtunnel for the backend, **you must authorize the backend URL in your browser once** before the frontend can successfully communicate with it.

1.  **Authorize Backend**: Open the Backend Localtunnel URL (e.g., `https://tender-carrots-read.loca.lt`) in a new tab.
2.  **Enter Password**: If prompted, enter **`65.50.136.228`**.
3.  **Confirm**: Once you see a JSON response (e.g., `{"status":"healthy"}`), the backend is authorized for your browser.
4.  **Refresh Frontend**: Refresh the Frontend Ngrok URL tab. Everything should now load smoothly.

---

## 🔧 Troubleshooting

### "Failed to fetch" or Red Error Boxes
-   **Cause**: The backend tunnel hasn't been authorized yet (see "Bypass Step" above).
-   **Fix**: Visit the backend URL directly, enter the password, and refresh the frontend.

### Frontend stuck on Loading Spinner
-   **Cause**: Static assets (Next.js chunks) are failing to load.
-   **Fix**: This is why we use Ngrok for the frontend. If it still happens, try restarting with `./manage_tunnels.sh start`.

### 502 Bad Gateway
-   **Cause**: The underlying service (FastAPI or Next.js) hasn't fully started yet, or the tunnel disconnected.
-   **Fix**: Wait 10 seconds and refresh. If it persists, check if the services are running with `docker ps` and `ps aux | grep next`.

---

## 📝 Configuration Files
The `manage_tunnels.sh` script automatically manages these files for you:
-   `backend/.env`: Updates `FRONTEND_URL` and `CORS_ORIGINS`.
-   `frontend/.env.local`: Updates `NEXT_PUBLIC_API_URL`.
-   `frontend/next.config.ts`: Updates `allowedDevOrigins`.
