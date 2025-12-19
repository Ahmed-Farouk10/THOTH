import { useState, useEffect, useRef } from 'react';

interface IntroSequenceProps {
  onComplete: () => void;
}

export default function IntroSequence({ onComplete }: IntroSequenceProps) {
  const [isVisible, setIsVisible] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationIdRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const particles: Particle[] = [];
    const hieroglyphs = ['𓀀', '𓁐', '𓁒', '𓃉', '𓃊', '𓃋', '𓃌', '𓃍', '𓃎', '𓃏', '𓃐', '𓃑'];

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    class Particle {
      x: number;
      y: number;
      size: number;
      speedY: number;
      text: string;
      opacity: number;
      fadeIn: boolean;

      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 20 + 10; // Random size between 10px and 30px
        this.speedY = Math.random() * 1 + 0.5; // Upward float speed
        this.text = hieroglyphs[Math.floor(Math.random() * hieroglyphs.length)];
        this.opacity = 0;
        this.fadeIn = true;
      }

      update() {
        this.y -= this.speedY;
        // If particle goes off top, reset to bottom
        if (this.y < -50) this.y = canvas.height + 50;
        
        // Fade in/out logic for twinkling effect
        if (this.fadeIn) {
          this.opacity += 0.01; 
          if (this.opacity >= 0.5) this.fadeIn = false;
        } else {
          this.opacity -= 0.01; 
          if (this.opacity <= 0) { 
            this.fadeIn = true; 
            this.x = Math.random() * canvas.width; // Reset position
          }
        }
      }

      draw() {
        if (!ctx) return;
        ctx.fillStyle = `rgba(212, 175, 55, ${this.opacity})`; // Gold color
        ctx.font = `${this.size}px serif`;
        ctx.fillText(this.text, this.x, this.y);
      }
    }

    // Initialize particles
    for(let i=0; i<50; i++) {
      particles.push(new Particle());
    }

    // Animation Loop
    const animateIntro = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => { 
        p.update(); 
        p.draw(); 
      });
      animationIdRef.current = requestAnimationFrame(animateIntro);
    };

    // Start
    animateIntro();

    // Automatically end intro after 6 seconds
    const timer = setTimeout(() => {
      endIntro();
    }, 6000);

    return () => {
      clearTimeout(timer);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  const endIntro = () => {
    setIsVisible(false);
    setTimeout(() => {
      onComplete();
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    }, 1500); // Wait for opacity transition (1.5s)
  };

  if (!isVisible) return null;

  return (
    <div 
      id="intro-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        transition: 'opacity 1.5s ease-out',
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none'
      }}
    >
      <canvas 
        ref={canvasRef}
        id="intro-canvas"
        style={{
          position: 'absolute',
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          zIndex: 1
        }}
      />
      
      <div 
        className="intro-content"
        style={{
          position: 'relative',
          zIndex: 2,
          textAlign: 'center',
          opacity: 0,
          animation: 'contentFadeIn 2s ease-out 1s forwards'
        }}
      >
        <div 
          className="eye-animation"
          style={{
            fontSize: '5rem',
            color: '#d4af37',
            marginBottom: '30px',
            filter: 'drop-shadow(0 0 20px #d4af37)',
            animation: 'pulseEye 2s infinite alternate'
          }}
        >
          <i 
            className="fas fa-eye"
            style={{
              fontFamily: 'FontAwesome'
            }}
          />
        </div>
        
        <div 
          className="intro-logo"
          style={{
            fontSize: '8rem',
            color: 'transparent',
            WebkitTextStroke: '2px #b8941f',
            position: 'relative',
            display: 'inline-block',
            marginBottom: '20px',
            fontFamily: 'Cinzel, serif',
            fontWeight: 700
          }}
        >
          THOTH
          <div
            style={{
              content: '"THOTH"',
              position: 'absolute',
              top: 0,
              left: 0,
              width: 0,
              height: '100%',
              color: '#d4af37',
              overflow: 'hidden',
              borderRight: '2px solid #d4af37',
              animation: 'fillText 3s cubic-bezier(0.7, 0, 0.3, 1) 1.5s forwards',
              whiteSpace: 'nowrap'
            }}
          >
            THOTH
          </div>
        </div>
        
        <div 
          className="intro-subtitle"
          style={{
            fontSize: '1.5rem',
            color: '#e8ddc8',
            letterSpacing: '5px',
            textTransform: 'uppercase',
            opacity: 0,
            transform: 'translateY(20px)',
            animation: 'slideUpFade 1s ease-out 4s forwards'
          }}
        >
          The Divine Intelligence
        </div>
      </div>
      
      <button 
        className="skip-intro"
        onClick={endIntro}
        style={{
          position: 'absolute',
          bottom: '30px',
          right: '30px',
          color: '#6d5c45',
          background: 'transparent',
          border: '1px solid #6d5c45',
          padding: '10px 20px',
          cursor: 'pointer',
          zIndex: 10,
          textTransform: 'uppercase',
          letterSpacing: '2px',
          transition: 'all 0.3s',
          fontFamily: 'Cinzel, serif'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#d4af37';
          e.currentTarget.style.borderColor = '#d4af37';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#6d5c45';
          e.currentTarget.style.borderColor = '#6d5c45';
        }}
      >
        Skip Intro
      </button>
      
      <style>{`
        @keyframes fillText { 
          0% { width: 0; } 
          100% { width: 100%; border-right: none; } 
        }
        @keyframes contentFadeIn { 
          to { opacity: 1; } 
        }
        @keyframes slideUpFade { 
          to { opacity: 1; transform: translateY(0); } 
        }
        @keyframes pulseEye { 
          from { transform: scale(1); opacity: 0.8; } 
          to { transform: scale(1.1); opacity: 1; filter: drop-shadow(0 0 40px #d4af37); } 
        }
      `}</style>
    </div>
  );
}
