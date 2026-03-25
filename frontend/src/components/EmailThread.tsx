'use client';

import { useState, useCallback, useEffect } from 'react';
import { api } from '@/lib/api';

export default function EmailThread({ appId, candidateName }: { appId: string; candidateName: string }) {
    const [emails, setEmails] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [replyToConversationId, setReplyToConversationId] = useState<string | null>(null);
    const [showCompose, setShowCompose] = useState(false);
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const loadEmails = useCallback(async () => {
        try {
            const data = await api.getApplicationEmails(appId);
            const loadedEmails = data.emails || [];
            setEmails(loadedEmails);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [appId]);

    useEffect(() => { loadEmails(); }, [loadEmails]);

    const normalizeSubject = (s: string) => (s || '').replace(/^(Re:\s*)+/i, '').trim();

    const handleSend = async (isNewThread: boolean, groupEmails?: any[]) => {
        const text = body.trim();
        if (!text) return;
        if (isNewThread && !subject.trim()) return;

        setSending(true);
        try {
            let parent_message_id = null;
            if (!isNewThread && groupEmails) {
                // Find latest email in THIS specific group
                const latestInThread = [...groupEmails].reverse().find(e => e.message_id || e.conversation_id);
                parent_message_id = latestInThread?.message_id || latestInThread?.conversation_id;

                if (!parent_message_id) {
                    alert("Could not find a message ID to reply to in this thread.");
                    setSending(false);
                    return;
                }
            }

            await api.sendApplicationEmail(
                appId,
                isNewThread ? subject : '',
                `<p>${text.replace(/\n/g, '<br/>')}</p>`,
                parent_message_id || undefined
            );

            setSubject('');
            setBody('');
            setShowCompose(false);
            setReplyToConversationId(null);
            await loadEmails();
        } catch (e: any) {
            console.error(e);
            alert(e.message || 'Failed to send email');
        } finally {
            setSending(false);
        }
    };

    const handleSync = async () => {
        setLoading(true);
        try {
            await api.pollInbox();
            await loadEmails();
        } catch (e) {
            console.error(e);
            alert('Sync failed');
        } finally {
            setLoading(false);
        }
    };

    const toggleGroup = (key: string) => {
        const next = new Set(expandedGroups);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setExpandedGroups(next);
    };

    if (loading) return <div className="email-thread-loading">Loading emails...</div>;

    // Group emails by normalized subject to merge "Re:" threads
    const groups = emails.reduce((acc: any, e: any) => {
        const key = normalizeSubject(e.subject).toLowerCase() || 'no-subject';
        if (!acc[key]) acc[key] = [];
        acc[key].push(e);
        return acc;
    }, {});

    const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
        // Sort by LATEST message in group instead of oldest
        const aLatest = [...groups[a]].sort((x, y) => new Date(y.sent_at).getTime() - new Date(x.sent_at).getTime())[0];
        const bLatest = [...groups[b]].sort((x, y) => new Date(y.sent_at).getTime() - new Date(x.sent_at).getTime())[0];
        const aDate = new Date(aLatest?.sent_at || 0).getTime();
        const bDate = new Date(bLatest?.sent_at || 0).getTime();
        return bDate - aDate;
    });

    return (
        <div className="email-thread">
            <div className="email-thread-header">
                <h4>📧 Conversations with {candidateName}</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {emails.length > 0 && (
                        <button className="btn btn-sm btn-secondary" onClick={handleSync} disabled={loading || sending}>
                            🔄 Sync
                        </button>
                    )}
                    <button className="btn btn-sm btn-primary" onClick={() => {
                        setShowCompose(!showCompose);
                        setReplyToConversationId(null);
                        setBody('');
                        setSubject('');
                    }}>
                        {showCompose ? '✕ Cancel' : '✏️ New Thread'}
                    </button>
                </div>
            </div>

            {/* New Thread Compose Form */}
            {showCompose && (
                <div className="email-compose" style={{ border: '1px solid var(--border-primary)', padding: '16px', borderRadius: '8px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)' }}>
                    <h5 style={{ marginTop: 0, marginBottom: '16px' }}>Start New Conversation</h5>
                    <input
                        type="text"
                        placeholder="Subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="email-compose-subject"
                        autoFocus
                    />
                    <textarea
                        placeholder="Type your message..."
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={4}
                        className="email-compose-body"
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => setShowCompose(false)}>Cancel</button>
                        <button className="btn btn-sm btn-primary" onClick={() => handleSend(true)} disabled={sending}>
                            {sending ? '⏳ Sending...' : '📤 Send Email'}
                        </button>
                    </div>
                </div>
            )}

            {/* Email Groups */}
            {emails.length === 0 ? (
                <div className="email-empty">No conversations yet. Click "New Thread" to start.</div>
            ) : (
                <div className="email-messages">
                    {sortedGroupKeys.map((key: string) => {
                        const group = groups[key];
                        // Sort group messages chronologically for display
                        const sortedGroup = [...group].sort((a: any, b: any) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());
                        const latestMsg = sortedGroup[sortedGroup.length - 1];
                        const threadSubject = normalizeSubject(latestMsg?.subject || '(No Subject)');
                        const isReplyingThis = replyToConversationId === key;
                        const isExpanded = expandedGroups.has(key) || isReplyingThis;

                        return (
                            <div key={key} className="conversation-group" style={{
                                border: '1px solid rgba(255,255,255,0.1)',
                                marginBottom: '12px',
                                background: 'rgba(255,255,255,0.01)',
                                borderRadius: '8px',
                                overflow: 'hidden'
                            }}>
                                {/* Clickable Header */}
                                <div
                                    onClick={() => toggleGroup(key)}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '12px 16px',
                                        cursor: 'pointer',
                                        background: isExpanded ? 'rgba(255,255,255,0.03)' : 'transparent',
                                        transition: 'background 0.2s'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontSize: '12px', opacity: 0.5 }}>
                                            {isExpanded ? '▼' : '▶'}
                                        </span>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <h5 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {threadSubject}
                                                <span style={{ fontSize: '11px', opacity: 0.4, fontWeight: 'normal' }}>
                                                    ({group.length} {group.length === 1 ? 'message' : 'messages'})
                                                </span>
                                            </h5>
                                            <span style={{ fontSize: '10px', opacity: 0.4, marginTop: '2px' }}>
                                                Last Activity: {new Date(latestMsg.sent_at).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        className="btn btn-xs btn-outline"
                                        style={{ fontSize: '11px', height: '24px', padding: '0 8px' }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (isReplyingThis) {
                                                setReplyToConversationId(null);
                                            } else {
                                                setReplyToConversationId(key);
                                                setShowCompose(false);
                                                setBody('');
                                            }
                                        }}
                                    >
                                        {isReplyingThis ? '✕ Cancel' : '↩️ Reply'}
                                    </button>
                                </div>

                                {isExpanded && (
                                    <div style={{ padding: '0 16px 16px 16px' }}>
                                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                                            {sortedGroup.map((e: any) => (
                                                <div key={e.id} className={`email-message ${e.direction === 'INBOUND' ? 'inbound' : 'outbound'}`} style={{ marginBottom: '16px' }}>
                                                    <div className="email-message-header">
                                                        <div className="email-message-meta">
                                                            <span className={`email-direction ${e.direction === 'INBOUND' ? 'inbound' : 'outbound'}`}>
                                                                {e.direction === 'INBOUND' ? '📥 Candidate' : '📤 Company'}
                                                            </span>
                                                            {e.ai_generated && <span className="email-ai-badge">🤖 AI</span>}
                                                            <span className="email-time">
                                                                {e.sent_at ? new Date(e.sent_at).toLocaleString() : ''}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div
                                                        className="email-message-body"
                                                        dangerouslySetInnerHTML={{ __html: e.body }}
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        {isReplyingThis && (
                                            <div className="email-compose" style={{ marginTop: '16px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid var(--accent-primary)' }}>
                                                <textarea
                                                    placeholder={`Reply to: ${threadSubject}`}
                                                    value={body}
                                                    onChange={(e) => setBody(e.target.value)}
                                                    rows={3}
                                                    className="email-compose-body"
                                                    autoFocus
                                                />
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                                                    <button className="btn btn-sm btn-ghost" onClick={() => setReplyToConversationId(null)}>Cancel</button>
                                                    <button className="btn btn-sm btn-primary" onClick={() => handleSend(false, sortedGroup)} disabled={sending}>
                                                        {sending ? '⏳ Sending...' : '📤 Send Reply'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
