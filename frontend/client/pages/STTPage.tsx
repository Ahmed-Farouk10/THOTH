import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function STTPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [language, setLanguage] = useState('en');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [recordedMimeType, setRecordedMimeType] = useState<string>('audio/webm');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const toggleRecording = async () => {
    if (!isRecording) {
      try {
        setError(null);

        // Detect best supported audio format
        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        }

        setRecordedMimeType(mimeType);

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          setIsProcessing(true);

          try {
            // Use the actual mimetype from MediaRecorder
            const audioBlob = new Blob(audioChunksRef.current, { type: recordedMimeType });
            const result = await api.transcribeAudio(audioBlob);
            setTranscription(result.transcription);
            setConfidence(result.confidence || null);
          } catch (err: any) {
            console.error('Transcription error:', err);
            setError(err.message || 'Failed to transcribe audio');
          } finally {
            setIsProcessing(false);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (error) {
        console.error('Error accessing microphone:', error);
        setError('Failed to access microphone. Please check permissions.');
      }
    } else {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const result = await api.transcribeAudio(file);
      setTranscription(result.transcription);  // Changed from result.text
      setConfidence(result.confidence || null);
    } catch (err: any) {
      console.error('Transcription error:', err);
      setError(err.message || 'Failed to transcribe audio file');
    } finally {
      setIsProcessing(false);
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
            🎤 Oracle's Ear
          </h2>
          <p style={{ color: 'var(--papyrus-light)', fontSize: '1.2rem' }}>Transcribe audio to sacred text</p>
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
            <div className="upload-area"
              onClick={() => document.getElementById('audio-upload')?.click()}
              style={{
                border: '2px dashed var(--gold-light)',
                borderRadius: 'var(--border-radius)',
                padding: '40px',
                textAlign: 'center',
                marginBottom: '20px',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              <div style={{ fontSize: '3rem', color: 'var(--gold-light)', marginBottom: '15px' }}>🎵</div>
              <p style={{ color: 'var(--papyrus-light)', marginBottom: '8px', fontWeight: 'bold' }}>
                Click to upload audio file or drag and drop
              </p>
              <p style={{ color: 'var(--papyrus-dark)', fontSize: '0.9rem' }}>
                Supported formats: WAV, MP3, OGG
              </p>
              <input
                type="file"
                id="audio-upload"
                accept="audio/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: 'var(--papyrus-light)',
                fontWeight: 'bold'
              }}>
                Language of the Oracle:
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
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
                <option value="en">English</option>
                <option value="ar">Ancient Arabic</option>
                <option value="la">Latin</option>
                <option value="el">Greek</option>
              </select>
            </div>

            <div id="recording-controls">
              <button
                onClick={toggleRecording}
                className="btn-primary"
                style={{
                  background: isRecording
                    ? 'var(--egyptian-red)'
                    : 'linear-gradient(to right, var(--gold-light), var(--gold-medium))',
                  color: isRecording ? 'white' : 'var(--stone-dark)',
                  padding: '15px 30px',
                  fontSize: '1rem',
                  boxShadow: 'var(--shadow)',
                  border: 'none',
                  borderRadius: 'var(--border-radius)',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 'bold',
                  width: '100%',
                  justifyContent: 'center'
                }}
              >
                {isRecording ? (
                  <>
                    <span style={{
                      width: '12px',
                      height: '12px',
                      background: 'white',
                      borderRadius: '50%',
                      animation: 'pulse 1s infinite'
                    }} />
                    Stop Recording
                  </>
                ) : (
                  '🎤 Start Recording'
                )}
              </button>
              {isRecording && (
                <div style={{
                  marginTop: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--egyptian-red)',
                  justifyContent: 'center'
                }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    background: 'var(--egyptian-red)',
                    borderRadius: '50%',
                    animation: 'pulse 1s infinite'
                  }} />
                  <span>Recording...</span>
                </div>
              )}
            </div>
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
              Transcribed Text
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
            {isProcessing ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{
                  display: 'inline-block',
                  width: '40px',
                  height: '40px',
                  border: '4px solid var(--gold-light)',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: '20px'
                }} />
                <p style={{ color: 'var(--papyrus-light)' }}>Processing your spoken words...</p>
              </div>
            ) : transcription ? (
              <div style={{
                background: 'rgba(15, 76, 117, 0.3)',
                border: '1px solid var(--egyptian-blue)',
                color: 'var(--papyrus-light)',
                padding: '15px',
                borderRadius: 'var(--border-radius)',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.7'
              }}>
                <h4 style={{ color: 'var(--gold-light)', marginBottom: '10px' }}>Transcription Result:</h4>
                <p>{transcription}</p>
                {confidence !== null && (
                  <small style={{ color: 'var(--papyrus-dark)', fontSize: '0.9rem' }}>
                    Confidence: {Math.round(confidence * 100)}%
                  </small>
                )}
              </div>
            ) : (
              <p style={{ color: 'var(--papyrus-dark)', textAlign: 'center', marginTop: '100px' }}>
                Transcription will appear here
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
