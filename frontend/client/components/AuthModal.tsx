import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: (token: string) => void;
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Validation
    if (!formData.email || !formData.password) {
      setError('Please fill in all required fields');
      setIsLoading(false);
      return;
    }

    if (!isLogin && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      // TODO: Replace with actual API endpoint
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          username: formData.username
        })
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }

      const data = await response.json();
      
      // Store token in localStorage
      if (data.token) {
        localStorage.setItem('thoth_auth_token', data.token);
        onAuthSuccess?.(data.token);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setFormData({ email: '', password: '', confirmPassword: '', username: '' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-md"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-gold)',
          boxShadow: '0 0 40px rgba(212, 175, 55, 0.2)'
        }}
      >
        <DialogHeader>
          <DialogTitle 
            className="text-2xl text-center mb-2"
            style={{ 
              color: 'var(--gold-primary)',
              fontFamily: 'var(--font-header)'
            }}
          >
            {isLogin ? 'ENTER THE TEMPLE' : 'BECOME INITIATE'}
          </DialogTitle>
          <DialogDescription className="text-center" style={{ color: 'var(--text-secondary)' }}>
            {isLogin 
              ? 'Access the divine wisdom of Thoth' 
              : 'Join the sacred order of knowledge seekers'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {!isLogin && (
            <div>
              <Label htmlFor="username" style={{ color: 'var(--text-main)' }}>Username</Label>
              <Input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="mt-1"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-gold)',
                  color: 'var(--text-main)'
                }}
                required={!isLogin}
              />
            </div>
          )}

          <div>
            <Label htmlFor="email" style={{ color: 'var(--text-main)' }}>Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="mt-1"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-gold)',
                color: 'var(--text-main)'
              }}
              required
            />
          </div>

          <div>
            <Label htmlFor="password" style={{ color: 'var(--text-main)' }}>Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="mt-1"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-gold)',
                color: 'var(--text-main)'
              }}
              required
            />
          </div>

          {!isLogin && (
            <div>
              <Label htmlFor="confirmPassword" style={{ color: 'var(--text-main)' }}>Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="mt-1"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-gold)',
                  color: 'var(--text-main)'
                }}
                required={!isLogin}
              />
            </div>
          )}

          {error && (
            <div 
              className="p-3 rounded text-sm"
              style={{
                background: 'rgba(220, 38, 38, 0.1)',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                color: '#fca5a5'
              }}
            >
              {error}
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full btn-primary"
            disabled={isLoading}
            style={{
              opacity: isLoading ? 0.7 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? 'Processing...' : (isLogin ? 'Enter Temple' : 'Become Initiate')}
          </Button>

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={toggleMode}
              className="text-sm transition-colors"
              style={{ 
                color: 'var(--text-secondary)',
              }}
            >
              {isLogin ? "Don't have an account? " : 'Already initiated? '}
              <span style={{ color: 'var(--gold-primary)', textDecoration: 'underline' }}>
                {isLogin ? 'Become Initiate' : 'Enter Temple'}
              </span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
