'use client';

import { Fragment, useEffect, useState, useCallback } from 'react';
import { api, apiDownloadFile } from '@/lib/api';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ScoreCircle from '@/components/ScoreCircle';


const statusOrder = ['APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'HIRED', 'REJECTED'];
const statusLabel: Record<string, string> = {
    APPLIED: 'Applied', SCREENING: 'Screening', SHORTLISTED: 'Shortlisted',
    INTERVIEW_SCHEDULED: 'Interview Scheduled', INTERVIEW_COMPLETED: 'Interview Done',
    HIRED: 'Hired', REJECTED: 'Rejected',
};

function badgeClass(s: string) {
    return `badge badge-${s.toLowerCase().replace('_', '')}`;
}

/* ─────────── Main Page ─────────── */

/* ─────────── Main Page ─────────── */
export default function JobDetailPage() {
    const params = useParams();
    const jobId = params.id as string;
    const [job, setJob] = useState<any>(null);
    const [apps, setApps] = useState<any[]>([]);
    const [applyLink, setApplyLink] = useState('');
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'pipeline' | 'table'>('table');
    const [copied, setCopied] = useState(false);
    const [polling, setPolling] = useState(false);

    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [skillInput, setSkillInput] = useState('');

    const load = useCallback(async () => {
        try {
            const [j, a, l] = await Promise.all([
                api.getJob(jobId),
                api.listApplications(jobId),
                api.getJobLink(jobId),
            ]);
            setJob(j);
            setApps(a.applications || []);
            setApplyLink(l.apply_url || '');
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [jobId]);

    useEffect(() => { load(); }, [load]);

    const startEdit = () => {
        setEditForm({ ...job });
        setIsEditing(true);
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const updated = await api.updateJob(job.id, editForm);
            setJob(updated);
            setIsEditing(false);
        } catch (err: any) {
            alert(err.message || 'Failed to update job');
        } finally {
            setSaving(false);
        }
    };

    const addSkill = () => {
        const skill = skillInput.trim();
        if (skill && !editForm.skills_required.includes(skill)) {
            setEditForm({ ...editForm, skills_required: [...editForm.skills_required, skill] });
            setSkillInput('');
        }
    };

    const removeSkill = (s: string) => {
        setEditForm({ ...editForm, skills_required: editForm.skills_required.filter((x: string) => x !== s) });
    };

    const copyLink = async () => {
        await navigator.clipboard.writeText(applyLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handlePollInbox = async () => {
        setPolling(true);
        try {
            const result = await api.pollInbox();
            if (result.count > 0) {
                alert(`Processed ${result.count} new email(s). Refreshing...`);
                await load();
            } else {
                alert('No new emails found.');
            }
        } catch (e: any) {
            console.error(e);
            alert(`Poll failed: ${e.message}`);
        } finally {
            setPolling(false);
        }
    };

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
    if (!job) return <div className="empty-state"><h3>Job not found</h3></div>;

    const pipelineGroups = statusOrder.reduce((acc, s) => {
        acc[s] = apps.filter(a => a.status === s);
        return acc;
    }, {} as Record<string, any[]>);

    return (
        <>
            <div className="page-header">
                <div>
                    <Link href="/jobs" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '13px' }}>
                        ← Back to Jobs
                    </Link>
                    <h1 style={{ marginTop: '8px' }}>{job.title}</h1>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px', alignItems: 'center' }}>
                        <span className={`badge ${job.status === 'ACTIVE' ? 'badge-active' : 'badge-closed'}`}>{job.status}</span>
                        {job.location && <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>📍 {job.location}</span>}
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>🎯 Threshold: {job.screening_threshold}%</span>
                    </div>
                </div>
                {!isEditing && (
                    <button className="btn btn-primary" onClick={startEdit}>
                        📝 Edit Job
                    </button>
                )}
            </div>

            {isEditing ? (
                <div className="card" style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <h3>Edit Job Posting</h3>
                        <button className="btn btn-sm btn-ghost" onClick={() => setIsEditing(false)}>✕ Cancel</button>
                    </div>
                    <form onSubmit={handleSaveEdit}>
                        <div className="form-group">
                            <label>Job Title *</label>
                            <input className="form-input" type="text" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} required />
                        </div>
                        <div className="form-group">
                            <label>Description *</label>
                            <textarea className="form-input" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} rows={8} required />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Status</label>
                                <select className="form-input" value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                                    <option value="ACTIVE">Active</option>
                                    <option value="PAUSED">Paused</option>
                                    <option value="CLOSED">Closed</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Department</label>
                                <input className="form-input" type="text" value={editForm.department || ''} onChange={e => setEditForm({ ...editForm, department: e.target.value })} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Skills Required</label>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                <input className="form-input" style={{ flex: 1 }} type="text" value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())} placeholder="Type a skill and press Enter..." />
                                <button type="button" className="btn btn-secondary" onClick={addSkill}>Add</button>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {editForm.skills_required.map((s: string) => (
                                    <span key={s} className="skill-tag" style={{ cursor: 'pointer' }} onClick={() => removeSkill(s)}>{s} ✕</span>
                                ))}
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Min Experience (Yrs)</label>
                                <input className="form-input" type="number" value={editForm.years_of_experience_min} onChange={e => setEditForm({ ...editForm, years_of_experience_min: +e.target.value })} min={0} />
                            </div>
                            <div className="form-group">
                                <label>Max Experience (Yrs)</label>
                                <input className="form-input" type="number" value={editForm.years_of_experience_max || ''} onChange={e => setEditForm({ ...editForm, years_of_experience_max: e.target.value ? +e.target.value : undefined })} />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Location</label>
                                <input className="form-input" type="text" value={editForm.location || ''} onChange={e => setEditForm({ ...editForm, location: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Location Type</label>
                                <select className="form-input" value={editForm.location_type} onChange={e => setEditForm({ ...editForm, location_type: e.target.value })}>
                                    <option value="REMOTE">Remote</option>
                                    <option value="HYBRID">Hybrid</option>
                                    <option value="ONSITE">On-site</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Salary Min</label>
                                <input className="form-input" type="number" value={editForm.expected_salary_min || ''} onChange={e => setEditForm({ ...editForm, expected_salary_min: e.target.value ? +e.target.value : undefined })} />
                            </div>
                            <div className="form-group">
                                <label>Salary Max</label>
                                <input className="form-input" type="number" value={editForm.expected_salary_max || ''} onChange={e => setEditForm({ ...editForm, expected_salary_max: e.target.value ? +e.target.value : undefined })} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>AI Screening Threshold (%)</label>
                            <input className="form-input" type="range" min={0} max={100} value={editForm.screening_threshold} onChange={e => setEditForm({ ...editForm, screening_threshold: +e.target.value })} />
                            <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: 600 }}>{editForm.screening_threshold}%</div>
                        </div>

                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : 'Save Job Posting'}
                        </button>
                    </form>
                </div>
            ) : (
                <div className="card" style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, paddingRight: '24px' }}>
                            <h3 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--text-muted)' }}>Job Description</h3>
                            <div style={{ fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
                                {job.description}
                            </div>

                            <h3 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--text-muted)' }}>Required Skills</h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {job.skills_required?.length > 0 ? job.skills_required.map((s: string) => (
                                    <span key={s} className="skill-tag">{s}</span>
                                )) : <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>None specified</span>}
                            </div>
                        </div>

                        <div style={{ width: '250px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', fontSize: '13px' }}>
                            <div style={{ marginBottom: '8px' }}><strong>Status:</strong> {job.status}</div>
                            <div style={{ marginBottom: '8px' }}><strong>Department:</strong> {job.department || '—'}</div>
                            <div style={{ marginBottom: '8px' }}><strong>Location:</strong> {job.location || '—'} ({job.location_type})</div>
                            <div style={{ marginBottom: '8px' }}><strong>Experience:</strong> {job.years_of_experience_min}{job.years_of_experience_max ? ` - ${job.years_of_experience_max}` : '+'} years</div>
                            <div style={{ marginBottom: '8px' }}>
                                <strong>Salary:</strong> {job.expected_salary_min ? `${job.expected_salary_min.toLocaleString()} ${job.salary_currency}` : '—'}
                                {job.expected_salary_max ? ` - ${job.expected_salary_max.toLocaleString()} ${job.salary_currency}` : ''}
                            </div>
                            <div><strong>Threshold:</strong> {job.screening_threshold}%</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Apply Link Box */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                    <div>
                        <h3 style={{ fontSize: '14px', marginBottom: '4px' }}>🔗 Shareable Application Link</h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Share this with candidates to apply</p>
                    </div>
                    <div className="copy-link-box" style={{ flex: 1, maxWidth: '500px' }}>
                        <input readOnly value={applyLink} style={{ fontFamily: 'monospace', fontSize: '12px' }} />
                        <button className="btn btn-sm btn-primary" onClick={copyLink}>
                            {copied ? '✅ Copied!' : '📋 Copy'}
                        </button>
                    </div>
                </div>
            </div>



            {/* View Toggle + Poll Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px' }}>Candidates ({apps.length})</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        className="btn btn-sm btn-ghost"
                        onClick={handlePollInbox}
                        disabled={polling}
                        title="Check for new email replies from candidates"
                    >
                        {polling ? '⏳ Checking...' : '📬 Poll Inbox'}
                    </button>
                    <button className={`btn btn-sm ${view === 'table' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setView('table')}>Table</button>
                    <button className={`btn btn-sm ${view === 'pipeline' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setView('pipeline')}>Pipeline</button>
                </div>
            </div>

            {apps.length === 0 ? (
                <div className="empty-state">
                    <div className="icon">📭</div>
                    <h3>No applications yet</h3>
                    <p>Share the apply link above to start receiving AI-screened candidates.</p>
                </div>
            ) : view === 'table' ? (
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Candidate</th>
                                <th style={{ textAlign: 'center' }}>AI Score</th>
                                <th>Status</th>
                                <th>Applied</th>
                                <th style={{ textAlign: 'right' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {apps.map(a => (
                                <tr key={a.id} className="clickable-row">
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{a.candidate_name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{a.candidate_email}</div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                                            <ScoreCircle score={a.ai_score} />
                                        </div>
                                    </td>
                                    <td>
                                        <span className={badgeClass(a.status)}>
                                            {statusLabel[a.status] || a.status}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                        {new Date(a.created_at).toLocaleDateString()}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <Link href={`/jobs/${jobId}/applications/${a.id}`} className="btn btn-sm btn-ghost">
                                            View Details →
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="pipeline">
                    {statusOrder.filter(s => s !== 'REJECTED').map(s => (
                        <div key={s} className="pipeline-column">
                            <h3>
                                {statusLabel[s]}
                                <span className="count">{pipelineGroups[s]?.length || 0}</span>
                            </h3>
                            {pipelineGroups[s]?.map(a => (
                                <Link key={a.id} href={`/jobs/${jobId}/applications/${a.id}`} className="pipeline-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{a.candidate_name}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        {a.candidate_email}
                                    </div>
                                    {a.ai_score !== null && (
                                        <div style={{ marginTop: '8px' }}>
                                            <ScoreCircle score={a.ai_score} />
                                        </div>
                                    )}
                                </Link>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
