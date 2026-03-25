'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function NewJobPage() {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [skillInput, setSkillInput] = useState('');
    const [form, setForm] = useState({
        title: '',
        job_id: '',
        description: '',
        skills_required: [] as string[],
        years_of_experience_min: 0,
        years_of_experience_max: undefined as number | undefined,
        expected_salary_min: undefined as number | undefined,
        expected_salary_max: undefined as number | undefined,
        salary_currency: 'USD',
        location: '',
        location_type: 'REMOTE',
        department: '',
        screening_threshold: 70,
    });

    const addSkill = () => {
        const skill = skillInput.trim();
        if (skill && !form.skills_required.includes(skill)) {
            setForm({ ...form, skills_required: [...form.skills_required, skill] });
            setSkillInput('');
        }
    };

    const removeSkill = (s: string) => {
        setForm({ ...form, skills_required: form.skills_required.filter(x => x !== s) });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            const job = await api.createJob(form);
            router.push(`/jobs/${job.id}`);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <div className="page-header">
                <div>
                    <h1>Create Job Posting</h1>
                    <p>Fill in the job details. AI will automatically screen candidates who apply.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} style={{ maxWidth: '720px' }}>
                {error && (
                    <div style={{
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                        padding: '12px 16px', borderRadius: '8px', color: 'var(--error)',
                        marginBottom: '20px', fontSize: '14px',
                    }}>
                        {error}
                    </div>
                )}

                <div className="card" style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '16px', marginBottom: '20px' }}>📝 Job Details</h3>

                    <div className="form-group">
                        <label>Job ID / Reference * (Unique)</label>
                        <input className="form-input" type="text" value={form.job_id}
                            onChange={e => setForm({ ...form, job_id: e.target.value })}
                            placeholder="e.g. JOB-101 (Non-editable after creation)" required />
                    </div>

                    <div className="form-group">
                        <label>Job Title *</label>
                        <input className="form-input" type="text" value={form.title}
                            onChange={e => setForm({ ...form, title: e.target.value })}
                            placeholder="Senior Data Engineer" required />
                    </div>

                    <div className="form-group">
                        <label>Job Description / JD *</label>
                        <textarea className="form-input" value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                            placeholder="Describe the role, responsibilities, requirements..."
                            rows={8} required />
                    </div>

                    <div className="form-group">
                        <label>Department</label>
                        <input className="form-input" type="text" value={form.department}
                            onChange={e => setForm({ ...form, department: e.target.value })}
                            placeholder="Engineering" />
                    </div>
                </div>

                <div className="card" style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '16px', marginBottom: '20px' }}>🎯 Skills Required</h3>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <input className="form-input" style={{ flex: 1 }} type="text"
                            value={skillInput}
                            onChange={e => setSkillInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                            placeholder="Type a skill and press Enter..." />
                        <button type="button" className="btn btn-secondary" onClick={addSkill}>Add</button>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {form.skills_required.map(s => (
                            <span key={s} className="skill-tag" style={{ cursor: 'pointer' }} onClick={() => removeSkill(s)}>
                                {s} ✕
                            </span>
                        ))}
                    </div>
                </div>

                <div className="card" style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '16px', marginBottom: '20px' }}>📋 Requirements</h3>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Min Experience (Years) *</label>
                            <input className="form-input" type="number" value={form.years_of_experience_min}
                                onChange={e => setForm({ ...form, years_of_experience_min: +e.target.value })}
                                min={0} />
                        </div>
                        <div className="form-group">
                            <label>Max Experience (Years)</label>
                            <input className="form-input" type="number"
                                value={form.years_of_experience_max || ''}
                                onChange={e => setForm({ ...form, years_of_experience_max: e.target.value ? +e.target.value : undefined })} />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Location</label>
                            <input className="form-input" type="text" value={form.location}
                                onChange={e => setForm({ ...form, location: e.target.value })}
                                placeholder="San Francisco, CA" />
                        </div>
                        <div className="form-group">
                            <label>Location Type</label>
                            <select className="form-input" value={form.location_type}
                                onChange={e => setForm({ ...form, location_type: e.target.value })}>
                                <option value="REMOTE">Remote</option>
                                <option value="HYBRID">Hybrid</option>
                                <option value="ONSITE">On-site</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Min Salary (Optional)</label>
                            <input className="form-input" type="number"
                                value={form.expected_salary_min || ''}
                                onChange={e => setForm({ ...form, expected_salary_min: e.target.value ? +e.target.value : undefined })}
                                placeholder="80000" />
                        </div>
                        <div className="form-group">
                            <label>Max Salary (Optional)</label>
                            <input className="form-input" type="number"
                                value={form.expected_salary_max || ''}
                                onChange={e => setForm({ ...form, expected_salary_max: e.target.value ? +e.target.value : undefined })}
                                placeholder="150000" />
                        </div>
                    </div>
                </div>

                <div className="card" style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '16px', marginBottom: '20px' }}>🤖 AI Screening Threshold</h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                        Candidates scoring above this threshold will automatically receive an interview invitation.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <input type="range" min={0} max={100} value={form.screening_threshold}
                            onChange={e => setForm({ ...form, screening_threshold: +e.target.value })}
                            style={{ flex: 1, accentColor: 'var(--accent)' }} />
                        <span style={{
                            background: 'var(--accent-glow)', padding: '8px 16px',
                            borderRadius: '8px', fontWeight: 700, fontSize: '20px',
                            minWidth: '64px', textAlign: 'center',
                        }}>
                            {form.screening_threshold}%
                        </span>
                    </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px' }}
                    disabled={submitting}>
                    {submitting ? 'Creating...' : '🚀 Create Job & Generate Apply Link'}
                </button>
            </form>
        </>
    );
}
