import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function TTSPage() {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('deep');
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const synthesizeSpeech = async () => {
    if (!text.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Call real TTS API
      const audioBlob = await api.synthesizeSpeech(text, voice);

      // Create object URL for audio playback
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
    } catch (err: any) {
      console.error('TTS error:', err);
      setError(err.message || 'Failed to synthesize speech');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      padding: '80px 20px',
      background: 'linear-gradient(135deg, var(--stone-dark) 0%, var(--stone-medium) 100%)'
    }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
        <Link
          to="/"
          className="back-btn"
          style={{
            background: 'transparent',
            color: 'var(--papyrus-light)',
            border: '2px solid var(--gold-light)',
            padding: '10px 20px',
            borderRadius: 'var(--border-radius)',
            cursor: 'pointer',
            fontSize: '1rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '30px',
            textDecoration: 'none',
            transition: 'all 0.3s ease'
          }}
        >
          ← Back to Temple
        </Link>

        <div className="service-header" style={{ textAlign: 'center', marginBottom: '50px' }}>
          <h2 style={{ fontSize: '3rem', color: 'var(--gold-light)', marginBottom: '20px', fontFamily: "'Palatino Linotype', 'Book Antiqua', serif" }}>
            🔊 Divine Utterance
          </h2>
          <p style={{ color: 'var(--papyrus-light)', fontSize: '1.2rem' }}>Convert text to the voice of Thoth</p>
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
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: 'var(--papyrus-light)',
                fontWeight: 'bold'
              }}>
                Enter text for Thoth to speak:
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="form-control"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid var(--stone-light)',
                  borderRadius: 'var(--border-radius)',
                  backgroundColor: 'rgba(44, 36, 22, 0.7)',
                  color: 'var(--papyrus-light)',
                  fontSize: '1rem',
                  minHeight: '150px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  outline: 'none'
                }}
                placeholder="Enter the wisdom you wish Thoth to utter..."
              />
            </div>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: 'var(--papyrus-light)',
                fontWeight: 'bold'
              }}>
                Select Thoth's Voice:
              </label>
              <select
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                className="form-control"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid var(--stone-light)',
                  borderRadius: 'var(--border-radius)',
                  backgroundColor: 'rgba(44, 36, 22, 0.7)',
                  color: 'var(--papyrus-light)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  outline: 'none'
                }}
              >
                <option value="deep">Deep Oracle Voice</option>
                <option value="wise">Wise Sage Voice</option>
                <option value="echoing">Echoing Temple Voice</option>
              </select>
            </div>
            <button
              onClick={synthesizeSpeech}
              disabled={isLoading || !text.trim()}
              className="btn-primary"
              style={{
                background: 'linear-gradient(to right, var(--gold-light), var(--gold-medium))',
                color: 'var(--stone-dark)',
                padding: '15px 30px',
                fontSize: '1.2rem',
                boxShadow: 'var(--shadow)',
                border: 'none',
                borderRadius: 'var(--border-radius)',
                cursor: isLoading || !text.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontWeight: 'bold',
                width: '100%',
                justifyContent: 'center',
                opacity: isLoading || !text.trim() ? 0.5 : 1
              }}
            >
              {isLoading ? '⏳ Generating...' : '▶️ Generate Divine Utterance'}
            </button>
          </div>

          <div className="service-output" style={{
            background: 'linear-gradient(145deg, var(--stone-medium), var(--stone-dark))',
            padding: '30px',
            borderRadius: 'var(--border-radius)',
            border: '1px solid var(--stone-light)',
            minHeight: '300px',
            overflowY: 'auto'
          }}>
            <h3 style={{ color: 'var(--gold-light)', marginBottom: '20px', fontSize: '1.5rem' }}>
              Generated Audio
            </h3>
            {error && (
              <div style={{
                background: 'rgba(220, 38, 38, 0.2)',
                border: '1px solid rgb(220, 38, 38)',
                padding: '15px',
                borderRadius: 'var(--border-radius)',
                color: 'rgb(248, 113, 113)',
                marginBottom: '20px'
              }}>
                <strong>Error:</strong> {error}
              </div>
            )}
            {audioUrl ? (
              <div className="audio-player" style={{
                background: 'linear-gradient(145deg, var(--stone-medium), var(--stone-dark))',
                padding: '20px',
                borderRadius: 'var(--border-radius)',
                border: '1px solid var(--gold-light)',
                marginTop: '20px'
              }}>
                <p style={{ color: 'var(--papyrus-light)', marginBottom: '15px' }}>
                  Listen to Thoth's wisdom:
                </p>
                <audio controls src={audioUrl} style={{ width: '100%', marginBottom: '15px' }}>
                  Your browser does not support the audio element.
                </audio>
                <div className="audio-controls" style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                  <a
                    href={audioUrl}
                    download="thoth-speech.wav"
                    className="btn"
                    style={{
                      padding: '10px 20px',
                      background: 'var(--gold-light)',
                      color: 'var(--stone-dark)',
                      border: 'none',
                      borderRadius: 'var(--border-radius)',
                      cursor: 'pointer',
                      fontWeight: '600',
                      textDecoration: 'none',
                      display: 'inline-block'
                    }}
                  >
                    ⬇️ Download
                  </a>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--papyrus-dark)', textAlign: 'center', marginTop: '100px' }}>
                Generated audio will appear here
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
