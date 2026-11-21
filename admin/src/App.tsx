import type { ReactNode } from 'react';
import { Layout, NAV } from './components/Layout';
import { Empty, Spinner, ToastProvider } from './components/ui';
import { AuthProvider, useAuth } from './lib/auth';
import { match, RouterProvider, useLocation } from './lib/router';
import type { Permission } from './lib/types';
import Accounts from './pages/Accounts';
import { LoginPage, TwoFactorGate } from './pages/Auth';
import ClientDetail from './pages/ClientDetail';
import Clients from './pages/Clients';
import Dashboard from './pages/Dashboard';
import Funded from './pages/Funded';
import { KycQueue, KycReview } from './pages/Kyc';
import { TransactionDetail, Transactions } from './pages/Money';
import { PostEditor, Posts } from './pages/Posts';
import { Audit, Profile, System } from './pages/Settings';
import { Messages, Tickets, TicketThread } from './pages/Support';

type Route = [pattern: string, perm: Permission | null, render: (p: Record<string, string>) => ReactNode];

const ROUTES: Route[] = [
  ['/', 'users.read', () => <Dashboard />],
  ['/clients', 'users.read', () => <Clients />],
  ['/clients/:id', 'users.read', (p) => <ClientDetail key={p.id} id={p.id} />],
  ['/kyc', 'kyc', () => <KycQueue />],
  ['/kyc/:id', 'kyc', (p) => <KycReview key={p.id} id={p.id} />],
  ['/transactions', 'finance', () => <Transactions />],
  ['/transactions/:id', 'finance', (p) => <TransactionDetail key={p.id} id={p.id} />],
  ['/accounts', 'finance', () => <Accounts />],
  ['/challenges', 'finance', () => <Funded />],
  ['/challenges/:id', 'finance', (p) => <Funded openId={p.id} />],
  ['/tickets', 'support', () => <Tickets />],
  ['/tickets/:id', 'support', (p) => <TicketThread key={p.id} id={p.id} />],
  ['/messages', 'support', () => <Messages />],
  ['/messages/:id', 'support', (p) => <Messages openId={p.id} />],
  ['/posts', 'content', () => <Posts />],
  ['/posts/new', 'content', () => <PostEditor />],
  ['/posts/:id', 'content', (p) => <PostEditor key={p.id} id={p.id} />],
  ['/audit', 'audit', () => <Audit />],
  ['/system', 'system', () => <System />],
  ['/profile', null, () => <Profile />],
];

function Routes() {
  const { path } = useLocation();
  const { can } = useAuth();
  for (const [pattern, perm, render] of ROUTES) {
    const params = match(pattern, path);
    if (!params) continue;
    if (perm && !can(perm)) {
      const first = NAV.find((n) => can(n.perm));
      return (
        <Empty title="Not available for your role">
          {first ? (
            <a className="text-bolt underline" href={`#${first.to}`}>
              Go to {first.label}
            </a>
          ) : (
            'Ask an administrator for access.'
          )}
        </Empty>
      );
    }
    return <>{render(params)}</>;
  }
  return <Empty title="Page not found">Use the menu to find what you need.</Empty>;
}

function Gate() {
  const { stage } = useAuth();
  if (stage === 'loading') return <Spinner label="Checking your session" />;
  if (stage === 'signed-out' || stage === 'mfa') return <LoginPage />;
  if (stage === 'setup-2fa') return <TwoFactorGate />;
  return (
    <Layout>
      <Routes />
    </Layout>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <ToastProvider>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </ToastProvider>
    </RouterProvider>
  );
}
