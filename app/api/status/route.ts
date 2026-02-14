import { NextResponse } from 'next/server';

const OWNER = 'blackpirateapps';
const REPO = 'archive-storage';
const WORKFLOW_FILE = 'archive.yml';

export async function GET() {
    const PAT = process.env.GITHUB_PAT;

    if (!PAT) {
        return NextResponse.json(
            { status: 'unknown', message: 'Server misconfigured' },
            { status: 500 }
        );
    }

    try {
        // Get the most recent workflow run
        const res = await fetch(
            `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=1`,
            {
                headers: {
                    Authorization: `Bearer ${PAT}`,
                    Accept: 'application/vnd.github.v3+json',
                },
                cache: 'no-store',
            }
        );

        if (!res.ok) {
            return NextResponse.json(
                { status: 'unknown', message: `GitHub API error: ${res.status}` },
                { status: res.status }
            );
        }

        const data = await res.json();

        if (!data.workflow_runs || data.workflow_runs.length === 0) {
            return NextResponse.json({ status: 'none', message: 'No workflow runs found' });
        }

        const run = data.workflow_runs[0];

        // Get job details for step-level progress
        let currentStep = '';
        let completedSteps = 0;
        let totalSteps = 0;

        if (run.status !== 'completed') {
            const jobsRes = await fetch(run.jobs_url, {
                headers: {
                    Authorization: `Bearer ${PAT}`,
                    Accept: 'application/vnd.github.v3+json',
                },
                cache: 'no-store',
            });

            if (jobsRes.ok) {
                const jobsData = await jobsRes.json();
                if (jobsData.jobs && jobsData.jobs.length > 0) {
                    const job = jobsData.jobs[0];
                    totalSteps = job.steps?.length || 0;
                    completedSteps = job.steps?.filter(
                        (s: { status: string }) => s.status === 'completed'
                    ).length || 0;
                    const inProgress = job.steps?.find(
                        (s: { status: string }) => s.status === 'in_progress'
                    );
                    currentStep = inProgress?.name || '';
                }
            }
        }

        return NextResponse.json({
            status: run.status,           // queued | in_progress | completed
            conclusion: run.conclusion,   // success | failure | null
            started_at: run.run_started_at,
            updated_at: run.updated_at,
            html_url: run.html_url,
            current_step: currentStep,
            completed_steps: completedSteps,
            total_steps: totalSteps,
        });
    } catch (err) {
        return NextResponse.json(
            { status: 'unknown', message: (err as Error).message },
            { status: 500 }
        );
    }
}
