import { createRootRoute, createRoute, createRouter, Link, Outlet } from '@tanstack/react-router';
import { AsteroidsPage } from './pages/AsteroidsPage.jsx';
import { PortalPage } from './pages/PortalPage.jsx';
import { StarCatcherPage } from './pages/StarCatcherPage.jsx';
import { StickerBookPage } from './pages/StickerBookPage.jsx';

function RootLayout() {
  return <Outlet />;
}

function NotFoundPage() {
  return (
    <main className="portal-shell portal-shell--centered">
      <section className="not-found-panel" aria-labelledby="missing-route-title">
        <p className="eyebrow">Route missing</p>
        <h1 id="missing-route-title">No game lives here.</h1>
        <p>Choose a game from the arcade shelf.</p>
        <Link className="button button--primary" to="/">
          Back to games
        </Link>
      </section>
    </main>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: PortalPage,
});

const asteroidsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/games/asteroids',
  component: AsteroidsPage,
});

const starCatcherRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/games/star-catcher',
  component: StarCatcherPage,
});

const stickerBookRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/games/sticker-book',
  component: StickerBookPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  asteroidsRoute,
  starCatcherRoute,
  stickerBookRoute,
]);

export const router = createRouter({ routeTree });
