import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute() {
    const { isAuthenticated, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, var(--stone-dark) 0%, var(--stone-medium) 100%)'
            }}>
                <div style={{
                    fontSize: '2rem',
                    color: 'var(--gold-light)',
                    fontFamily: "'Palatino Linotype', 'Book Antiqua', serif"
                }}>
                    ⏳ Loading...
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        // Redirect to login, saving the attempted location
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <Outlet />;
}
