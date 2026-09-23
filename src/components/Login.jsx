import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

/* ── Particle canvas ────────────────────────────────────── */
function ParticleCanvas() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    /* Create particles */
    const TOTAL = 72;
    const particles = Array.from({ length: TOTAL }, () => ({
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height,
      r:     Math.random() * 1.6 + 0.3,
      alpha: Math.random() * 0.45 + 0.05,
      vx:    (Math.random() - 0.5) * 0.22,
      vy:    (Math.random() - 0.5) * 0.22,
      twinkleSpeed: Math.random() * 0.018 + 0.006,
      twinkleDir: Math.random() > 0.5 ? 1 : -1,
      baseAlpha: 0,
    }));
    particles.forEach(p => { p.baseAlpha = p.alpha; });

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        /* Twinkle */
        p.alpha += p.twinkleSpeed * p.twinkleDir;
        if (p.alpha > p.baseAlpha + 0.18 || p.alpha < p.baseAlpha - 0.12) {
          p.twinkleDir *= -1;
        }
        /* Drift */
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 220, 130, ${Math.max(0, p.alpha)})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}
    />
  );
}

/* ── Main component ─────────────────────────────────────── */
export const Login = () => {
  const { loginWithGoogle, error } = useAuth();
  const [ready, setReady] = useState(false);
  const [btnHover, setBtnHover] = useState(false);

  /* Stagger mount — trigger CSS animations after first paint */
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {/* ── All keyframes ── */}
      <style>{`
        @keyframes orb-float-a {
          0%   { transform: translate(0px,   0px)  scale(1);    }
          33%  { transform: translate(50px, -30px) scale(1.06); }
          66%  { transform: translate(-20px, 40px) scale(0.96); }
          100% { transform: translate(0px,   0px)  scale(1);    }
        }
        @keyframes orb-float-b {
          0%   { transform: translate(0px,  0px)   scale(1);    }
          40%  { transform: translate(-45px, 25px) scale(1.08); }
          70%  { transform: translate(30px, -35px) scale(0.94); }
          100% { transform: translate(0px,  0px)   scale(1);    }
        }
        @keyframes orb-float-c {
          0%   { transform: translate(0px, 0px)  scale(1);    }
          50%  { transform: translate(25px, 45px) scale(1.05); }
          100% { transform: translate(0px, 0px)  scale(1);    }
        }
        @keyframes logo-pop {
          0%   { opacity:0; transform: scale(0.6) translateY(12px); }
          60%  { transform: scale(1.08) translateY(-4px); }
          100% { opacity:1; transform: scale(1)   translateY(0); }
        }
        @keyframes logo-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0), 0 8px 32px rgba(245,158,11,0.35); }
          50%     { box-shadow: 0 0 0 12px rgba(245,158,11,0.12), 0 8px 40px rgba(245,158,11,0.5); }
        }
        @keyframes slide-up {
          from { opacity:0; transform: translateY(22px); }
          to   { opacity:1; transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity:0; }
          to   { opacity:1; }
        }
        @keyframes card-in {
          from { opacity:0; transform: translateY(36px) scale(0.96); }
          to   { opacity:1; transform: translateY(0)    scale(1); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes divider-grow {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes ring-spin {
          to { transform: rotate(360deg); }
        }

        .login-btn-google {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 0.95rem 1.5rem;
          font-size: 0.97rem;
          font-weight: 700;
          font-family: var(--font-body);
          color: var(--text-main);
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.13);
          border-radius: 14px;
          cursor: pointer;
          letter-spacing: 0.01em;
          position: relative;
          overflow: hidden;
          transition: border-color 0.25s ease, transform 0.2s ease, box-shadow 0.25s ease;
          box-shadow: 0 2px 12px rgba(0,0,0,0.25);
        }
        .login-btn-google::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg,
            transparent 0%,
            rgba(255,255,255,0.07) 40%,
            rgba(255,220,100,0.12) 50%,
            rgba(255,255,255,0.07) 60%,
            transparent 100%
          );
          background-size: 200% auto;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .login-btn-google:hover {
          border-color: rgba(245,158,11,0.5);
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(245,158,11,0.22), 0 2px 12px rgba(0,0,0,0.3);
        }
        .login-btn-google:hover::before {
          opacity: 1;
          animation: shimmer 1.6s linear infinite;
        }
        .login-btn-google:active {
          transform: translateY(0) scale(0.98);
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }

        /* Animated arc ring around logo */
        @keyframes arc-rotate {
          to { stroke-dashoffset: -502; }
        }
      `}</style>

      {/* ── Background layers ── */}
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 100% 60% at 50% -5%, rgba(245,158,11,0.22) 0%, transparent 65%), var(--bg-deep)', zIndex: 0 }} />

      {/* Animated orbs */}
      <div style={{
        position:'fixed', width:'600px', height:'600px', borderRadius:'50%',
        background:'radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 68%)',
        top:'-180px', left:'-160px', pointerEvents:'none', zIndex:0,
        animation:'orb-float-a 20s ease-in-out infinite',
      }} />
      <div style={{
        position:'fixed', width:'500px', height:'500px', borderRadius:'50%',
        background:'radial-gradient(circle, rgba(96,165,250,0.09) 0%, transparent 68%)',
        bottom:'-120px', right:'-120px', pointerEvents:'none', zIndex:0,
        animation:'orb-float-b 25s ease-in-out infinite',
      }} />
      <div style={{
        position:'fixed', width:'320px', height:'320px', borderRadius:'50%',
        background:'radial-gradient(circle, rgba(167,139,250,0.08) 0%, transparent 68%)',
        top:'40%', right:'15%', pointerEvents:'none', zIndex:0,
        animation:'orb-float-c 18s ease-in-out infinite',
      }} />

      {/* Dot grid */}
      <div style={{
        position:'fixed', inset:0, pointerEvents:'none', zIndex:0,
        backgroundImage:'radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)',
        backgroundSize:'44px 44px',
        maskImage:'radial-gradient(ellipse 70% 70% at 50% 50%, black 20%, transparent 100%)',
      }} />

      {/* Twinkling star particles */}
      <ParticleCanvas />

      {/* ── Card ── */}
      <div style={{
        position:'fixed', inset:0, display:'flex',
        alignItems:'center', justifyContent:'center',
        zIndex:10, padding:'1.25rem',
      }}>
        <div style={{
          width:'100%', maxWidth:'410px',
          padding:'2.75rem 2.25rem 2.25rem',
          background:'rgba(255,255,255,0.055)',
          backdropFilter:'blur(32px) saturate(200%)',
          WebkitBackdropFilter:'blur(32px) saturate(200%)',
          borderRadius:'28px',
          border:'1px solid rgba(255,255,255,0.10)',
          boxShadow:'0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 1px 0 rgba(255,255,255,0.13) inset',
          textAlign:'center',
          opacity: ready ? undefined : 0,
          animation: ready ? 'card-in 0.7s cubic-bezier(0.22,1,0.36,1) both' : 'none',
        }}>

          {/* ── Logo with animated SVG ring ── */}
          <div style={{ position:'relative', width:'90px', height:'90px', margin:'0 auto 1.5rem', animation: ready ? 'logo-pop 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.15s both' : 'none' }}>
            {/* Rotating arc */}
            <svg
              style={{ position:'absolute', inset:'-10px', width:'110px', height:'110px', pointerEvents:'none' }}
              viewBox="0 0 110 110"
            >
              <circle cx="55" cy="55" r="50"
                fill="none"
                stroke="rgba(245,158,11,0.18)"
                strokeWidth="1.5"
              />
              <circle cx="55" cy="55" r="50"
                fill="none"
                stroke="rgba(245,158,11,0.75)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="40 274"
                style={{ animation:'ring-spin 3.5s linear infinite', transformOrigin:'55px 55px' }}
              />
            </svg>

            {/* Logo box */}
            <div style={{
              width:'90px', height:'90px',
              borderRadius:'24px',
              background:'linear-gradient(145deg, #F59E0B 0%, #B45309 100%)',
              display:'flex', alignItems:'center', justifyContent:'center',
              padding:'15px',
              boxShadow:'0 0 0 1px rgba(245,158,11,0.25) inset',
              animation:'logo-pulse 3s ease-in-out 1s infinite',
            }}>
              <img src="/logo.svg" alt="WrapTime" style={{ width:'100%', height:'100%' }} />
            </div>
          </div>

          {/* ── Brand ── */}
          <h1 style={{
            fontSize:'2.4rem', fontWeight:800,
            fontFamily:'var(--font-heading)',
            background:'linear-gradient(135deg, #FFFFFF 20%, #FDE68A 70%, #F59E0B 100%)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
            letterSpacing:'-0.5px', lineHeight:1.1,
            marginBottom:'0.3rem',
            animation: ready ? 'slide-up 0.55s ease 0.3s both' : 'none',
          }}>
            WrapTime
          </h1>

          <p style={{
            fontSize:'0.93rem', fontWeight:600, color:'var(--primary)',
            marginBottom:'0.55rem', letterSpacing:'0.02em',
            animation: ready ? 'slide-up 0.55s ease 0.4s both' : 'none',
          }}>
            Wraperia Suppa Kebs
          </p>

          <p style={{
            fontSize:'0.81rem', color:'var(--text-muted)',
            marginBottom:'2.1rem', lineHeight:1.6,
            animation: ready ? 'slide-up 0.55s ease 0.5s both' : 'none',
          }}>
            Shift scheduling &amp; workforce management<br />
            for 5 restaurant branches in Lithuania.
          </p>

          {/* ── Error ── */}
          {error && (
            <div style={{
              background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.28)',
              color:'var(--danger)', padding:'0.65rem 0.9rem', borderRadius:'10px',
              marginBottom:'1.1rem', fontSize:'0.83rem', textAlign:'left',
              display:'flex', alignItems:'center', gap:'0.45rem',
              animation:'fade-in 0.35s ease both',
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* ── Divider ── */}
          <div style={{
            display:'flex', alignItems:'center', gap:'0.7rem',
            marginBottom:'1.3rem', color:'var(--text-subtle)',
            fontSize:'0.71rem', letterSpacing:'0.09em', textTransform:'uppercase',
            animation: ready ? 'fade-in 0.5s ease 0.6s both' : 'none',
          }}>
            <span style={{
              flex:1, height:'1px',
              background:'linear-gradient(to right, transparent, rgba(255,255,255,0.12))',
              transformOrigin:'right',
              animation: ready ? 'divider-grow 0.6s ease 0.7s both' : 'none',
            }} />
            <span>sign in to continue</span>
            <span style={{
              flex:1, height:'1px',
              background:'linear-gradient(to left, transparent, rgba(255,255,255,0.12))',
              transformOrigin:'left',
              animation: ready ? 'divider-grow 0.6s ease 0.7s both' : 'none',
            }} />
          </div>

          {/* ── Google Button ── */}
          <div style={{ animation: ready ? 'slide-up 0.5s ease 0.7s both' : 'none' }}>
            <button className="login-btn-google" onClick={loginWithGoogle}>
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>

          {/* ── Footer ── */}
          <p style={{
            marginTop:'1.5rem', fontSize:'0.71rem', color:'var(--text-subtle)',
            letterSpacing:'0.04em',
            animation: ready ? 'fade-in 0.5s ease 0.9s both' : 'none',
          }}>
            WrapTime v1.0 &nbsp;·&nbsp; Lithuania
          </p>
        </div>
      </div>
    </>
  );
};
