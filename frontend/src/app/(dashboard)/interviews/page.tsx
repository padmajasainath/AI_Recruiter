'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import {
    FileText, ExternalLink, MessageSquare,
    MapPin, Calendar, Clock, Award, AlertCircle,
    ChevronDown, ChevronUp
} from 'lucide-react';

export default function InterviewsPage() {
    const [interviews, setInterviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    useEffect(() => {
        api.listInterviews()
            .then(d => setInterviews(d.interviews || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

    const statusBadge = (s: string) => {
        const map: Record<string, string> = {
            PENDING: 'badge-applied',
            LINK_SENT: 'badge-applied',
            IN_PROGRESS: 'badge-screening',
            COMPLETED: 'badge-hired',
            EXPIRED: 'badge-rejected',
            CANCELLED: 'badge-rejected',
        };
        return map[s] || '';
    };

    const toggleExpand = (id: string) => {
        setExpandedRow(expandedRow === id ? null : id);
    };

    return (
        <>
            <div className="page-header">
                <div>
                    <h1>AI Live Interviews</h1>
                    <p>Monitor and review real-time AI voice interview sessions</p>
                </div>
            </div>

            {interviews.length === 0 ? (
                <div className="empty-state">
                    <div className="icon">🎙️</div>
                    <h3>No interviews yet</h3>
                    <p>Interviews will appear here once candidates are shortlisted through the AI screening pipeline.</p>
                </div>
            ) : (
                <div className="table-container">
                    <table className="w-full text-left">
                        <thead>
                            <tr>
                                <th className="py-4 px-6 text-sm font-semibold text-slate-400 uppercase tracking-wider">Candidate</th>
                                <th className="py-4 px-6 text-sm font-semibold text-slate-400 uppercase tracking-wider">Job Role</th>
                                <th className="py-4 px-6 text-sm font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="py-4 px-6 text-sm font-semibold text-slate-400 uppercase tracking-wider">Exp. / Score</th>
                                <th className="py-4 px-6 text-sm font-semibold text-slate-400 uppercase tracking-wider">Interviewed At</th>
                                <th className="py-4 px-6 text-sm font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {interviews.map(iv => (
                                <React.Fragment key={iv.id}>
                                    <tr className={`transition ${expandedRow === iv.id ? 'bg-slate-800/30' : 'hover:bg-slate-800/20'}`}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Link
                                                href={`/jobs/${iv.application?.job?.id}/applications/${iv.application?.id}`}
                                                className="flex flex-col hover:opacity-80 transition-opacity group"
                                            >
                                                <span className="font-bold text-slate-200 group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{iv.application?.candidate_name || 'Unknown'}</span>
                                                <span className="text-[10px] text-slate-400 font-medium">{iv.application?.candidate_email}</span>
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Link
                                                href={`/jobs/${iv.application?.job?.id}`}
                                                className="flex flex-col hover:opacity-80 transition-opacity"
                                            >
                                                <span className="text-sm font-bold text-slate-300 hover:text-indigo-400 transition-colors">
                                                    {iv.application?.job?.title || '—'}
                                                </span>
                                                {iv.application?.job?.job_id && (
                                                    <span className="text-[10px] text-slate-500 font-mono">
                                                        {iv.application.job.job_id}
                                                    </span>
                                                )}
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`badge ${statusBadge(iv.status)}`}>
                                                {iv.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                {iv.interview_score !== null ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <Award className="w-4 h-4 text-blue-600" />
                                                        <span className="font-bold text-lg text-blue-600">{iv.interview_score}</span>
                                                        <span className="text-gray-400 text-xs">/100</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-300 italic text-sm">Waiting...</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {iv.started_at ? (
                                                <div className="flex flex-col">
                                                    <span>{new Date(iv.started_at).toLocaleDateString()}</span>
                                                    <span className="text-[10px] uppercase font-bold text-gray-400">{new Date(iv.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            ) : iv.completed_at ? (
                                                <div className="flex flex-col">
                                                    <span>{new Date(iv.completed_at).toLocaleDateString()}</span>
                                                    <span className="text-[10px] uppercase font-bold text-gray-400">{new Date(iv.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-300 italic">Not started</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => toggleExpand(iv.id)}
                                                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 ml-auto font-semibold"
                                            >
                                                {expandedRow === iv.id ? 'Hide Details' : 'View Analysis'}
                                                {expandedRow === iv.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </button>
                                        </td>
                                    </tr>
                                    {expandedRow === iv.id && (
                                        <tr>
                                            <td colSpan={6} style={{ padding: 0, borderBottom: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                                <div style={{ backgroundColor: '#0a0e1a', padding: '32px 48px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                                        {/* Header Card */}
                                                        <div style={{ backgroundColor: '#1a1f36', borderRadius: '40px', padding: '32px', border: '1px solid #2a3050', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
                                                            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '32px' }}>
                                                                <div>
                                                                    <h3 style={{ fontSize: '30px', fontWeight: 900, color: 'white', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                                                                        Interview Analysis
                                                                    </h3>
                                                                    <p style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                                                                        {iv.application?.candidate_name} • {iv.application?.job?.title}
                                                                    </p>
                                                                </div>

                                                                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                                                                    <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '16px 24px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                                        <p style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Score</p>
                                                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                                                            <span style={{ fontSize: '30px', fontWeight: 900, lineHeight: 1, color: iv.interview_score && iv.interview_score >= 70 ? '#10b981' : '#f59e0b' }}>
                                                                                {iv.interview_score ?? '--'}
                                                                            </span>
                                                                            <span style={{ color: '#64748b', fontWeight: 700, fontSize: '12px' }}>/100</span>
                                                                        </div>
                                                                    </div>

                                                                    <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '16px 24px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                                        <p style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Duration</p>
                                                                        <p style={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>
                                                                            {iv.interview_duration_minutes ?? '--'} <span style={{ fontSize: '12px', color: '#94a3b8' }}>minutes</span>
                                                                        </p>
                                                                    </div>

                                                                    <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '16px 24px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                                        <p style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Status</p>
                                                                        <p style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '12px', color: iv.interview_score && iv.interview_score >= 70 ? '#10b981' : '#f59e0b' }}>
                                                                            {iv.interview_score && iv.interview_score >= 70 ? 'Recommended' : 'Needs Review'}
                                                                        </p>
                                                                    </div>

                                                                    {iv.recording_web_url && (
                                                                        <a
                                                                            href={iv.recording_web_url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            style={{
                                                                                backgroundColor: 'rgba(79, 70, 229, 0.15)',
                                                                                borderRadius: '16px',
                                                                                padding: '16px 24px',
                                                                                border: '1px solid rgba(79, 70, 229, 0.3)',
                                                                                display: 'flex',
                                                                                flexDirection: 'column',
                                                                                gap: '8px',
                                                                                transition: 'all 0.2s',
                                                                                cursor: 'pointer',
                                                                                textDecoration: 'none'
                                                                            }}
                                                                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(79, 70, 229, 0.25)'}
                                                                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(79, 70, 229, 0.15)'}
                                                                        >
                                                                            <p style={{ fontSize: '10px', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Recording</p>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                <span style={{ color: 'white', fontWeight: 700, fontSize: '14px' }}>Watch Session</span>
                                                                                <ExternalLink className="w-4 h-4 text-[#818cf8]" />
                                                                            </div>
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Content Grid */}
                                                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
                                                            {/* Left Column: Insights */}
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                                                {/* Summary */}
                                                                <div style={{ backgroundColor: '#1a1f36', borderRadius: '40px', padding: '32px', border: '1px solid #2a3050', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
                                                                    <h4 style={{ fontSize: '12px', fontWeight: 900, color: 'white', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '20px' }}>Executive Summary</h4>
                                                                    <p style={{ color: '#cbd5e1', lineHeight: 1.6, fontSize: '16px', fontWeight: 500 }}>
                                                                        {iv.ai_summary || "Session analysis is being generated... usually takes 30-60 seconds after completion."}
                                                                    </p>
                                                                </div>

                                                                {/* Strengths & Weaknesses */}
                                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                                                                    <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: '40px', padding: '32px', border: '1px solid rgba(16, 185, 129, 0.2)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                                                                            <div style={{ width: '32px', height: '32px', backgroundColor: 'rgba(16, 185, 129, 0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                                                                <span style={{ fontSize: '12px', color: '#6ee7b7', fontWeight: 700 }}>✓</span>
                                                                            </div>
                                                                            <h4 style={{ fontSize: '12px', fontWeight: 900, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Strengths</h4>
                                                                        </div>
                                                                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                                            {(Array.isArray(iv.ai_strengths) ? iv.ai_strengths : (iv.ai_strengths ? [iv.ai_strengths] : [])).map((s: string, idx: number) => (
                                                                                <li key={idx} style={{ display: 'flex', gap: '12px', fontSize: '14px', color: '#cbd5e1', lineHeight: 1.4 }}>
                                                                                    <div style={{ width: '6px', height: '6px', backgroundColor: '#6ee7b7', borderRadius: '50%', marginTop: '8px', flexShrink: 0 }} />
                                                                                    {s}
                                                                                </li>
                                                                            ))}
                                                                            {(!iv.ai_strengths || iv.ai_strengths.length === 0) && <li style={{ color: '#64748b', fontStyle: 'italic', fontSize: '14px' }}>No specific strengths captured.</li>}
                                                                        </ul>
                                                                    </div>

                                                                    <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.05)', borderRadius: '40px', padding: '32px', border: '1px solid rgba(245, 158, 11, 0.2)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                                                                            <div style={{ width: '32px', height: '32px', backgroundColor: 'rgba(245, 158, 11, 0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                                                                <span style={{ fontSize: '12px', color: '#fcd34d', fontWeight: 700 }}>!</span>
                                                                            </div>
                                                                            <h4 style={{ fontSize: '12px', fontWeight: 900, color: '#fcd34d', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Growth Areas</h4>
                                                                        </div>
                                                                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                                            {(Array.isArray(iv.ai_weaknesses) ? iv.ai_weaknesses : (iv.ai_weaknesses ? [iv.ai_weaknesses] : [])).map((w: string, idx: number) => (
                                                                                <li key={idx} style={{ display: 'flex', gap: '12px', fontSize: '14px', color: '#cbd5e1', lineHeight: 1.4 }}>
                                                                                    <div style={{ width: '6px', height: '6px', backgroundColor: '#fcd34d', borderRadius: '50%', marginTop: '8px', flexShrink: 0 }} />
                                                                                    {w}
                                                                                </li>
                                                                            ))}
                                                                            {(!iv.ai_weaknesses || iv.ai_weaknesses.length === 0) && <li style={{ color: '#64748b', fontStyle: 'italic', fontSize: '14px' }}>No critical areas identified.</li>}
                                                                        </ul>
                                                                    </div>
                                                                </div>
                                                            </div>


                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}
