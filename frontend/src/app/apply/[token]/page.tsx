'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { submitApplication, getPublicJobDetails } from '@/lib/api';

export default function PublicApplyPage() {
    const params = useParams();
    const token = params.token as string;

    const [job, setJob] = useState<any>(null);
    const [loadingJob, setLoadingJob] = useState(true);
    const [jobNotFound, setJobNotFound] = useState(false);

    const [form, setForm] = useState({ candidate_name: '', candidate_email: '', phone: '', cover_letter: '' });
    const [resume, setResume] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        getPublicJobDetails(token)
            .then(data => {
                if (!data) {
                    setJobNotFound(true);
                    return;
                }
                setJob(data);
                setJobNotFound(false);
            })
            .catch(err => {
                console.error(err);
                setJobNotFound(true);
            })
            .finally(() => setLoadingJob(false));
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resume) { setError('Please upload your resume'); return; }
        setError('');
        setSubmitting(true);

        try {
            const fd = new FormData();
            fd.append('candidate_name', form.candidate_name);
            fd.append('candidate_email', form.candidate_email);
            if (form.phone) fd.append('phone', form.phone);
            if (form.cover_letter) fd.append('cover_letter', form.cover_letter);
            fd.append('resume', resume);

            await submitApplication(token, fd);
            setSuccess(true);
        } catch (err: any) {
            setError(err.message || 'Application submission failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className="apply-page">
                <div className="apply-container">
                    <div className="card apply-success">
                        <div className="check-icon">✓</div>
                        <h2 style={{ fontSize: '24px', marginBottom: '12px' }}>Application Submitted!</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '16px', lineHeight: '1.6' }}>
                            Thank you for applying. Our AI screening system will review your resume
                            and you&apos;ll hear back from us shortly.
                        </p>
                        <div style={{
                            marginTop: '24px', padding: '16px', background: 'var(--bg-primary)',
                            borderRadius: '8px', fontSize: '14px', color: 'var(--text-muted)',
                        }}>
                            ✉️ Check your email for updates. Our AI agent may reach out for scheduling.
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (jobNotFound) {
        return (
            <div className="apply-page">
                <div className="apply-container">
                    <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '20px' }}>📁</div>
                        <h2 style={{ fontSize: '24px', marginBottom: '12px' }}>Applications Closed</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '16px', lineHeight: '1.6', maxWidth: '400px', margin: '0 auto' }}>
                            This position is no longer accepting applications. It may have been filled or paused by the hiring team.
                        </p>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="btn btn-secondary"
                            style={{ marginTop: '32px' }}
                        >
                            Find Other Careers
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="apply-page">
            <div className="apply-container">
                <div className="apply-header">
                    <h1>{job ? `Apply for ${job.title}` : 'Apply for This Position'}</h1>
                    <p>Submit your application. Our AI will review your resume instantly.</p>
                    {job?.status === 'PAUSED' && (
                        <div style={{
                            marginTop: '20px', padding: '16px', borderRadius: '12px',
                            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                            color: '#b45309', display: 'flex', alignItems: 'center', gap: '12px',
                            fontWeight: 500
                        }}>
                            <span style={{ fontSize: '20px' }}>⏳</span>
                            <div>
                                <strong>Applications are Temporarily Paused</strong>
                                <div style={{ fontSize: '13px', opacity: 0.8, fontWeight: 400 }}>
                                    The hiring team is currently reviewing existing applications. You can still read the job description below.
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {loadingJob ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
                ) : job ? (
                    <div className="card" style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                            <span className="badge badge-active">{job.location_type || 'REMOTE'}</span>
                            {job.location && <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>📍 {job.location}</span>}
                            {job.department && <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>🏢 {job.department}</span>}
                        </div>
                        <h3 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--text-muted)' }}>Job Description</h3>
                        <div style={{ fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
                            {job.description}
                        </div>
                        {job.skills_required?.length > 0 && (
                            <>
                                <h3 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--text-muted)' }}>Required Skills</h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {job.skills_required.map((s: string) => (
                                        <span key={s} className="skill-tag">{s}</span>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                ) : null}

                {job?.status === 'ACTIVE' && (
                    <form onSubmit={handleSubmit} className="card">
                        {error && (
                            <div style={{
                                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                                padding: '12px 16px', borderRadius: '8px', color: 'var(--error)',
                                marginBottom: '20px', fontSize: '14px',
                            }}>
                                {error}
                            </div>
                        )}

                        <div className="form-group">
                            <label>Full Name *</label>
                            <input className="form-input" type="text" value={form.candidate_name}
                                onChange={e => setForm({ ...form, candidate_name: e.target.value })}
                                placeholder="John Doe" required />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Email *</label>
                                <input className="form-input" type="email" value={form.candidate_email}
                                    onChange={e => setForm({ ...form, candidate_email: e.target.value })}
                                    placeholder="john@example.com" required />
                            </div>
                            <div className="form-group">
                                <label>Phone</label>
                                <input className="form-input" type="tel" value={form.phone}
                                    onChange={e => setForm({ ...form, phone: e.target.value })}
                                    placeholder="+1 (555) 000-0000" />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Resume *</label>
                            <div style={{
                                border: '2px dashed var(--border)', borderRadius: '8px',
                                padding: '32px', textAlign: 'center', cursor: 'pointer',
                                transition: 'border-color 0.2s',
                            }}
                                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
                                onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                                onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border)'; setResume(e.dataTransfer.files[0]); }}
                                onClick={() => document.getElementById('resume-input')?.click()}
                            >
                                <input id="resume-input" type="file" accept=".pdf,.docx"
                                    style={{ display: 'none' }}
                                    onChange={e => setResume(e.target.files?.[0] || null)} />
                                {resume ? (
                                    <div>
                                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
                                        <div style={{ fontWeight: 600 }}>{resume?.name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            {resume ? (resume.size / 1024).toFixed(1) : '0'} KB
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>⬆️</div>
                                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>Drop your resume here</div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                            PDF or DOCX (max 10MB)
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Cover Letter (Optional)</label>
                            <textarea className="form-input" value={form.cover_letter}
                                onChange={e => setForm({ ...form, cover_letter: e.target.value })}
                                placeholder="Why are you interested in this role?"
                                rows={4} />
                        </div>

                        <button type="submit" className="btn btn-primary"
                            style={{ width: '100%', padding: '14px' }}
                            disabled={submitting}>
                            {submitting ? '🔄 Submitting...' : '🚀 Submit Application'}
                        </button>

                        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                            Your resume will be reviewed by our AI screening system
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
