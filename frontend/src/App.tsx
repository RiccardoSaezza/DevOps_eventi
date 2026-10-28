import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { EventDetailPage } from './pages/EventDetailPage';
import { EventFormPage } from './pages/EventFormPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OrganizerDashboardPage } from './pages/OrganizerDashboardPage';
import { RegisterPage } from './pages/RegisterPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="events/:id" element={<EventDetailPage />} />
          <Route
            path="my-bookings"
            element={
              <ProtectedRoute>
                <MyBookingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="organizer"
            element={
              <ProtectedRoute role="ORGANIZZATORE">
                <OrganizerDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="organizer/events/new"
            element={
              <ProtectedRoute role="ORGANIZZATORE">
                <EventFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="organizer/events/:id/edit"
            element={
              <ProtectedRoute role="ORGANIZZATORE">
                <EventFormPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}
