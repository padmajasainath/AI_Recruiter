'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function SettingsPage() {
    const [company, setCompany] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        api.getCompanySettings()
            .then((data: any) => {
                setCompany(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target as any;
        setCompany((prev: any) => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');
        try {
            await api.updateCompanySettings(company);
            setMessage('Settings saved successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (err: any) {
            setMessage(`Error: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;
    if (!company) return <div className="empty-state"><h3>Failed to load company settings.</h3></div>;

    return (
        <>
            <div className="page-header">
                <div>
                    <h1>Settings & Integrations</h1>
                    <p>Configure your company profile and third-party integrations</p>
                </div>
                {message && (
                    <div className={`badge ${message.includes('Error') ? 'badge-rejected' : 'badge-shortlisted'}`}>
                        {message}
                    </div>
                )}
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                {/* 🏢 Company Profile */}
                <div className="card">
                    <h3 style={{ fontSize: '16px', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                        🏢 Company Profile
                    </h3>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Company Name</label>
                            <input
                                name="name"
                                value={company.name || ''}
                                onChange={handleChange}
                                className="form-input"
                                placeholder="Enter company name"
                            />
                        </div>
                        <div className="form-group">
                            <label>Website</label>
                            <input
                                name="website"
                                value={company.website || ''}
                                onChange={handleChange}
                                className="form-input"
                                placeholder="https://example.com"
                            />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Industry</label>
                            <input
                                name="industry"
                                value={company.industry || ''}
                                onChange={handleChange}
                                className="form-input"
                                placeholder="e.g. Technology"
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Description</label>
                        <textarea
                            name="description"
                            value={company.description || ''}
                            onChange={handleChange}
                            className="form-input"
                            placeholder="Briefly describe your company..."
                        />
                    </div>
                </div>

                {/* ✉️ Outlook Integration */}
                <div className="card">
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                        <h3 style={{ fontSize: '16px', margin: 0 }}>✉️ Microsoft Outlook Integration</h3>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>AI Auto-Reply</span>
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    name="auto_reply_enabled"
                                    checked={company.auto_reply_enabled}
                                    onChange={handleChange}
                                />
                                <span className="toggle-slider" />
                            </label>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Outlook Tenant ID</label>
                            <input
                                name="outlook_tenant_id"
                                value={company.outlook_tenant_id || ''}
                                onChange={handleChange}
                                className="form-input"
                                style={{ fontFamily: 'monospace', fontSize: '12px' }}
                                placeholder="common"
                            />
                        </div>
                        <div className="form-group">
                            <label>Outlook Client ID</label>
                            <input
                                name="outlook_client_id"
                                value={company.outlook_client_id || ''}
                                onChange={handleChange}
                                className="form-input"
                                style={{ fontFamily: 'monospace', fontSize: '12px' }}
                                placeholder="client-uuid"
                            />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Outlook Client Secret</label>
                            <input
                                name="outlook_client_secret"
                                type="password"
                                value={company.outlook_client_secret || ''}
                                onChange={handleChange}
                                className="form-input"
                                style={{ fontFamily: 'monospace', fontSize: '12px' }}
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="form-group">
                            <label>Sender Email Address</label>
                            <input
                                name="outlook_sender_email"
                                value={company.outlook_sender_email || ''}
                                onChange={handleChange}
                                className="form-input"
                                placeholder="hr@company.com"
                            />
                        </div>
                    </div>
                </div>

                {/* 📂 SharePoint Storage Integration */}
                <div className="card">
                    <h3 style={{ fontSize: '16px', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                        📂 Microsoft SharePoint Integration
                    </h3>
                    <div className="form-row">
                        <div className="form-group">
                            <label>SharePoint Tenant ID</label>
                            <input
                                name="sharepoint_tenant_id"
                                value={company.sharepoint_tenant_id || ''}
                                onChange={handleChange}
                                className="form-input"
                                style={{ fontFamily: 'monospace', fontSize: '12px' }}
                                placeholder="tenant-uuid"
                            />
                        </div>
                        <div className="form-group">
                            <label>SharePoint Client ID</label>
                            <input
                                name="sharepoint_client_id"
                                value={company.sharepoint_client_id || ''}
                                onChange={handleChange}
                                className="form-input"
                                style={{ fontFamily: 'monospace', fontSize: '12px' }}
                                placeholder="client-uuid"
                            />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>SharePoint Client Secret</label>
                            <input
                                name="sharepoint_client_secret"
                                type="password"
                                value={company.sharepoint_client_secret || ''}
                                onChange={handleChange}
                                className="form-input"
                                style={{ fontFamily: 'monospace', fontSize: '12px' }}
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="form-group">
                            <label>SharePoint Drive ID</label>
                            <input
                                name="sharepoint_drive_id"
                                value={company.sharepoint_drive_id || ''}
                                onChange={handleChange}
                                className="form-input"
                                style={{ fontFamily: 'monospace', fontSize: '12px' }}
                                placeholder="drive-id"
                            />
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', paddingBottom: '40px' }}>
                    <button
                        type="submit"
                        disabled={saving}
                        className="btn btn-primary"
                        style={{ padding: '12px 32px' }}
                    >
                        {saving ? (
                            <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderTopColor: 'white' }}></div>
                        ) : (
                            'Save All Settings'
                        )}
                    </button>
                </div>
            </form>
        </>
    );
}
