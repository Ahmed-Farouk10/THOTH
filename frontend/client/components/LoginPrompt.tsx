import { Link } from 'react-router-dom';

export default function LoginPrompt() {
    return (
        <div style={{
            background: 'rgba(212, 175, 55, 0.1)',
            border: '2px solid var(--gold-light)',
            borderRadius: 'var(--border-radius)',
            padding: '40px',
            textAlign: 'center',
            maxWidth: '500px',
            margin: '0 auto'
        }}>
            <div style={{ fontSize: '3rem', marginBottom: '20px' }}>⚠️</div>
            <h3 style={{
                color: 'var(--gold-light)',
                fontSize: '1.8rem',
                marginBottom: '15px',
                fontFamily: "'Palatino Linotype', 'Book Antiqua', serif"
            }}>
                Temple Restricted
            </h3>
            <p style={{
                color: 'var(--papyrus-light)',
                fontSize: '1.1rem',
                marginBottom: '30px',
                lineHeight: '1.6'
            }}>
                Please login first to use the AI functionality services
            </p>
            <Link
                to="/login"
                style={{
                    display: 'inline-block',
                    background: 'linear-gradient(135deg, #D4AF37 0%, #AA8800 100%)',
                    color: 'var(--stone-dark)',
                    padding: '15px 40px',
                    borderRadius: 'var(--border-radius)',
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    textDecoration: 'none',
                    transition: 'transform 0.3s ease, box-shadow 0.3s ease'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 5px 20px rgba(212, 175, 55, 0.5)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                }}
            >
                🔑 Login to Continue
            </Link>
        </div>
    );
}
