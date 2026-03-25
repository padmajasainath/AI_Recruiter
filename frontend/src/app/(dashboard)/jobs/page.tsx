'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

const statusBadge = (s: string) => {
    const map: Record<string, string> = {
        ACTIVE: 'badge-active', PAUSED: 'badge-paused', CLOSED: 'badge-closed',
    };
    return map[s] || '';
};

export default function JobsPage() {
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.listJobs().then(d => setJobs(d.jobs)).catch(console.error).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

    return (
        <>
            <div className="page-header">
                <div>
                    <h1>Job Postings</h1>
                    <p>Manage your open positions and track applications</p>
                </div>
                <Link href="/jobs/new" className="btn btn-primary">➕ New Job Posting</Link>
            </div>

            {jobs.length === 0 ? (
                <div className="empty-state">
                    <div className="icon">💼</div>
                    <h3>No job postings yet</h3>
                    <p>Create your first job posting to start receiving AI-screened applications.</p>
                    <Link href="/jobs/new" className="btn btn-primary" style={{ marginTop: '16px' }}>
                        Create Your First Job
                    </Link>
                </div>
            ) : (
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Job Title</th>
                                <th>Status</th>
                                <th>Location</th>
                                <th>Applications</th>
                                <th>Threshold</th>
                                <th>Created</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {jobs.map(job => (
                                <tr key={job.id}>
                                    <td style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                                        {job.job_id}
                                    </td>
                                    <td>
                                        <Link href={`/jobs/${job.id}`} style={{ color: 'var(--accent-light)', textDecoration: 'none', fontWeight: 600 }}>
                                            {job.title}
                                        </Link>
                                        {job.department && (
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                {job.department}
                                            </div>
                                        )}
                                    </td>
                                    <td><span className={`badge ${statusBadge(job.status)}`}>{job.status}</span></td>
                                    <td>
                                        <span style={{ fontSize: '13px' }}>
                                            {job.location || 'Not specified'}
                                            <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>({job.location_type})</span>
                                        </span>
                                    </td>
                                    <td style={{ fontWeight: 600 }}>{job.application_count || 0}</td>
                                    <td>
                                        <span style={{
                                            background: 'var(--accent-glow)', padding: '2px 8px',
                                            borderRadius: '4px', fontSize: '13px',
                                        }}>
                                            {job.screening_threshold}%
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                        {new Date(job.created_at).toLocaleDateString()}
                                    </td>
                                    <td>
                                        <Link href={`/jobs/${job.id}`} className="btn btn-ghost btn-sm">View →</Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}
