'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
    const { user, companyData, signIn, signInWithEmail, signUpWithEmail, loading } = useAuth();
    const router = useRouter();

    const [isSignup, setIsSignup] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [authLoading, setAuthLoading] = useState(false);

    useEffect(() => {
        if (!loading && user) {
            router.replace(companyData ? '/dashboard' : '/register');
        }
    }, [user, companyData, loading, router]);

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setAuthLoading(true);

        try {
            if (isSignup) {
                await signUpWithEmail(email, password);
            } else {
                await signInWithEmail(email, password);
            }
        } catch (err: any) {
            console.error('Auth error:', err);
            if (err.code === 'auth/email-already-in-use') {
                setError('This email is already in use.');
            } else if (err.code === 'auth/invalid-email') {
                setError('Invalid email address.');
            } else if (err.code === 'auth/weak-password') {
                setError('Password should be at least 6 characters.');
            } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setError('Invalid email or password.');
            } else if (err.code === 'auth/operation-not-allowed') {
                setError('Email/Password authentication is not enabled in the Firebase Console. Please enable it under Authentication > Sign-in method.');
            } else {
                setError('Authentication failed. Please try again.');
            }
        } finally {
            setAuthLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
                <h1>AI Recruiter</h1>
                <p>
                    The agentic AI recruitment platform that screens candidates, scores resumes,
                    and schedules interviews — automatically.
                </p>

                <form onSubmit={handleEmailAuth} className="card-glass" style={{ padding: '32px', borderRadius: 'var(--radius)', textAlign: 'left', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '20px', marginBottom: '24px', textAlign: 'center' }}>
                        {isSignup ? 'Create Account' : 'Welcome Back'}
                    </h2>

                    {error && (
                        <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', borderRadius: 'var(--radius-sm)', fontSize: '14px', marginBottom: '20px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label>Email Address</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="recruiter@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={authLoading}
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={authLoading}
                        />
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', height: '48px' }} disabled={authLoading}>
                        {authLoading ? (
                            <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></div>
                        ) : (
                            isSignup ? 'Sign Up' : 'Sign In'
                        )}
                    </button>

                    <p style={{ fontSize: '14px', marginTop: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        {isSignup ? 'Already have an account?' : 'Don\'t have an account?'}
                        {' '}
                        <button
                            type="button"
                            className="btn-ghost"
                            style={{ padding: 0, color: 'var(--accent-light)', height: 'auto', fontWeight: 600 }}
                            onClick={() => {
                                setIsSignup(!isSignup);
                                setError('');
                            }}
                        >
                            {isSignup ? 'Sign In' : 'Create One'}
                        </button>
                    </p>
                </form>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '24px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                    OR
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                </div>

                <button className="google-btn" onClick={signIn} disabled={authLoading}>
                    <svg width="20" height="20" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                </button>

                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '24px' }}>
                    For company recruiters and hiring managers
                </p>
            </div>
        </div>
    );
}
