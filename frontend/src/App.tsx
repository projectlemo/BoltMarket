import { useEffect } from 'react';
import { HeadProvider, type HeadCollector } from './lib/head';
import { AuthProvider } from './lib/auth';
import { captureReferral } from './lib/referral';
import { RouterProvider, useRouter, type RouterState } from './router';
import { SiteLayout } from './components/layout/SiteLayout';

function RouteView() {
  const { state, pending } = useRouter();
  useEffect(() => captureReferral(state.search), [state.search]);
  const { Component, match, data } = state;
  const page = <Component params={{ ...match.route.props, ...match.params }} data={data} />;
  return (
    <>
      {pending ? <div className="route-progress" aria-hidden="true" /> : null}
      {/* Auth and portal pages render their own shells (their strings are code-split). */}
      {match.route.layout === 'site' ? <SiteLayout>{page}</SiteLayout> : page}
    </>
  );
}

export function App({ initial, head }: { initial: RouterState; head?: HeadCollector }) {
  return (
    <RouterProvider initial={initial}>
      <HeadProvider collector={head}>
        <AuthProvider>
          <RouteView />
        </AuthProvider>
      </HeadProvider>
    </RouterProvider>
  );
}
