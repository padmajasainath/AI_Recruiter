'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, apiDownloadFile } from '@/lib/api';
import EmailThread from '@/components/EmailThread';
import ScoreCircle from '@/components/ScoreCircle';

const statusOrder = ['APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'HIRED', 'REJECTED'];

export default function CandidateDetailPage() {
    const params = useParams();
    const jobId = params.id as string;
    const appId = params.appId as string;
    const router = useRouter();

    const [app, setApp] = useState<any>(null);
    const [job, setJob] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [loadingResume, setLoadingResume] = useState(false);

    const load = useCallback(async () => {
        try {
            const [a, j] = await Promise.all([
                api.getApplication(appId),
                api.getJob(jobId)
            ]);
            setApp(a);
            setJob(j);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [appId, jobId]);

    useEffect(() => { load(); }, [load]);

    const handleStatusChange = async (newStatus: string) => {
        setUpdatingStatus(true);
        try {
            await api.updateApplicationStatus(appId, newStatus);
            setApp({ ...app, status: newStatus });
        } catch (e: any) {
            alert(e.message || 'Failed to update status');
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleViewResume = async () => {
        if (app.resume_url.startsWith('http')) {
            window.open(app.resume_url, '_blank', 'noopener,noreferrer');
        } else {
            setLoadingResume(true);
            try {
                await apiDownloadFile(`/api/applications/${appId}/resume`);
            } catch (err: any) {
                alert("Failed to fetch resume: " + err.message);
            } finally {
                setLoadingResume(false);
            }
        }
    };

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
    if (!app) return <div className="empty-state"><h3>Candidate not found</h3></div>;

    return (
        <>
            <div className="page-header">
                <div>
                    <Link href={`/jobs/${jobId}`} style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '13px' }}>
                        ← Back to {job?.title || 'Job'}
                    </Link>
                    <h1 style={{ marginTop: '8px' }}>{app.candidate_name}</h1>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{app.candidate_email}</span>
                        {app.candidate_phone && <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>• {app.candidate_phone}</span>}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <select
                        className="btn btn-sm"
                        value={app.status}
                        disabled={updatingStatus}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                    >
                        {statusOrder.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button className="btn btn-primary" onClick={handleViewResume} disabled={loadingResume}>
                        {loadingResume ? '⏳ Loading...' : '📄 View Resume'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Main Content Area */}

                    {/* AI Insights Section */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                🤖 AI Screening Insights
                            </h3>
                            {app.ai_score !== null && <ScoreCircle score={app.ai_score} />}
                        </div>

                        {app.ai_reasoning ? (
                            <div style={{ backgroundColor: 'var(--bg-light)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>
                                    {app.ai_reasoning}
                                </div>
                            </div>
                        ) : (
                            <div className="empty-state" style={{ padding: '20px' }}>No screening data yet.</div>
                        )}

                        {(app.ai_skills_match || app.ai_experience_match) && (
                            <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <h4 style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Skills Match</h4>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {app.ai_skills_match?.matched?.map((s: string) => (
                                            <span key={s} className="skill-tag matched">
                                                {s}
                                            </span>
                                        ))}
                                        {app.ai_skills_match?.missing?.map((s: string) => (
                                            <span key={s} className="skill-tag missing">
                                                {s}
                                            </span>
                                        ))}
                                        {app.ai_skills_match?.extra?.map((s: string) => (
                                            <span key={s} className="skill-tag extra">
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h4 style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Experience</h4>
                                    <div style={{ fontSize: '13px' }}>
                                        {app.ai_experience_match ? (
                                            <>
                                                <div style={{ fontWeight: 600, color: app.ai_experience_match.match ? 'var(--success)' : 'var(--error)' }}>
                                                    {app.ai_experience_match.match ? '✓ Meets requirement' : '✕ Below requirement'}
                                                </div>
                                                <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                                                    {app.ai_experience_match.candidate_years} years exp. (Req: {app.ai_experience_match.required_min}{app.ai_experience_match.required_max ? `-${app.ai_experience_match.required_max}` : '+'} years)
                                                </div>
                                            </>
                                        ) : 'N/A'}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Email Thread Section */}
                    <div className="card">
                        <EmailThread appId={appId} candidateName={app.candidate_name} />
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Sidebar Area */}
                    <div className="card">
                        <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Candidate Profiles</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {app.candidate_linkedin && (
                                <a href={app.candidate_linkedin} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost" style={{ justifyContent: 'flex-start' }}>
                                    🔗 LinkedIn Profile
                                </a>
                            )}
                            {app.interviews?.some((iv: any) => iv.recording_web_url) && (
                                <a
                                    href={app.interviews.find((iv: any) => iv.recording_web_url).recording_web_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-sm"
                                    style={{
                                        justifyContent: 'flex-start',
                                        backgroundColor: 'rgba(79, 70, 229, 0.1)',
                                        color: '#818cf8',
                                        border: '1px solid rgba(79, 70, 229, 0.2)'
                                    }}
                                >
                                    🎬 Watch Interview Recording
                                </a>
                            )}
                            <div style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}>
                                <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Applied On</div>
                                <div>{new Date(app.created_at).toLocaleDateString()}</div>
                            </div>
                        </div>
                    </div>

                    {app.cover_letter && (
                        <div className="card">
                            <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Cover Letter</h3>
                            <div style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                                {app.cover_letter}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
