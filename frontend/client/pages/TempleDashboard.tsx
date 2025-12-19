import { Link } from 'react-router-dom';

export default function TempleDashboard() {
  const activities = [
    { type: 'chat', text: 'Consulted the oracle about Egyptian mythology', time: '2 hours ago' },
    { type: 'tts', text: 'Generated audio from sacred text', time: '1 day ago' },
    { type: 'documents', text: 'Analyzed ancient scroll about pyramid construction', time: '3 days ago' },
    { type: 'quiz', text: 'Completed knowledge trial on hieroglyphics', score: '85%', time: '1 week ago' }
  ];

  const stats = [
    { label: 'Oracle Consultations', value: '24' },
    { label: 'Documents Deciphered', value: '8' },
    { label: 'Audio Transcriptions', value: '12' },
    { label: 'Quizzes Completed', value: '5' },
    { label: 'Average Quiz Score', value: '78%' }
  ];

  return (
    <div style={{ 
      minHeight: '100vh', 
      padding: '80px 20px', 
      background: 'linear-gradient(135deg, var(--stone-dark) 0%, var(--stone-medium) 100%)' 
    }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
        <div className="service-header" style={{ textAlign: 'center', marginBottom: '50px' }}>
          <h2 style={{ fontSize: '3rem', color: 'var(--gold-light)', marginBottom: '20px', fontFamily: "'Palatino Linotype', 'Book Antiqua', serif" }}>
            🏛️ Temple Dashboard
          </h2>
          <p style={{ color: 'var(--papyrus-light)', fontSize: '1.2rem' }}>Your journey through Thoth's wisdom</p>
        </div>

        <div className="service-content" style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '40px', 
          marginBottom: '50px' 
        }}>
          <div className="service-form" style={{
            background: 'linear-gradient(145deg, var(--stone-dark), var(--stone-medium))',
            padding: '30px',
            borderRadius: 'var(--border-radius)',
            border: '1px solid var(--gold-light)'
          }}>
            <h3 style={{ 
              color: 'var(--gold-light)', 
              marginBottom: '25px', 
              fontSize: '1.8rem',
              fontFamily: "'Palatino Linotype', 'Book Antiqua', serif",
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: '2px'
            }}>
              Recent Activities
            </h3>
            <div id="activity-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {activities.map((activity, idx) => (
                <div 
                  key={idx}
                  style={{
                    background: 'rgba(15, 76, 117, 0.3)',
                    border: '1px solid var(--egyptian-blue)',
                    color: 'var(--papyrus-light)',
                    padding: '15px',
                    borderRadius: 'var(--border-radius)',
                    display: 'block'
                  }}
                >
                  <p style={{ marginBottom: '5px' }}>
                    <strong style={{ color: 'var(--gold-light)', textTransform: 'uppercase' }}>
                      {activity.type}:
                    </strong> {activity.text}
                  </p>
                  {activity.score && (
                    <p style={{ marginBottom: '5px', color: 'var(--gold-light)' }}>
                      <strong>Score:</strong> {activity.score}
                    </p>
                  )}
                  <small style={{ color: 'var(--papyrus-dark)', fontSize: '0.85rem' }}>
                    {activity.time}
                  </small>
                </div>
              ))}
            </div>
          </div>

          <div className="service-output" style={{
            background: 'linear-gradient(145deg, var(--stone-medium), var(--stone-dark))',
            padding: '30px',
            borderRadius: 'var(--border-radius)',
            border: '1px solid var(--stone-light)',
            minHeight: '300px'
          }}>
            <h3 style={{ 
              color: 'var(--gold-light)', 
              marginBottom: '25px', 
              fontSize: '1.8rem',
              fontFamily: "'Palatino Linotype', 'Book Antiqua', serif",
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: '2px'
            }}>
              Wisdom Statistics
            </h3>
            <div id="statistics" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{
                background: 'rgba(15, 76, 117, 0.3)',
                border: '1px solid var(--egyptian-blue)',
                color: 'var(--papyrus-light)',
                padding: '20px',
                borderRadius: 'var(--border-radius)',
                display: 'block'
              }}>
                <h4 style={{ color: 'var(--gold-light)', marginBottom: '15px', fontSize: '1.2rem' }}>
                  Your Wisdom Journey:
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  {stats.map((stat, idx) => (
                    <div 
                      key={idx}
                      style={{
                        background: 'rgba(44, 36, 22, 0.7)',
                        padding: '15px',
                        borderRadius: 'var(--border-radius)',
                        border: '1px solid var(--stone-light)',
                        textAlign: 'center',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <div style={{ 
                        fontSize: '2rem', 
                        color: 'var(--gold-light)', 
                        fontWeight: 'bold',
                        marginBottom: '5px',
                        textShadow: '0 2px 10px rgba(212, 175, 55, 0.3)'
                      }}>
                        {stat.value}
                      </div>
                      <div style={{ 
                        fontSize: '0.85rem', 
                        color: 'var(--papyrus-dark)', 
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                      }}>
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
