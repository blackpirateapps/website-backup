import TriggerButton from '@/components/TriggerButton';
import ArchiveList from '@/components/ArchiveList';
import WorkflowStatus from '@/components/WorkflowStatus';

export default function Home() {
  return (
    <div className="page-wrapper">
      <header className="header">
        <div className="header-inner">
          <div>
            <h1>
              <span className="dot" />
              Website Archive
            </h1>
            <p>Manual snapshots of the live site</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span className="site-url">blackpiratex.com</span>
            <TriggerButton />
          </div>
        </div>
      </header>

      <main>
        <h2 className="section-title">Snapshots</h2>
        <WorkflowStatus />
        <ArchiveList />
      </main>

      <footer className="footer">
        Powered by{' '}
        <a
          href="https://github.com/blackpirateapps/archive-storage"
          target="_blank"
          rel="noopener noreferrer"
        >
          archive-storage
        </a>{' '}
        · GitHub Pages + Vercel
      </footer>
    </div>
  );
}
