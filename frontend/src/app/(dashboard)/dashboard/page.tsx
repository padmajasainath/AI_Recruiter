'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function DashboardPage() {
    const { companyData } = useAuth();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getDashboardStats().then(setStats).catch(console.error).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

    const statCards = [
        { label: 'Active Jobs', value: stats?.active_jobs || 0, icon: '💼', color: 'purple' },
        { label: 'Total Applications', value: stats?.total_applications || 0, icon: '📄', color: 'blue' },
        { label: 'Pending Screening', value: stats?.pending_screening || 0, icon: '⏳', color: 'yellow' },
        { label: 'Shortlisted', value: stats?.shortlisted || 0, icon: '⭐', color: 'green' },
        { label: 'Interviews Scheduled', value: stats?.interviews_scheduled || 0, icon: '🎙️', color: 'purple' },
        { label: 'Interviews Completed', value: stats?.interviews_completed || 0, icon: '✅', color: 'blue' },
        { label: 'Hired', value: stats?.hired || 0, icon: '🎉', color: 'green' },
        { label: 'Total Jobs', value: stats?.total_jobs || 0, icon: '📋', color: 'yellow' },
    ];

    return (
        <>
            <div className="page-header">
                <div>
                    <h1>Welcome back{companyData?.company?.name ? `, ${companyData.company.name}` : ''} 👋</h1>
                    <p>Here&apos;s your recruitment pipeline at a glance</p>
                </div>
                <Link href="/jobs/new" className="btn btn-primary">
                    ➕ Post New Job
                </Link>
            </div>

            <div className="stats-grid">
                {statCards.map((s, i) => (
                    <div key={i} className="stat-card">
                        <div className={`stat-icon ${s.color}`}>{s.icon}</div>
                        <div>
                            <div className="stat-value">{s.value}</div>
                            <div className="stat-label">{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div className="card">
                    <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>🚀 Quick Actions</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <Link href="/jobs/new" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                            💼 Create Job Posting
                        </Link>
                        <Link href="/jobs" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                            📋 View All Jobs
                        </Link>
                        <Link href="/interviews" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                            🎙️ Interview Tracker
                        </Link>
                    </div>
                </div>

                <div className="card">
                    <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>📈 AI Pipeline Overview</h3>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                        <p>AI Recruiter automatically:</p>
                        <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                            <li style={{ listStyle: 'disc' }}>Parses uploaded resumes</li>
                            <li style={{ listStyle: 'disc' }}>Scores candidates against job requirements</li>
                            <li style={{ listStyle: 'disc' }}>Sends interview invitations to qualified candidates</li>
                            <li style={{ listStyle: 'disc' }}>Auto-responds to candidate email replies</li>
                            <li style={{ listStyle: 'disc' }}>Tracks AI-led interview results</li>
                        </ul>
                    </div>
                </div>
            </div>
        </>
    );
}
