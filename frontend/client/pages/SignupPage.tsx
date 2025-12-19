import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function SignupPage() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { signup } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validation
        if (username.length < 3 || username.length > 50) {
            setError('Username must be between 3 and 50 characters');
            return;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            setError('Username can only contain letters, numbers, and underscores');
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Please enter a valid email address');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters long');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);

        try {
            await signup(username, email, password);
            navigate('/', { replace: true });
        } catch (err: any) {
            setError(err.message || 'Signup failed. Username or email may already exist.');
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
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .signup-container {
          animation: fadeIn 0.6s ease-out;
        }
        .shake {
          animation: shake 0.4s ease-in-out;
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
        .signup-btn {
          background: linear-gradient(135deg, #D4AF37 0%, #AA8800 100%);
          transition: all 0.3s ease;
        }
        .signup-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 5px 20px rgba(212, 175, 55, 0.5);
        }
        .signup-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>

            <div className="signup-container" style={{
                background: 'linear-gradient(135deg, rgba(44, 36, 22, 0.95) 0%, rgba(26, 20, 16, 0.95) 100%)',
                borderRadius: '15px',
                padding: '50px 40px',
                maxWidth: '500px',
                width: '100%',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 50px rgba(212, 175, 55, 0.1)',
                border: '2px solid rgba(212, 175, 55, 0.3)'
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '35px' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '15px' }}>📜</div>
                    <h1 style={{
                        fontFamily: "'Palatino Linotype', 'Book Antiqua', serif",
                        fontSize: '2rem',
                        color: '#D4AF37',
                        marginBottom: '10px',
                        fontWeight: 'bold'
                    }}>
                        Join the Order of Thoth
                    </h1>
                    <p style={{
                        color: '#F5F0E8',
                        fontSize: '1.05rem',
                        opacity: 0.9
                    }}>
                        Initiation Ceremony
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

                {/* Signup Form */}
                <form onSubmit={handleSubmit}>
                    {/* Username Field */}
                    <div style={{ marginBottom: '18px' }}>
                        <label style={{
                            display: 'block',
                            color: '#F5F0E8',
                            marginBottom: '8px',
                            fontSize: '0.9rem',
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
                                padding: '12px 14px',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                fontFamily: "'Palatino Linotype', 'Book Antiqua', serif",
                                color: '#2C2416'
                            }}
                            placeholder="Choose your scholar name"
                        />
                    </div>

                    {/* Email Field */}
                    <div style={{ marginBottom: '18px' }}>
                        <label style={{
                            display: 'block',
                            color: '#F5F0E8',
                            marginBottom: '8px',
                            fontSize: '0.9rem',
                            fontWeight: '500'
                        }}>
                            ✉️ Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="input-field"
                            style={{
                                width: '100%',
                                padding: '12px 14px',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                fontFamily: "'Palatino Linotype', 'Book Antiqua', serif",
                                color: '#2C2416'
                            }}
                            placeholder="your.email@example.com"
                        />
                    </div>

                    {/* Password Field */}
                    <div style={{ marginBottom: '18px' }}>
                        <label style={{
                            display: 'block',
                            color: '#F5F0E8',
                            marginBottom: '8px',
                            fontSize: '0.9rem',
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
                                padding: '12px 14px',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                fontFamily: "'Palatino Linotype', 'Book Antiqua', serif",
                                color: '#2C2416'
                            }}
                            placeholder="At least 8 characters"
                        />
                    </div>

                    {/* Confirm Password Field */}
                    <div style={{ marginBottom: '25px' }}>
                        <label style={{
                            display: 'block',
                            color: '#F5F0E8',
                            marginBottom: '8px',
                            fontSize: '0.9rem',
                            fontWeight: '500'
                        }}>
                            🔑 Confirm Password
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className="input-field"
                            style={{
                                width: '100%',
                                padding: '12px 14px',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                fontFamily: "'Palatino Linotype', 'Book Antiqua', serif",
                                color: '#2C2416'
                            }}
                            placeholder="Re-enter your password"
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="signup-btn"
                        style={{
                            width: '100%',
                            padding: '15px',
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
                        {loading ? '⏳ Initiating...' : '🏺 Join the Order'}
                    </button>
                </form>

                {/* Login Link */}
                <div style={{ textAlign: 'center', marginTop: '25px' }}>
                    <p style={{ color: '#F5F0E8', fontSize: '0.95rem', marginBottom: '8px' }}>
                        Already a member?
                    </p>
                    <Link
                        to="/login"
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
                        🏛️ Return to Temple
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
