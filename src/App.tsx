import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { AuthPage } from '@/components/auth/AuthPage';
import { AppShell } from '@/components/app/AppShell';
import { FullPageSpinner } from '@/components/ui/Spinner';

// Lazy load pages for better performance
const FarmerDashboard = lazy(() => import('@/pages/farmer/Dashboard'));
const FarmPage = lazy(() => import('@/pages/farmer/FarmPage'));
const ClustersPage = lazy(() => import('@/pages/farmer/ClustersPage'));
const BulkBuyingPage = lazy(() => import('@/pages/farmer/BulkBuyingPage'));
const MachineryPage = lazy(() => import('@/pages/farmer/MachineryPage'));
const HarvestPage = lazy(() => import('@/pages/farmer/HarvestPage'));
const MarketplacePage = lazy(() => import('@/pages/marketplace/MarketplacePage'));
const AIAssistantPage = lazy(() => import('@/pages/ai/AIAssistantPage'));
const CropDiseasePage = lazy(() => import('@/pages/ai/CropDiseasePage'));
const WeatherPage = lazy(() => import('@/pages/farmer/WeatherPage'));
const MarketPricesPage = lazy(() => import('@/pages/farmer/MarketPricesPage'));
const FarmRecordsPage = lazy(() => import('@/pages/farmer/FarmRecordsPage'));
const GroupChatPage = lazy(() => import('@/pages/farmer/GroupChatPage'));
const CollectionCentersPage = lazy(() => import('@/pages/farmer/CollectionCentersPage'));
const QualityPage = lazy(() => import('@/pages/farmer/QualityPage'));
const RewardsPage = lazy(() => import('@/pages/farmer/RewardsPage'));
const NotificationsPage = lazy(() => import('@/pages/common/NotificationsPage'));
const ProfilePage = lazy(() => import('@/pages/common/ProfilePage'));
const HelpPage = lazy(() => import('@/pages/common/HelpPage'));
const ChampionDashboard = lazy(() => import('@/pages/champion/ChampionDashboard'));
const BuyerDashboard = lazy(() => import('@/pages/buyer/BuyerDashboard'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
function getPage(key: string, role: string) {
  // Role-specific dashboards
  if (key === 'dashboard') {
    if (role === 'admin') return <AdminDashboard />;
    if (role === 'champion') return <ChampionDashboard />;
    if (role === 'buyer') return <BuyerDashboard />;
    return <FarmerDashboard />;
  }
  const map: Record<string, React.ReactNode> = {
    farm: <FarmPage />,
    clusters: <ClustersPage />,
    bulkBuying: <BulkBuyingPage />,
    machinery: <MachineryPage />,
    harvest: <HarvestPage />,
    marketplace: <MarketplacePage />,
    aiAssistant: <AIAssistantPage />,
    cropDisease: <CropDiseasePage />,
    weather: <WeatherPage />,
    marketPrices: <MarketPricesPage />,
    farmRecords: <FarmRecordsPage />,
    groupChat: <GroupChatPage />,
    collectionCenters: <CollectionCentersPage />,
    quality: <QualityPage />,
    rewards: <RewardsPage />,
    notifications: <NotificationsPage />,
    profile: <ProfilePage />,
    help: <HelpPage />,
  };
  return map[key] ?? <FarmerDashboard />;
}

function hashToKey(): string {
  const h = window.location.hash.replace('#/', '').replace('#', '');
  return h || 'dashboard';
}

function AppContent() {
  const { session, profile, loading, signOut } = useAuth();
  const [activeKey, setActiveKey] = useState(hashToKey());
  const [profileTimeout, setProfileTimeout] = useState(false);

  useEffect(() => {
    const onHash = () => setActiveKey(hashToKey());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (session && !profile && !loading) {
      const timer = setTimeout(() => setProfileTimeout(true), 10000);
      return () => clearTimeout(timer);
    }
    setProfileTimeout(false);
  }, [session, profile, loading]);

  const navigate = (key: string) => {
    window.location.hash = `/${key}`;
    setActiveKey(key);
  };

  if (loading) return <FullPageSpinner message="Loading..." />;

  if (!session) {
    const isSignup = window.location.hash.includes('signup');
    return <AuthPage mode={isSignup ? 'signup' : 'login'} />;
  }

  if (!profile) {
    if (profileTimeout) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-stone-50">
          <p className="text-stone-600 text-sm">Something went wrong loading your profile.</p>
          <button onClick={() => signOut()} className="btn-primary">Sign out and try again</button>
        </div>
      );
    }
    return <FullPageSpinner message="Setting up your profile..." />;
  }

  return (
    <AppShell activeKey={activeKey} onNavigate={navigate}>
      <Suspense fallback={<FullPageSpinner message="Loading page..." />}>
        {getPage(activeKey, profile.active_role || profile.role)}
      </Suspense>
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
