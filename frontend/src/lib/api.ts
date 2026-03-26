import { auth } from './firebase';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

async function getAuthHeaders(): Promise<Record<string, string>> {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const token = await user.getIdToken();
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Bypass-Tunnel-Reminder': 'true',
        'Bypass-Tunnel-Requirement': 'true',
    };
}

async function apiFetch(path: string, options: RequestInit = {}) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { ...headers, ...options.headers },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `API error: ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
}

/** Helper for downloading files via authenticated endpoints */
export const apiDownloadFile = async (path: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}${path}`, {
        headers: { ...headers },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Failed to download file: ${res.status}`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    // Open the PDF in a new tab smoothly
    window.open(url, '_blank');

    // Clean up the object URL after a delay
    setTimeout(() => window.URL.revokeObjectURL(url), 10000);
}

// ─── Auth ───
export const api = {
    registerCompany: (data: any) =>
        apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    getMe: () => apiFetch('/api/auth/me'),

    // Dashboard
    getDashboardStats: () => apiFetch('/api/dashboard/stats'),

    // Jobs
    createJob: (data: any) =>
        apiFetch('/api/jobs', { method: 'POST', body: JSON.stringify(data) }),
    listJobs: (status?: string) =>
        apiFetch(`/api/jobs${status ? `?status=${status}` : ''}`),
    getJob: (id: string) => apiFetch(`/api/jobs/${id}`),
    updateJob: (id: string, data: any) =>
        apiFetch(`/api/jobs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteJob: (id: string) =>
        apiFetch(`/api/jobs/${id}`, { method: 'DELETE' }),
    getJobLink: (id: string) => apiFetch(`/api/jobs/${id}/link`),
    generatePrompt: (data: { title: string; description: string }) =>
        apiFetch('/api/jobs/generate-prompt', { method: 'POST', body: JSON.stringify(data) }),

    // Applications
    listApplications: (jobId: string, status?: string) =>
        apiFetch(`/api/jobs/${jobId}/applications${status ? `?status_filter=${status}` : ''}`),
    getApplication: (id: string) => apiFetch(`/api/applications/${id}`),
    updateApplicationStatus: (id: string, status: string) =>
        apiFetch(`/api/applications/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        }),

    // Interviews
    createInterview: (data: any) =>
        apiFetch('/api/interviews', { method: 'POST', body: JSON.stringify(data) }),
    listInterviews: (status?: string) =>
        apiFetch(`/api/interviews${status ? `?status_filter=${status}` : ''}`),
    getInterview: (id: string) => apiFetch(`/api/interviews/${id}`),

    // ─── Email Conversations ───
    getApplicationEmails: (appId: string) =>
        apiFetch(`/api/applications/${appId}/emails`),
    sendApplicationEmail: (appId: string, subject: string, bodyHtml: string, parentMessageId?: string) =>
        apiFetch(`/api/applications/${appId}/emails/send`, {
            method: 'POST',
            body: JSON.stringify({ subject, body_html: bodyHtml, parent_message_id: parentMessageId }),
        }),
    pollInbox: () =>
        apiFetch('/api/email/poll', { method: 'POST' }),

    // ─── Company Settings ───
    getCompanySettings: () =>
        apiFetch('/api/companies/me'),
    updateCompanySettings: (data: any) =>
        apiFetch('/api/companies/me', {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
};

// ─── Public (no auth) ───
export async function submitApplication(linkToken: string, formData: FormData) {
    const res = await fetch(`${API_BASE}/api/apply/${linkToken}`, {
        method: 'POST',
        body: formData,
        headers: {
            'Bypass-Tunnel-Reminder': 'true',
            'Bypass-Tunnel-Requirement': 'true',
        },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Application submission failed');
    }
    return res.json();
}

export const getPublicJobDetails = async (linkToken: string) => {
    const res = await fetch(`${API_BASE}/api/apply/${linkToken}`, {
        headers: {
            'Bypass-Tunnel-Reminder': 'true',
            'Bypass-Tunnel-Requirement': 'true',
        },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
        throw new Error('Failed to load job details');
    }
    return res.json();
}
export const getPublicInterviewInfo = async (token: string) => {
    const res = await fetch(`${API_BASE}/api/interview/${token}/info`, {
        headers: {
            'Bypass-Tunnel-Reminder': 'true',
            'Bypass-Tunnel-Requirement': 'true',
        },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Failed to load interview details');
    }
    return res.json();
}
