'use client';

import { useEffect, useState, useCallback } from 'react';

interface WorkflowStatus {
    status: string;
    conclusion: string | null;
    started_at: string | null;
    updated_at: string | null;
    html_url: string | null;
    current_step: string;
    completed_steps: number;
    total_steps: number;
}

export default function WorkflowStatus() {
    const [data, setData] = useState<WorkflowStatus | null>(null);
    const [polling, setPolling] = useState(false);

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/status');
            if (!res.ok) return;
            const json: WorkflowStatus = await res.json();
            setData(json);

            // Auto-poll when a workflow is active
            const isActive = json.status === 'queued' || json.status === 'in_progress';
            setPolling(isActive);
        } catch {
            // silently fail
        }
    }, []);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    useEffect(() => {
        if (!polling) return;
        const interval = setInterval(fetchStatus, 5000);
        return () => clearInterval(interval);
    }, [polling, fetchStatus]);

    if (!data || data.status === 'none' || data.status === 'unknown') return null;

    const isActive = data.status === 'queued' || data.status === 'in_progress';
    const isSuccess = data.status === 'completed' && data.conclusion === 'success';
    const isFailed = data.status === 'completed' && data.conclusion === 'failure';

    // Don't show completed runs older than 5 minutes
    if (data.status === 'completed' && data.updated_at) {
        const age = Date.now() - new Date(data.updated_at).getTime();
        if (age > 5 * 60 * 1000) return null;
    }

    const progressPercent =
        data.total_steps > 0
            ? Math.round((data.completed_steps / data.total_steps) * 100)
            : 0;

    const elapsed = data.started_at
        ? formatElapsed(new Date(data.started_at))
        : '';

    return (
        <div className={`workflow-status ${isActive ? 'active' : ''} ${isSuccess ? 'success' : ''} ${isFailed ? 'failed' : ''}`}>
            <div className="status-header">
                <div className="status-indicator">
                    {isActive && <span className="status-dot pulsing" />}
                    {isSuccess && <span className="status-icon">✓</span>}
                    {isFailed && <span className="status-icon error">✕</span>}
                    <span className="status-label">
                        {data.status === 'queued' && 'Queued'}
                        {data.status === 'in_progress' && 'Archiving in progress'}
                        {isSuccess && 'Archive complete'}
                        {isFailed && 'Archive failed'}
                    </span>
                </div>
                {elapsed && <span className="status-elapsed">{elapsed}</span>}
            </div>

            {isActive && data.total_steps > 0 && (
                <div className="status-progress">
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <div className="progress-details">
                        {data.current_step && (
                            <span className="current-step">{data.current_step}</span>
                        )}
                        <span className="step-count">
                            {data.completed_steps}/{data.total_steps} steps
                        </span>
                    </div>
                </div>
            )}

            {data.html_url && (
                <a
                    href={data.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="status-link"
                >
                    View on GitHub →
                </a>
            )}
        </div>
    );
}

function formatElapsed(start: Date): string {
    const seconds = Math.floor((Date.now() - start.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
}
