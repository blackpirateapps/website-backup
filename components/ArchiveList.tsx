'use client';

import { useEffect, useState } from 'react';

interface Archive {
    id: string;
    date: string;
    screenshot: string;
    url: string;
    size_mb: number;
}

interface ArchiveIndex {
    archives: Archive[];
}

const INDEX_URL =
    'https://blackpirateapps.github.io/archive-storage/index.json';

export default function ArchiveList() {
    const [archives, setArchives] = useState<Archive[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchArchives();
    }, []);

    const fetchArchives = async () => {
        try {
            const res = await fetch(INDEX_URL, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: ArchiveIndex = await res.json();
            setArchives(data.archives || []);
        } catch {
            setError('Could not load archives. The storage repo may not have any snapshots yet.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="archive-loading">
                <div className="loading-pulse" />
                <p>Loading archives...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="archive-empty">
                <p className="empty-icon">📂</p>
                <p>{error}</p>
            </div>
        );
    }

    if (archives.length === 0) {
        return (
            <div className="archive-empty">
                <p className="empty-icon">📂</p>
                <p>No archives yet. Click &quot;Archive Now&quot; to create your first snapshot!</p>
            </div>
        );
    }

    return (
        <div className="archive-grid">
            {archives.map((archive) => (
                <a
                    key={archive.id}
                    href={archive.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="archive-card"
                >
                    <div className="card-image">
                        <img
                            src={archive.screenshot}
                            alt={`Snapshot from ${archive.date}`}
                            loading="lazy"
                        />
                        <div className="card-overlay">
                            <span>View Archive →</span>
                        </div>
                    </div>
                    <div className="card-info">
                        <time dateTime={archive.date}>
                            {new Date(archive.date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </time>
                        {archive.size_mb && (
                            <span className="card-size">{archive.size_mb} MB</span>
                        )}
                    </div>
                </a>
            ))}
        </div>
    );
}
