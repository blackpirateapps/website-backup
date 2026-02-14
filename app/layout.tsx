import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Website Archive — blackpiratex.com',
  description: 'Manual website archiving system for blackpiratex.com. View and create snapshots of the live site.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
