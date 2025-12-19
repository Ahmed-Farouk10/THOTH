import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Header() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <header
        className="sticky top-0 z-[1000]"
        style={{
          background: 'linear-gradient(135deg, var(--bg-obsidian) 0%, rgba(212, 175, 55, 0.05) 100%)',
          borderBottom: '1px solid var(--border-gold)',
          boxShadow: 'var(--shadow-obsidian)',
          backdropFilter: 'blur(10px)'
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-4 group">
              <div
                className="text-4xl transition-all duration-300 group-hover:scale-110"
                style={{
                  color: 'var(--gold-primary)',
                  filter: 'drop-shadow(0 0 10px var(--gold-glow))'
                }}
              >
                👁
              </div>
              <div
                className="text-3xl font-bold tracking-wider transition-all duration-300"
                style={{
                  fontFamily: 'var(--font-header)',
                  color: 'var(--text-main)',
                  textShadow: '0 0 20px rgba(212, 175, 55, 0.3)'
                }}
              >
                THOTH
              </div>
            </Link>

            {/* Navigation */}
            <nav className="flex gap-8">
              <Link
                to="/"
                className="nav-link"
                style={{
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '1rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  transition: 'all 0.3s',
                  position: 'relative',
                  padding: '0.5rem 0'
                }}
              >
                Home
              </Link>
              <Link
                to="/oracle"
                className="nav-link"
                style={{
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '1rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  transition: 'all 0.3s',
                  position: 'relative',
                  padding: '0.5rem 0'
                }}
              >
                Oracle
              </Link>
              <Link
                to="/temple"
                className="nav-link"
                style={{
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '1rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  transition: 'all 0.3s',
                  position: 'relative',
                  padding: '0.5rem 0'
                }}
              >
                Temple
              </Link>
            </nav>

            {/* Auth Buttons */}
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <>
                  <div
                    className="px-4 py-2 rounded"
                    style={{
                      color: 'var(--gold-primary)',
                      border: '1px solid var(--border-gold)',
                      fontWeight: 600
                    }}
                  >
                    Signed in as {user?.username || 'Initiate'}
                  </div>
                  <button
                    onClick={logout}
                    style={{
                      padding: '0.5rem 1.5rem',
                      background: 'transparent',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-gold)',
                      borderRadius: '4px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--gold-primary)';
                      e.currentTarget.style.color = 'var(--bg-obsidian)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-main)';
                    }}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/login')}
                    style={{
                      padding: '0.5rem 1.5rem',
                      background: 'transparent',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-gold)',
                      borderRadius: '4px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(212, 175, 55, 0.1)';
                      e.currentTarget.style.color = 'var(--gold-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-main)';
                    }}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => navigate('/signup')}
                    style={{
                      padding: '0.5rem 1.5rem',
                      background: 'linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-secondary) 100%)',
                      color: 'var(--bg-obsidian)',
                      border: 'none',
                      borderRadius: '4px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      boxShadow: '0 2px 10px rgba(212, 175, 55, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 15px rgba(212, 175, 55, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 10px rgba(212, 175, 55, 0.3)';
                    }}
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <style>{`
        .nav-link::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 0;
          height: 2px;
          background: var(--gold-primary);
          transition: width 0.3s ease;
        }
        
        .nav-link:hover {
          color: var(--gold-primary);
        }
        
        .nav-link:hover::after {
          width: 100%;
        }
      `}</style>
    </>
  );
}
