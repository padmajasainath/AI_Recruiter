'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/jobs', label: 'Job Postings', icon: '💼' },
    { href: '/interviews', label: 'Interviews', icon: '🎙️' },
    { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user, companyData, loading, signOut } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!loading && !user) {
            router.replace('/login');
        }
    }, [user, loading, router]);

    if (loading || !user) {
        return <div className="loading-spinner"><div className="spinner" /></div>;
    }

    return (
        <div className="app-layout">
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <div className="logo-icon">🤖</div>
                    <h2>AI Recruiter</h2>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map(item => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`nav-item ${pathname === item.href ? 'active' : ''}`}
                        >
                            <span>{item.icon}</span>
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px' }}>
                    <div style={{ padding: '8px 14px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        {companyData?.company?.name || 'Company'}
                    </div>
                    <div style={{ padding: '4px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {user.email}
                    </div>
                    <button
                        className="nav-item"
                        onClick={signOut}
                        style={{ marginTop: '8px', color: 'var(--error)' }}
                    >
                        🚪 Sign Out
                    </button>
                </div>
            </aside>

            <main className="main-content">
                {children}
            </main>
        </div>
    );
}
