import { NextResponse } from 'next/server';

export async function POST() {
    const PAT = process.env.GITHUB_PAT;
    const OWNER = 'blackpirateapps';
    const REPO = 'archive-storage';
    const WORKFLOW_ID = 'archive.yml';

    if (!PAT) {
        return NextResponse.json(
            { error: 'Server misconfigured: missing GITHUB_PAT' },
            { status: 500 }
        );
    }

    try {
        const response = await fetch(
            `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${PAT}`,
                    Accept: 'application/vnd.github.v3+json',
                },
                body: JSON.stringify({
                    ref: 'main',
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: `GitHub API error: ${response.status} ${errorText}` },
                { status: response.status }
            );
        }

        return NextResponse.json({ success: true, message: 'Archive workflow triggered!' });
    } catch (err) {
        return NextResponse.json(
            { error: `Failed to trigger workflow: ${(err as Error).message}` },
            { status: 500 }
        );
    }
}
