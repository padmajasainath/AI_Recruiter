'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function RegisterPage() {
    const { user, registerCompany, loading } = useAuth();
    const router = useRouter();
    const [form, setForm] = useState({
        name: '',
        admin_name: '',
        email: user?.email || '',
        website: '',
        industry: '',
        description: '',
        outlook_tenant_id: '',
        outlook_client_id: '',
        outlook_client_secret: '',
        outlook_sender_email: '',
        sharepoint_tenant_id: '',
        sharepoint_client_id: '',
        sharepoint_client_secret: '',
        sharepoint_drive_id: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            await registerCompany(form);
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Registration failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="auth-page">
            <div style={{ maxWidth: '520px', width: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏢</div>
                    <h1 style={{
                        fontSize: '28px', fontWeight: 700,
                        background: 'var(--gradient-hero)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                    }}>
                        Set Up Your Company
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                        Register your company to start posting jobs and screening candidates with AI.
                    </p>
                </div>

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
                    <div style={{ margin: '0 0 24px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 600 }}>👤 Your Profile</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>This will be your display name in the platform.</p>
                    </div>

                    <div className="form-group">
                        <label>Your Full Name *</label>
                        <input
                            className="form-input"
                            type="text"
                            value={form.admin_name}
                            onChange={e => setForm({ ...form, admin_name: e.target.value })}
                            placeholder="John Doe"
                            required
                        />
                    </div>

                    <div style={{ margin: '32px 0 16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 600 }}>🏢 Company Details</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Basic information about your organization.</p>
                    </div>

                    <div className="form-group">
                        <label>Company Name *</label>
                        <input
                            className="form-input"
                            type="text"
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            placeholder="Cloudmetica Inc."
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Company Email *</label>
                        <input
                            className="form-input"
                            type="email"
                            value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })}
                            placeholder="hr@cloudmetica.com"
                            required
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Website</label>
                            <input
                                className="form-input"
                                type="url"
                                value={form.website}
                                onChange={e => setForm({ ...form, website: e.target.value })}
                                placeholder="https://cloudmetica.com"
                            />
                        </div>
                        <div className="form-group">
                            <label>Industry</label>
                            <input
                                className="form-input"
                                type="text"
                                value={form.industry}
                                onChange={e => setForm({ ...form, industry: e.target.value })}
                                placeholder="Technology"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>About the Company</label>
                        <textarea
                            className="form-input"
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                            placeholder="Brief description of your company..."
                            rows={3}
                        />
                    </div>

                    <div style={{ margin: '32px 0 16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 600 }}>📧 Outlook Integration</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Used for sending automated interview invitations and candidate communication.</p>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Outlook Tenant ID *</label>
                            <input
                                className="form-input"
                                type="text"
                                value={form.outlook_tenant_id}
                                onChange={e => setForm({ ...form, outlook_tenant_id: e.target.value })}
                                placeholder="fbbfc49a-..."
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Outlook Client ID *</label>
                            <input
                                className="form-input"
                                type="text"
                                value={form.outlook_client_id}
                                onChange={e => setForm({ ...form, outlook_client_id: e.target.value })}
                                placeholder="41dcdbbc-..."
                                required
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Outlook Client Secret *</label>
                            <input
                                className="form-input"
                                type="password"
                                value={form.outlook_client_secret}
                                onChange={e => setForm({ ...form, outlook_client_secret: e.target.value })}
                                placeholder="••••••••"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Outlook Sender Email *</label>
                            <input
                                className="form-input"
                                type="email"
                                value={form.outlook_sender_email}
                                onChange={e => setForm({ ...form, outlook_sender_email: e.target.value })}
                                placeholder="reply@yourcompany.com"
                                required
                            />
                        </div>
                    </div>

                    <div style={{ margin: '32px 0 16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 600 }}>📂 SharePoint Integration</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Used for securely storing candidate resumes and interview recordings.</p>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>SharePoint Tenant ID *</label>
                            <input
                                className="form-input"
                                type="text"
                                value={form.sharepoint_tenant_id}
                                onChange={e => setForm({ ...form, sharepoint_tenant_id: e.target.value })}
                                placeholder="fbbfc49a-..."
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>SharePoint Client ID *</label>
                            <input
                                className="form-input"
                                type="text"
                                value={form.sharepoint_client_id}
                                onChange={e => setForm({ ...form, sharepoint_client_id: e.target.value })}
                                placeholder="41dcdbbc-..."
                                required
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>SharePoint Client Secret *</label>
                            <input
                                className="form-input"
                                type="password"
                                value={form.sharepoint_client_secret}
                                onChange={e => setForm({ ...form, sharepoint_client_secret: e.target.value })}
                                placeholder="••••••••"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>SharePoint Drive ID *</label>
                            <input
                                className="form-input"
                                type="text"
                                value={form.sharepoint_drive_id}
                                onChange={e => setForm({ ...form, sharepoint_drive_id: e.target.value })}
                                placeholder="b!e8QbVkP7..."
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
                        {submitting ? 'Setting up...' : '🚀 Launch AI Recruiter'}
                    </button>
                </form>
            </div>
        </div>
    );
}
