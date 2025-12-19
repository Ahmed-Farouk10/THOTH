import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Menu, X, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/oracle', label: 'Oracle' },
    { path: '/temple', label: 'Temple' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-bg-void/95 backdrop-blur-md border-b border-gold-primary/20 shadow-obsidian">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-3 group cursor-pointer"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gold-primary/20 rounded-full blur-xl group-hover:bg-gold-primary/30 transition-all" />
              <div className="relative w-12 h-12 bg-gradient-to-br from-gold-primary to-gold-dark rounded-full flex items-center justify-center text-2xl shadow-gold">
                <Sparkles className="w-6 h-6 text-bg-void" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-gradient-gold tracking-tight" style={{
                fontFamily: 'Cinzel, serif',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}>
                THOTH
              </span>
              <span className="text-xs text-text-muted uppercase tracking-widest" style={{ fontFamily: 'Inter, sans-serif' }}>
                Intelligence Platform
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`relative px-4 py-2 text-sm font-medium uppercase tracking-wider transition-all duration-300 ${isActive(item.path)
                  ? 'text-gold-primary'
                  : 'text-text-secondary hover:text-gold-primary'
                  }`}
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {item.label}
                {isActive(item.path) && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-gold-primary to-gold-light"
                    layoutId="activeTab"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </Link>
            ))}
          </nav>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <NotificationBell />
                <div className="px-4 py-2 rounded border border-gold-primary text-gold-primary font-semibold text-sm">
                  Signed in as {user?.username || 'Initiate'}
                </div>
                <button
                  onClick={logout}
                  className="btn btn-outline text-sm"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="btn btn-outline text-sm"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  Sign In
                </button>
                <button
                  onClick={() => navigate('/signup')}
                  className="btn btn-primary text-sm"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  Get Started
                </button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-text-secondary hover:text-gold-primary transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <motion.div
          className="md:hidden border-t border-gold-primary/20 bg-bg-obsidian/95 backdrop-blur-md"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
        >
          <nav className="px-4 py-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base font-medium uppercase tracking-wider transition-all ${isActive(item.path)
                  ? 'text-gold-primary bg-gold-primary/10'
                  : 'text-text-secondary hover:text-gold-primary hover:bg-gold-primary/5'
                  }`}
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-4 space-y-2 border-t border-gold-primary/20">
              {isAuthenticated ? (
                <>
                  <div className="w-full px-4 py-3 rounded border border-gold-primary text-gold-primary font-semibold text-sm text-center">
                    Signed in as {user?.username || 'Initiate'}
                  </div>
                  <button
                    onClick={logout}
                    className="w-full btn btn-outline text-sm"
                    style={{ fontFamily: 'Inter,sans-serif' }}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/login')}
                    className="w-full btn btn-outline text-sm"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => navigate('/signup')}
                    className="w-full btn btn-primary text-sm"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </nav>
        </motion.div>
      )}
    </header>
  );
}
