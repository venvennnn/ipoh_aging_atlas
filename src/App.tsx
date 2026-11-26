import { Suspense, lazy, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/Header';

const Overview = lazy(() => import('./pages/Overview'));
const PlaceFacility = lazy(() => import('./pages/PlaceFacility'));
const Optimizer = lazy(() => import('./pages/Optimizer'));
const IndexExplorer = lazy(() => import('./pages/IndexExplorer'));

const TITLES: Record<string, string> = {
  '/': 'Ipoh Ageing Atlas',
  '/place': 'Place a facility · Ipoh Ageing Atlas',
  '/optimise': 'Find the best sites · Ipoh Ageing Atlas',
  '/index': 'Vulnerability index · Ipoh Ageing Atlas',
};

export default function App() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    document.title = TITLES[pathname] ?? 'Ipoh Ageing Atlas';
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);

  return (
    <>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <Header narrow={pathname === '/'} />
      <div id="content">
        <Suspense fallback={<p className="page small">Loading…</p>}>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/place" element={<PlaceFacility />} />
            <Route path="/optimise" element={<Optimizer />} />
            <Route path="/index" element={<IndexExplorer />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>
    </>
  );
}

function NotFound() {
  return (
    <main className="page">
      <h1>Page not found</h1>
      <p className="lede">
        <a href="/">Go to the overview</a>
      </p>
    </main>
  );
}
