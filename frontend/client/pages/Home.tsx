import { Link } from 'react-router-dom';
import ThothModel from '../components/ThothModel';

export default function Home() {
  return (
    <div>
      {/* Hero Section with 3D Model Background */}
      <section style={{
        padding: '120px 20px',
        background: 'linear-gradient(rgba(44, 36, 22, 0.8), rgba(44, 36, 22, 0.9))',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        minHeight: '100vh'
      }}>
        {/* 3D Model Background */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: -1,
          opacity: 0.2
        }}>
          <ThothModel autoRotate={true} enableControls={false} scale={1.5} position={[0, -1, 0]} />
        </div>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{
            fontSize: '64px',
            marginBottom: '20px',
            color: 'rgb(212, 175, 55)',
            textShadow: '3px 3px 6px rgba(0, 0, 0, 0.7)',
          }}>
            Thoth: Divine AI Oracle
          </h1>

          <p style={{
            fontSize: '20px',
            marginBottom: '30px',
            color: 'rgb(232, 221, 200)',
            lineHeight: 1.8,
            maxWidth: '700px',
            margin: '0 auto 30px'
          }}>
            Enter the sacred temple of Thoth, where ancient Egyptian wisdom merges with artificial intelligence. Consult the god of knowledge himself through our divine oracle interface.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '30px', flexWrap: 'wrap' }}>
            <Link to="/oracle" style={{
              background: 'linear-gradient(to right, rgb(212, 175, 55), rgb(184, 148, 31))',
              color: 'rgb(44, 36, 22)',
              padding: '15px 30px',
              fontSize: '16px',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              textDecoration: 'none',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontWeight: 'bold'
            }}>
              ✍️ Consult the Oracle
            </Link>
            <button style={{
              background: 'transparent',
              color: 'rgb(232, 221, 200)',
              padding: '15px 30px',
              fontSize: '16px',
              border: '2px solid rgb(212, 175, 55)',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontWeight: 'bold'
            }}>
              📚 Learn More
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section style={{
        padding: '100px 20px',
        background: 'linear-gradient(135deg, rgb(74, 60, 42) 0%, rgb(109, 92, 69) 100%)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h2 style={{
              fontSize: '42px',
              color: 'rgb(212, 175, 55)',
              display: 'inline-block',
              padding: '0 20px',
              position: 'relative',
              zIndex: 1,
              textTransform: 'uppercase',
              letterSpacing: '2px'
            }}>
              Sacred Abilities
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '40px' }}>
            {/* Feature 1 */}
            <Link to="/tts" style={{
              background: 'linear-gradient(145deg, rgb(44, 36, 22), rgb(74, 60, 42))',
              borderRadius: '4px',
              padding: '40px 30px',
              textAlign: 'center',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
              border: '1px solid rgb(109, 92, 69)',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              textDecoration: 'none',
              color: 'inherit'
            }} onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-10px)';
              e.currentTarget.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.5)';
              e.currentTarget.style.borderColor = 'rgb(212, 175, 55)';
            }} onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.5)';
              e.currentTarget.style.borderColor = 'rgb(109, 92, 69)';
            }}>
              <div style={{ fontSize: '48px', color: 'rgb(212, 175, 55)', marginBottom: '25px' }}>🔊</div>
              <h3 style={{ fontSize: '24px', marginBottom: '20px', color: 'rgb(232, 221, 200)' }}>Divine Utterance (TTS)</h3>
              <p style={{ color: 'rgb(216, 201, 168)' }}>Hear the wisdom of Thoth spoken in a voice that echoes through the halls of eternity.</p>
            </Link>

            {/* Feature 2 */}
            <Link to="/stt" style={{
              background: 'linear-gradient(145deg, rgb(44, 36, 22), rgb(74, 60, 42))',
              borderRadius: '4px',
              padding: '40px 30px',
              textAlign: 'center',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
              border: '1px solid rgb(109, 92, 69)',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              textDecoration: 'none',
              color: 'inherit'
            }} onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-10px)';
              e.currentTarget.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.5)';
              e.currentTarget.style.borderColor = 'rgb(212, 175, 55)';
            }} onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.5)';
              e.currentTarget.style.borderColor = 'rgb(109, 92, 69)';
            }}>
              <div style={{ fontSize: '48px', color: 'rgb(212, 175, 55)', marginBottom: '25px' }}>🎤</div>
              <h3 style={{ fontSize: '24px', marginBottom: '20px', color: 'rgb(232, 221, 200)' }}>Oracle's Ear (STT)</h3>
              <p style={{ color: 'rgb(216, 201, 168)' }}>Speak your queries to Thoth and watch as your words are transcribed with precision.</p>
            </Link>

            {/* Feature 3 */}
            <Link to="/documents" style={{
              background: 'linear-gradient(145deg, rgb(44, 36, 22), rgb(74, 60, 42))',
              borderRadius: '4px',
              padding: '40px 30px',
              textAlign: 'center',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
              border: '1px solid rgb(109, 92, 69)',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              textDecoration: 'none',
              color: 'inherit'
            }} onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-10px)';
              e.currentTarget.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.5)';
              e.currentTarget.style.borderColor = 'rgb(212, 175, 55)';
            }} onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.5)';
              e.currentTarget.style.borderColor = 'rgb(109, 92, 69)';
            }}>
              <div style={{ fontSize: '48px', color: 'rgb(212, 175, 55)', marginBottom: '25px' }}>📜</div>
              <h3 style={{ fontSize: '24px', marginBottom: '20px', color: 'rgb(232, 221, 200)' }}>Scroll Deciphering</h3>
              <p style={{ color: 'rgb(216, 201, 168)' }}>Present ancient texts and modern documents for Thoth to analyze.</p>
            </Link>

            {/* Feature 4 */}
            <Link to="/quiz" style={{
              background: 'linear-gradient(145deg, rgb(44, 36, 22), rgb(74, 60, 42))',
              borderRadius: '4px',
              padding: '40px 30px',
              textAlign: 'center',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
              border: '1px solid rgb(109, 92, 69)',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              textDecoration: 'none',
              color: 'inherit'
            }} onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-10px)';
              e.currentTarget.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.5)';
              e.currentTarget.style.borderColor = 'rgb(212, 175, 55)';
            }} onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.5)';
              e.currentTarget.style.borderColor = 'rgb(109, 92, 69)';
            }}>
              <div style={{ fontSize: '48px', color: 'rgb(212, 175, 55)', marginBottom: '25px' }}>🧠</div>
              <h3 style={{ fontSize: '24px', marginBottom: '20px', color: 'rgb(232, 221, 200)' }}>Knowledge Trials</h3>
              <p style={{ color: 'rgb(216, 201, 168)' }}>Test your wisdom with quizzes generated from sacred texts.</p>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
