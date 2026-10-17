import React, { useState, useEffect, useRef } from 'react';

// Ground covered by the body during one leg's stance phase (px).
// Leg length (~34px on screen) x sin(30deg) x 2. Tying the gait speed to this
// is what stops the feet from sliding (the "moonwalk" look).
const STEP_PX = 34;

const FunkoRunner = () => {
  const [speed, setSpeed] = useState(90); // pixels per second
  const [direction, setDirection] = useState('normal'); // 'normal' or 'reverse'
  const [isPaused, setIsPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  // Bouquet hand-over: 'idle' -> 'flying' -> 'delivered' -> 'idle'
  const [phase, setPhase] = useState('idle');
  const [arrived, setArrived] = useState(false);
  const [flyStart, setFlyStart] = useState(null);
  const spriteRef = useRef(null);
  const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Drives the bouquet flying toward the viewer
  useEffect(() => {
    if (phase !== 'flying') return;
    let raf2;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setArrived(true));
    });
    const t = setTimeout(() => setPhase('delivered'), 1400);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(t);
    };
  }, [phase]);

  const handleCharacterClick = () => {
    if (phase !== 'idle' || !spriteRef.current) return;
    const r = spriteRef.current.getBoundingClientRect();
    // Bouquet is drawn at ~59..139px (x) and 16..118px (y) inside the 150px sprite
    const left = r.left + (direction === 'normal' ? 59 : 150 - 139);
    const top = r.top + 16;
    setFlyStart({ left, top });
    setArrived(false);
    setPhase('flying');
  };

  const handleThanks = () => {
    setPhase('idle');
    setArrived(false);
  };

  const isMovingRight = direction === 'normal';
  // Character stands still while handing over the bouquet
  const play = isPaused || phase !== 'idle' ? 'paused' : 'running';

  const crossTime = (vw + 180) / speed; // seconds to cross the screen
  const cycle = (2 * STEP_PX) / speed;  // seconds per full gait cycle (2 steps)
  const half = cycle / 2;

  // "Don't want" pressed: remove the character, keep a tiny button to bring it back
  if (hidden) {
    return (
      <div style={{ ...controlBarStyle, padding: '4px 6px' }}>
        <button onClick={() => setHidden(false)} style={btnStyle}>
          👀 Show
        </button>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <style>{`
        /* Movement across screen */
        @keyframes runLeftToRight {
          0% { transform: translateX(-180px); }
          100% { transform: translateX(100vw); }
        }
        @keyframes runRightToLeft {
          0% { transform: translateX(100vw); }
          100% { transform: translateX(-180px); }
        }

        /* Body dips at double-support, rises at mid-stance (2 bobs per cycle) */
        @keyframes bodyBob {
          0%, 100% { transform: translateY(4.5px); }
          50% { transform: translateY(0px); }
        }

        @keyframes headTilt {
          0%, 100% { transform: rotate(-2deg); }
          50% { transform: rotate(2deg); }
        }

        /* Leg: foot on the ground moves BACKWARD at body speed (0-50%),
           then lifts and swings forward (50-100%) */
        @keyframes legCycle {
          0%   { transform: translateY(0px) rotate(-30deg); }
          50%  { transform: translateY(0px) rotate(30deg); }
          65%  { transform: translateY(-6px) rotate(12deg); }
          85%  { transform: translateY(-3px) rotate(-18deg); }
          100% { transform: translateY(0px) rotate(-30deg); }
        }

        /* Counter-rotation so the shoe stays flat on the ground */
        @keyframes footCycle {
          0%   { transform: rotate(30deg); }
          50%  { transform: rotate(-30deg); }
          65%  { transform: rotate(-12deg); }
          85%  { transform: rotate(18deg); }
          100% { transform: rotate(30deg); }
        }

        @keyframes armSwingL {
          0%   { transform: rotate(25deg); }
          100% { transform: rotate(-25deg); }
        }

        .funko-sprinter {
          animation: ${isMovingRight ? 'runLeftToRight' : 'runRightToLeft'} ${crossTime}s linear infinite;
          animation-play-state: ${play};
        }

        /* Flip sprite so the character always faces its direction of travel */
        .funko-flipper {
          width: 100%;
          height: 100%;
          transform: scaleX(${isMovingRight ? 1 : -1});
          transform-origin: center center;
        }

        .funko-body-bob {
          width: 100%;
          height: 100%;
          animation: bodyBob ${half}s ease-in-out infinite;
          animation-play-state: ${play};
        }

        .head-tilt {
          animation: headTilt ${half}s ease-in-out infinite alternate;
          transform-origin: 50px 70px;
          animation-play-state: ${play};
        }

        .anim-leg-l {
          animation: legCycle ${cycle}s linear infinite;
          transform-origin: 40px 98px;
          animation-play-state: ${play};
        }
        .anim-leg-r {
          animation: legCycle ${cycle}s linear infinite;
          animation-delay: -${half}s;
          transform-origin: 60px 98px;
          animation-play-state: ${play};
        }

        .anim-foot-l {
          animation: footCycle ${cycle}s linear infinite;
          transform-origin: 40px 126px;
          animation-play-state: ${play};
        }
        .anim-foot-r {
          animation: footCycle ${cycle}s linear infinite;
          animation-delay: -${half}s;
          transform-origin: 60px 126px;
          animation-play-state: ${play};
        }

        /* Back arm swings opposite to its same-side leg */
        .anim-arm-l {
          animation: armSwingL ${half}s ease-in-out infinite alternate;
          transform-origin: 32px 75px;
          animation-play-state: ${play};
        }

        /* Front arm holds the bouquet steady */
        .arm-hold {
          transform: rotate(-35deg);
          transform-origin: 68px 75px;
        }
      `}</style>

      {/* Controls Bar */}
      <div style={controlBarStyle}>
        <button onClick={() => setDirection(d => (d === 'normal' ? 'reverse' : 'normal'))} style={btnStyle}>
          🔄 Flip
        </button>
        <button onClick={() => setIsPaused(p => !p)} style={btnStyle}>
          {isPaused ? '▶️ Run' : '⏸️ Pause'}
        </button>
        <button onClick={() => setHidden(true)} style={{ ...btnStyle, background: '#6b7280' }}>
          🚫 Don't want
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#444' }}>
          <span>Speed:</span>
          <input
            type="range"
            min="50"
            max="220"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            style={{ width: '60px', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Ground Line (very bottom of the page) */}
      <div style={trackStyle} />

      {/* Character container: sits on the bottom edge of the page */}
      <div
        ref={spriteRef}
        className="funko-sprinter"
        onClick={handleCharacterClick}
        title="Click me!"
        style={{
          position: 'absolute',
          bottom: '2px',
          left: 0,
          width: '150px',
          height: '141px',
          pointerEvents: phase === 'idle' ? 'auto' : 'none',
          cursor: 'pointer',
        }}
      >
        <div className="funko-flipper">
          <div className="funko-body-bob">

            <svg width="150" height="141" viewBox="0 0 140 132" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible' }}>

              {/* BACK ARM */}
              <g className="anim-arm-l">
                <rect x="27" y="73" width="10" height="22" rx="5" fill="#00665c" />
                <circle cx="32" cy="98" r="5" fill="#d08b5b" />
              </g>

              {/* BACK LEG */}
              <g className="anim-leg-l">
                <rect x="35" y="96" width="10" height="30" rx="5" fill="#3a3028" />
                <g className="anim-foot-l">
                  <rect x="35" y="122" width="16" height="8" rx="4" fill="#111111" />
                </g>
              </g>

              {/* FRONT LEG */}
              <g className="anim-leg-r">
                <rect x="55" y="96" width="10" height="30" rx="5" fill="#4a3f35" />
                <g className="anim-foot-r">
                  <rect x="55" y="122" width="16" height="8" rx="4" fill="#111111" />
                </g>
              </g>

              {/* TORSO / SHIRT */}
              <rect x="30" y="68" width="40" height="32" rx="8" fill="#008080" />
              <line x1="30" y1="74" x2="70" y2="74" stroke="#e0f2f1" strokeWidth="2" />
              <line x1="30" y1="80" x2="70" y2="80" stroke="#e0f2f1" strokeWidth="2" />
              <line x1="30" y1="86" x2="70" y2="86" stroke="#e0f2f1" strokeWidth="2" />
              <line x1="30" y1="92" x2="70" y2="92" stroke="#e0f2f1" strokeWidth="2" />

              {/* SILVER CHAIN & RING PENDANT */}
              <path d="M 40 68 Q 50 82 60 68" stroke="#d1d5db" strokeWidth="2" fill="none" />
              <circle cx="50" cy="78" r="3.5" stroke="#d1d5db" strokeWidth="1.5" fill="none" />

              {/* FRONT ARM (holding bouquet, steady) */}
              <g className="arm-hold">
                <rect x="63" y="73" width="10" height="22" rx="5" fill="#008080" />
                <circle cx="68" cy="98" r="5" fill="#e09f67" />
              </g>

              {/* OVERSIZED FUNKO HEAD */}
              <g className="head-tilt">
                <rect x="12" y="10" width="76" height="58" rx="20" fill="#e09f67" />

                {/* Curly Hair */}
                <path d="M 10 30 Q 10 8 50 8 Q 90 8 90 30 Q 82 14 70 14 Q 60 14 50 10 Q 40 14 30 14 Q 18 14 10 30 Z" fill="#1c1917" />
                <circle cx="16" cy="18" r="8" fill="#1c1917" />
                <circle cx="30" cy="12" r="9" fill="#1c1917" />
                <circle cx="50" cy="10" r="10" fill="#1c1917" />
                <circle cx="70" cy="12" r="9" fill="#1c1917" />
                <circle cx="84" cy="18" r="8" fill="#1c1917" />

                {/* Eyebrows */}
                <path d="M 24 32 Q 32 29 40 33" stroke="#1c1917" strokeWidth="3" strokeLinecap="round" fill="none" />
                <path d="M 60 33 Q 68 29 76 32" stroke="#1c1917" strokeWidth="3" strokeLinecap="round" fill="none" />

                {/* Eyes */}
                <circle cx="33" cy="42" r="7.5" fill="#1a1a1a" />
                <circle cx="35" cy="40" r="2.5" fill="#ffffff" />
                <circle cx="67" cy="42" r="7.5" fill="#1a1a1a" />
                <circle cx="69" cy="40" r="2.5" fill="#ffffff" />

                {/* Nose & Mustache */}
                <ellipse cx="50" cy="46" rx="2" ry="1.5" fill="#c07d4b" />
                <path d="M 43 52 Q 50 50 57 52" stroke="#1c1917" strokeWidth="2.5" strokeLinecap="round" fill="none" />

                {/* Smile */}
                <path d="M 44 55 Q 50 60 56 55" stroke="#1c1917" strokeWidth="2" strokeLinecap="round" fill="none" />
              </g>

              {/* BOUQUET HELD IN FRONT (leaves his hand when given) */}
              {phase === 'idle' && (
                <image
                  href="/bouquet.png"
                  x="55"
                  y="15"
                  width="75"
                  height="95"
                  preserveAspectRatio="xMidYMid meet"
                />
              )}

            </svg>

          </div>
        </div>
      </div>

      {/* Bouquet flying from his hand to the middle of the screen */}
      {phase !== 'idle' && flyStart && (
        <img
          src="/bouquet.png"
          alt="Bouquet"
          style={{
            position: 'fixed',
            left: flyStart.left,
            top: flyStart.top,
            width: 80,
            height: 102,
            objectFit: 'contain',
            zIndex: 1000001,
            pointerEvents: 'none',
            transformOrigin: 'center center',
            transition: 'transform 1.3s cubic-bezier(0.22, 1, 0.36, 1)',
            transform: arrived
              ? `translate(${vw / 2 - (flyStart.left + 40)}px, ${window.innerHeight / 2 - 40 - (flyStart.top + 51)}px) scale(2.6) rotate(-6deg)`
              : 'translate(0px, 0px) scale(1) rotate(0deg)',
          }}
        />
      )}

      {phase === 'delivered' && (
        <div
          style={{
            position: 'fixed',
            top: 'calc(50% + 110px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000002,
            pointerEvents: 'auto',
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #ffd1dc',
            borderRadius: '16px',
            padding: '10px 18px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ff4d6d', marginBottom: '8px' }}>
            💐 This is for you!
          </div>
          <button onClick={handleThanks} style={btnStyle}>
            Thank you 💖
          </button>
        </div>
      )}
    </div>
  );
};

/* Styles */
const containerStyle = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  width: '100vw',
  height: '160px',
  pointerEvents: 'none',
  zIndex: 999999,
  overflow: 'visible',
};

const trackStyle = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  width: '100%',
  height: '2px',
  background: 'rgba(255, 77, 109, 0.25)',
};

// Moved to the top-right so the walking character never passes behind it
const controlBarStyle = {
  position: 'fixed',
  top: '10px',
  right: '10px',
  pointerEvents: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  background: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(6px)',
  padding: '4px 10px',
  borderRadius: '16px',
  boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
  border: '1px solid #ffd1dc',
  zIndex: 1000000,
};

const btnStyle = {
  background: '#ff4d6d',
  color: 'white',
  border: 'none',
  borderRadius: '10px',
  padding: '4px 8px',
  fontSize: '11px',
  fontWeight: 'bold',
  cursor: 'pointer',
};

export default FunkoRunner;