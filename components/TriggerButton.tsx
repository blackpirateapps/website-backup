'use client';

import { useState } from 'react';

export default function TriggerButton() {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleTrigger = async () => {
        setStatus('loading');
        setMessage('');

        try {
            const res = await fetch('/api/trigger', { method: 'POST' });
            const data = await res.json();

            if (res.ok) {
                setStatus('success');
                setMessage(data.message || 'Archive triggered successfully!');
            } else {
                setStatus('error');
                setMessage(data.error || 'Failed to trigger archive.');
            }
        } catch {
            setStatus('error');
            setMessage('Network error. Please try again.');
        }

        // Reset after 5 seconds
        setTimeout(() => {
            setStatus('idle');
            setMessage('');
        }, 5000);
    };

    return (
        <div className="trigger-container">
            <button
                className={`trigger-button ${status}`}
                onClick={handleTrigger}
                disabled={status === 'loading'}
            >
                {status === 'loading' && (
                    <span className="spinner" />
                )}
                {status === 'idle' && '📸 Archive Now'}
                {status === 'loading' && 'Triggering...'}
                {status === 'success' && '✓ Triggered!'}
                {status === 'error' && '✕ Failed'}
            </button>
            {message && (
                <p className={`trigger-message ${status}`}>{message}</p>
            )}
        </div>
    );
}
