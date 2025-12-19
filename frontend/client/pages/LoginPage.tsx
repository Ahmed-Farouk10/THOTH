import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const from = (location.state as any)?.from?.pathname || '/';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(username, password);
            navigate(from, { replace: true });
        } catch (err: any) {
            setError(err.message || 'Invalid username or password');
            // Shake animation on error
            const form = document.querySelector('form');
            form?.classList.add('shake');
            setTimeout(() => form?.classList.remove('shake'), 500);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #2C2416 0%, #1A1410 100%)',
            padding: '20px'
        }}>
            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .login-container {
          animation: fadeIn 0.6s ease-out;
        }
        .shake {
          animation: shake 0.4s ease-in-out;
        }
        .gold-gradient {
          background: linear-gradient(135deg, #D4AF37 0%, #AA8800 100%);
        }
        .input-field {
          background: rgba(245, 240, 232, 0.95);
          border: 2px solid #8B7355;
          transition: all 0.3s ease;
        }
        .input-field:focus {
          outline: none;
          border-color: #D4AF37;
          box-shadow: 0 0 15px rgba(212, 175, 55, 0.3);
        }
        .login-btn {
          background: linear-gradient(135deg, #D4AF37 0%, #AA8800 100%);
          transition: all 0.3s ease;
        }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 5px 20px rgba(212, 175, 55, 0.5);
        }
        .login-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>

            <div className="login-container" style={{
                background: 'linear-gradient(135deg, rgba(44, 36, 22, 0.95) 0%, rgba(26, 20, 16, 0.95) 100%)',
                borderRadius: '15px',
                padding: '50px 40px',
                maxWidth: '450px',
                width: '100%',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 50px rgba(212, 175, 55, 0.1)',
                border: '2px solid rgba(212, 175, 55, 0.3)'
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '15px' }}>🏛️</div>
                    <h1 style={{
                        fontFamily: "'Palatino Linotype', 'Book Antiqua', serif",
                        fontSize: '2.2rem',
                        color: '#D4AF37',
                        marginBottom: '10px',
                        fontWeight: 'bold'
                    }}>
                        The Temple of Thoth
                    </h1>
                    <p style={{
                        color: '#F5F0E8',
                        fontSize: '1.1rem',
                        opacity: 0.9
                    }}>
                        Entrance
                    </p>
                </div>

                {/* Greeting */}
                <div style={{
                    textAlign: 'center',
                    marginBottom: '30px',
                    padding: '15px',
                    background: 'rgba(212, 175, 55, 0.1)',
                    borderRadius: '10px'
                }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⚱️</div>
                    <p style={{
                        color: '#D4AF37',
                        fontSize: '1.3rem',
                        fontFamily: "'Palatino Linotype', 'Book Antiqua', serif",
                        margin: 0
                    }}>
                        Welcome Back, Scholar
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div style={{
                        background: 'rgba(199, 62, 29, 0.2)',
                        border: '2px solid #C73E1D',
                        borderRadius: '8px',
                        padding: '12px',
                        marginBottom: '20px',
                        color: '#FF6B6B',
                        textAlign: 'center',
                        fontSize: '0.95rem'
                    }}>
                        {error}
                    </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleSubmit}>
                    {/* Username Field */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{
                            display: 'block',
                            color: '#F5F0E8',
                            marginBottom: '8px',
                            fontSize: '0.95rem',
                            fontWeight: '500'
                        }}>
                            📜 Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="input-field"
                            style={{
                                width: '100%',
                                padding: '14px 16px',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                fontFamily: "'Palatino Linotype', 'Book Antiqua', serif",
                                color: '#2C2416'
                            }}
                            placeholder="Enter your username"
                        />
                    </div>

                    {/* Password Field */}
                    <div style={{ marginBottom: '30px' }}>
                        <label style={{
                            display: 'block',
                            color: '#F5F0E8',
                            marginBottom: '8px',
                            fontSize: '0.95rem',
                            fontWeight: '500'
                        }}>
                            🔐 Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="input-field"
                            style={{
                                width: '100%',
                                padding: '14px 16px',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                fontFamily: "'Palatino Linotype', 'Book Antiqua', serif",
                                color: '#2C2416'
                            }}
                            placeholder="Enter your password"
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="login-btn"
                        style={{
                            width: '100%',
                            padding: '16px',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            color: '#2C2416',
                            cursor: 'pointer',
                            fontFamily: "'Palatino Linotype', 'Book Antiqua', serif",
                            marginBottom: '20px'
                        }}
                    >
                        {loading ? '⏳ Entering Temple...' : '✨ Enter Temple'}
                    </button>
                </form>

                {/* Signup Link */}
                <div style={{ textAlign: 'center', marginTop: '25px' }}>
                    <p style={{ color: '#F5F0E8', fontSize: '0.95rem', marginBottom: '8px' }}>
                        Don't have an account?
                    </p>
                    <Link
                        to="/signup"
                        style={{
                            color: '#D4AF37',
                            textDecoration: 'none',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            transition: 'color 0.3s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#FFD700'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#D4AF37'}
                    >
                        🌟 Join the Order
                    </Link>
                </div>

                {/* Back to Home */}
                <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid rgba(212, 175, 55, 0.2)' }}>
                    <Link
                        to="/"
                        style={{
                            color: '#8B7355',
                            textDecoration: 'none',
                            fontSize: '0.9rem'
                        }}
                    >
                        ← Return to Main Hall
                    </Link>
                </div>
            </div>
        </div>
    );
}
