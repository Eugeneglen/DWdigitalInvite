'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';

const GuestSite = dynamic(() => import('@/components/wedding/GuestSite'), {
  ssr: false,
  loading: () => <div className="loading-state">Loading...</div>,
});

const CoupleCMSView = dynamic(
  () => import('@/components/cms/CoupleCMSView'),
  { ssr: false, loading: () => <div className="loading-state">Loading...</div> },
);

const AdminCMSView = dynamic(
  () => import('@/components/cms/AdminCMSView'),
  { ssr: false, loading: () => <div className="loading-state">Loading...</div> },
);

const ChangePasswordModal = dynamic(
  () => import('@/components/cms/ChangePasswordModal').then((m) => ({ default: m.ChangePasswordModal })),
  { ssr: false },
);

/**
 * Renders the appropriate top-level view based on the `?view=` query param.
 * If the user's mustChangePassword flag is true, shows the Change Password
 * modal before rendering any CMS content.
 */
export function PageContent({ view }: { view: string | null }) {
  const { data: session, update } = useSession();
  const [passwordChanged, setPasswordChanged] = useState(false);

  const handlePasswordChanged = useCallback(async () => {
    setPasswordChanged(true);
    // Refresh the session so mustChangePassword is cleared
    await update();
  }, [update]);

  // Only check mustChangePassword for CMS views (admin/couple), NOT the guest site.
  // Guests don't have accounts and should never see a password change prompt.
  const mustChangePassword = (view === 'couple' || view === 'cms')
    && session?.user?.mustChangePassword === true
    && !passwordChanged;

  if (mustChangePassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper-cream">
        <ChangePasswordModal open={true} onSuccess={handlePasswordChanged} />
      </div>
    );
  }

  if (view === 'couple') {
    return <CoupleCMSView />;
  }

  if (view === 'cms') {
    return <AdminCMSView />;
  }

  // Default → Wedding site (guest-facing)
  return <GuestSite />;
}