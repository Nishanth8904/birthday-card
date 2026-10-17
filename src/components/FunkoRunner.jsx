import React, { useState, useEffect, useRef, useMemo } from 'react';

// Ground covered by the body during one leg's stance phase (px).
// Tying the gait speed to this stops the feet from sliding (the "moonwalk" look).
const STEP_PX = 34;
const SPRITE_W = 150;
const SPRITE_H = 141;
// Distance between the two sprites' left edges when they meet
const PARTNER_GAP = 100;

// Partner colours
const C = {
  skin: '#d9a47c',
  skinShade: '#c8946b',
  hair: '#17151d',
  hairShine: '#3b3750',
  dress: '#5f6f35',
  dressDark: '#4b5829',
  shoe: '#3d2b22',
  gold: '#e0b95a',
};

// Walk-cycle CSS for one character. `p` is a class prefix ("h-" hero, "p-" partner).
const gaitCss = (p, cycle, half, play) => `
  .${p}body-bob {
    width: 100%; height: 100%;
    animation: bodyBob ${half}s ease-in-out infinite;
    animation-play-state: ${play};
  }
  .${p}head-tilt {
    animation: headTilt ${half}s ease-in-out infinite alternate;
    transform-origin: 50px 70px;
    animation-play-state: ${play};
  }
  .${p}leg-l {
    animation: legCycle ${cycle}s linear infinite;
    transform-origin: 40px 98px;
    animation-play-state: ${play};
  }
  .${p}leg-r {
    animation: legCycle ${cycle}s linear infinite;
    animation-delay: -${half}s;
    transform-origin: 60px 98px;
    animation-play-state: ${play};
  }
  .${p}foot-l {
    animation: footCycle ${cycle}s linear infinite;
    transform-origin: 40px 126px;
    animation-play-state: ${play};
  }
  .${p}foot-r {
    animation: footCycle ${cycle}s linear infinite;
    animation-delay: -${half}s;
    transform-origin: 60px 126px;
    animation-play-state: ${play};
  }
  .${p}arm-l {
    animation: armSwingL ${half}s ease-in-out infinite alternate;
    transform-origin: 32px 75px;
    animation-play-state: ${play};
  }
  .${p}arm-r {
    animation: armSwingR ${half}s ease-in-out infinite alternate;
    transform-origin: 68px 75px;
    animation-play-state: ${play};
  }
  /* Standing still: neutral pose instead of freezing mid-stride */
  .${p}stand .${p}body-bob,
  .${p}stand .${p}head-tilt,
  .${p}stand .${p}leg-l,
  .${p}stand .${p}leg-r,
  .${p}stand .${p}foot-l,
  .${p}stand .${p}foot-r,
  .${p}stand .${p}arm-l,
  .${p}stand .${p}arm-r {
    animation: none;
  }
`;

export default function FunkoRunner({
  message = 'This is for you! 💖',
  bubbleText = 'Click me! 💐',
  afterThanksText = 'adei nilra vaanguna odanae odra paaru!! NILRAAA',
}) {
  const [speed, setSpeed] = useState(90); // pixels per second
  const [direction, setDirection] = useState('normal'); // 'normal' or 'reverse'
  const [isPaused, setIsPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  // Meeting scene: 'idle' -> 'approach' -> 'give' -> 'delivered' -> 'leave' -> 'idle'
  const [phase, setPhase] = useState('idle');
  const [scene, setScene] = useState(null);
  const [arrived, setArrived] = useState(false); // bouquet transfer in progress
  const [partnerHas, setPartnerHas] = useState(false);
  const [heroHas, setHeroHas] = useState(true); // false after he has given the bouquet away
  const [heroFace, setHeroFace] = useState(null); // 'right' | 'left' | null (null = direction of travel)
  const [showAfterThanks, setShowAfterThanks] = useState(false);

  const spriteRef = useRef(null);
  const partnerRef = useRef(null);
  const heroEyesRef = useRef(null);
  const partnerEyesRef = useRef(null);
  const faceRef = useRef({ hero: true, partner: false });

  // Hearts/petals that burst out when the bouquet is handed over
  const hearts = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        emoji: ['💖', '💗', '🌸', '✨', '💐'][i % 5],
        dx: (Math.random() - 0.5) * 460,
        dy: 140 + Math.random() * 240,
        delay: Math.random() * 0.7,
        size: 18 + Math.random() * 18,
      })),
    []
  );

  const isMovingRight = direction === 'normal';
  const heroFaceRight = heroFace ? heroFace === 'right' : isMovingRight;
  // Partner faces the hero while walking in / standing, and faces away when leaving
  const partnerFaceRight = scene ? (phase === 'leave' ? scene.side === 1 : scene.side === -1) : false;
  faceRef.current = { hero: heroFaceRight, partner: partnerFaceRight };

  const sceneStopsHero = phase === 'approach' || phase === 'give' || phase === 'delivered';
  const heroStanding = hovered || sceneStopsHero;
  const partnerStanding = phase === 'give' || phase === 'delivered';
  const movePlay = isPaused || hovered || sceneStopsHero ? 'paused' : 'running';
  const heroHasBouquet = heroHas && (phase === 'idle' || phase === 'approach');

  const crossTime = (vw + 180) / speed; // seconds to cross the screen
  const cycle = (2 * STEP_PX) / speed; // seconds per full gait cycle (2 steps)
  const half = cycle / 2;

  // Partner walks a bit faster so you're not waiting long
  const pv = Math.max(speed, 150);
  const pCycle = (2 * STEP_PX) / pv;
  const pHalf = pCycle / 2;
  const walkSecs = scene ? Math.abs(scene.startX - scene.targetX) / pv : 0;

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Eyes follow the cursor (both characters)
  useEffect(() => {
    const look = (spriteEl, eyesEl, faceRight, e) => {
      if (!spriteEl || !eyesEl) return;
      const r = spriteEl.getBoundingClientRect();
      const cx = r.left + (faceRight ? 54 : 96);
      const cy = r.top + 43;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, dist / 160);
      let ox = (dx / dist) * k * 3;
      const oy = (dy / dist) * k * 2.2;
      if (!faceRight) ox = -ox; // sprite is mirrored
      eyesEl.setAttribute('transform', `translate(${ox.toFixed(2)} ${oy.toFixed(2)})`);
    };
    const onMove = (e) => {
      look(spriteRef.current, heroEyesRef.current, faceRef.current.hero, e);
      look(partnerRef.current, partnerEyesRef.current, faceRef.current.partner, e);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const finishScene = () => {
    setPhase('idle');
    setScene(null);
    setPartnerHas(false);
    setHeroFace(null);
    setArrived(false);
  };

  // approach -> give (fallback timer in case animationend never fires), leave -> idle
  useEffect(() => {
    if (!scene) return;
    if (phase === 'approach') {
      const t = setTimeout(() => setPhase((p) => (p === 'approach' ? 'give' : p)), walkSecs * 1000 + 250);
      return () => clearTimeout(t);
    }
    if (phase === 'leave') {
      const t = setTimeout(() => {
        finishScene();
      }, walkSecs * 1000 + 250);
      return () => clearTimeout(t);
    }
  }, [phase, scene, walkSecs]);

  // give: bouquet moves from his hand to hers, then hearts + card
  useEffect(() => {
    if (phase !== 'give') return;
    setHeroHas(false); // the bouquet has left his hand
    let raf2;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setArrived(true));
    });
    const t = setTimeout(() => {
      setPartnerHas(true);
      setPhase('delivered');
    }, 1000);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(t);
    };
  }, [phase]);

  // He's empty-handed after giving the bouquet; he picks up a new one a few seconds after she's gone
  useEffect(() => {
    if (heroHas || phase !== 'idle') return;
    const t = setTimeout(() => {
      setHeroHas(true);
      setShowAfterThanks(false);
    }, 4000);
    return () => clearTimeout(t);
  }, [heroHas, phase]);

  const handleCharacterClick = () => {
    if (phase !== 'idle' || !heroHas || !spriteRef.current) return;
    setShowAfterThanks(false);
    const r = spriteRef.current.getBoundingClientRect();

    // She comes from the side he is facing; if there's no room, from the other side
    let side = isMovingRight ? 1 : -1; // 1 = enters from the right, -1 = from the left
    const fits = (s) => (s === 1 ? r.left + PARTNER_GAP + SPRITE_W <= vw : r.left - PARTNER_GAP >= 0);
    if (!fits(side) && fits(-side)) side = -side;

    let targetX = side === 1 ? r.left + PARTNER_GAP : r.left - PARTNER_GAP;
    targetX = Math.max(-20, Math.min(vw - SPRITE_W + 20, targetX));
    const startX = side === 1 ? vw + 20 : -SPRITE_W - 20;

    setScene({
      side,
      top: r.top,
      targetX,
      startX,
      bouquetFrom: r.left + (side === 1 ? 59 : 11),
      bouquetTo: targetX + (side === 1 ? 11 : 59),
      mid: (r.left + targetX) / 2 + SPRITE_W / 2,
    });
    setHeroFace(side === 1 ? 'right' : 'left');
    setArrived(false);
    setPartnerHas(false);
    setPhase('approach');
  };

  const handlePartnerAnimEnd = (e) => {
    if (e.animationName === 'partnerIn') setPhase((p) => (p === 'approach' ? 'give' : p));
    if (e.animationName === 'partnerOut') finishScene();
  };

  const handleThanks = () => {
    setHovered(false);
    setHeroFace(null);
    setArrived(false);
    setShowAfterThanks(true);
    setPhase('leave');
  };

  if (hidden) {
    return (
      <div style={{ ...controlBarStyle, padding: '4px 6px' }}>
        <button onClick={() => setHidden(false)} style={btnStyle}>
          👀 Show
        </button>
      </div>
    );
  }

  const partnerAnimation =
    phase === 'approach'
      ? `partnerIn ${walkSecs}s linear forwards`
      : phase === 'leave'
      ? `partnerOut ${walkSecs}s linear forwards`
      : 'none';
  const cardX = scene ? Math.max(150, Math.min(vw - 150, scene.mid)) : vw / 2;

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

        ${
          scene
            ? `
        @keyframes partnerIn {
          from { transform: translateX(${scene.startX}px); }
          to   { transform: translateX(${scene.targetX}px); }
        }
        @keyframes partnerOut {
          from { transform: translateX(${scene.targetX}px); }
          to   { transform: translateX(${scene.startX}px); }
        }`
            : ''
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

        /* Leg walk cycle */
        @keyframes legCycle {
          0%   { transform: translateY(0px) rotate(-30deg); }
          50%  { transform: translateY(0px) rotate(30deg); }
          65%  { transform: translateY(-6px) rotate(12deg); }
          85%  { transform: translateY(-3px) rotate(-18deg); }
          100% { transform: translateY(0px) rotate(-30deg); }
        }

        /* Counter-rotation for shoes */
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
        @keyframes armSwingR {
          0%   { transform: rotate(-25deg); }
          100% { transform: rotate(25deg); }
        }

        @keyframes heartFloat {
          0%   { opacity: 0; transform: translate(0, 0) scale(0.4); }
          15%  { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--dx), calc(var(--dy) * -1)) scale(1.2) rotate(20deg); }
        }

        @keyframes bubblePop {
          0%, 100% { opacity: 0; transform: translate(-50%, 6px); }
          6%, 40%  { opacity: 1; transform: translate(-50%, 0); }
          46%      { opacity: 0; transform: translate(-50%, 6px); }
        }

        @keyframes popupBounce {
          0% {
            opacity: 0;
            transform: translateX(-50%) scale(0.3) translateY(20px);
          }
          65% {
            opacity: 1;
            transform: translateX(-50%) scale(1.08) translateY(-6px);
          }
          85% {
            transform: translateX(-50%) scale(0.96) translateY(2px);
          }
          100% {
            opacity: 1;
            transform: translateX(-50%) scale(1) translateY(0);
          }
        }

        .speech-bubble {
          position: absolute;
          top: -30px;
          left: 50%;
          white-space: nowrap;
          background: #fff;
          border: 1px solid #ffd1dc;
          border-radius: 12px;
          padding: 3px 9px;
          font: bold 11px sans-serif;
          color: #ff4d6d;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
          opacity: 0;
          pointer-events: none;
          animation: bubblePop 7s ease-in-out infinite;
          animation-play-state: ${movePlay};
        }

        .speech-bubble-visible {
          position: absolute;
          top: -30px;
          left: 50%;
          transform: translateX(-50%);
          white-space: nowrap;
          background: #fff;
          border: 1px solid #ffd1dc;
          border-radius: 12px;
          padding: 3px 9px;
          font: bold 11px sans-serif;
          color: #ff4d6d;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
          opacity: 1;
          pointer-events: none;
        }

        .popup-delivered-text {
          animation: popupBounce 0.55s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }

        .funko-sprinter {
          animation: ${isMovingRight ? 'runLeftToRight' : 'runRightToLeft'} ${crossTime}s linear infinite;
          animation-play-state: ${movePlay};
        }

        .funko-flipper {
          width: 100%;
          height: 100%;
          transform: scaleX(${heroFaceRight ? 1 : -1});
          transform-origin: center center;
        }

        ${gaitCss('h-', cycle, half, movePlay)}
        ${gaitCss('p-', pCycle, pHalf, 'running')}

        .arm-hold {
          transform: rotate(-35deg);
          transform-origin: 68px 75px;
        }
      `}</style>

      {/* Controls Bar */}
      <div style={controlBarStyle}>
        <button onClick={() => setDirection((d) => (d === 'normal' ? 'reverse' : 'normal'))} style={btnStyle}>
          🔄 Flip
        </button>
        <button onClick={() => setIsPaused((p) => !p)} style={btnStyle}>
          {isPaused ? '▶️ Run' : '⏸️ Pause'}
        </button>
        <button
          onClick={() => {
            finishScene();
            setHidden(true);
          }}
          style={{ ...btnStyle, background: '#6b7280' }}
        >
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

      {/* Ground Line */}
      <div style={trackStyle} />

      {/* ───────────── HERO ───────────── */}
      <div
        ref={spriteRef}
        className={`funko-sprinter${heroStanding ? ' h-stand' : ''}`}
        onClick={handleCharacterClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title="Click me!"
        style={{
          position: 'absolute',
          bottom: '2px',
          left: 0,
          width: `${SPRITE_W}px`,
          height: `${SPRITE_H}px`,
          pointerEvents: phase === 'idle' ? 'auto' : 'none',
          cursor: heroHas ? 'pointer' : 'default',
        }}
      >
        {/* Initial Click me speech bubble */}
        {phase === 'idle' && heroHas && !showAfterThanks && <div className="speech-bubble">{bubbleText}</div>}

        {/* After clicking Thank You speech bubble */}
        {showAfterThanks && <div className="speech-bubble-visible">{afterThanksText}</div>}

        <div className="funko-flipper">
          <div className="h-body-bob">
            <svg width="150" height="141" viewBox="0 0 140 132" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible' }}>
              {/* BACK ARM */}
              <g className="h-arm-l">
                <rect x="27" y="73" width="10" height="22" rx="5" fill="#00665c" />
                <circle cx="32" cy="98" r="5" fill="#d08b5b" />
              </g>

              {/* BACK LEG */}
              <g className="h-leg-l">
                <rect x="35" y="96" width="10" height="30" rx="5" fill="#3a3028" />
                <g className="h-foot-l">
                  <rect x="35" y="122" width="16" height="8" rx="4" fill="#111111" />
                </g>
              </g>

              {/* FRONT LEG */}
              <g className="h-leg-r">
                <rect x="55" y="96" width="10" height="30" rx="5" fill="#4a3f35" />
                <g className="h-foot-r">
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

              {/* FRONT ARM */}
              <g className="arm-hold">
                <rect x="63" y="73" width="10" height="22" rx="5" fill="#008080" />
                <circle cx="68" cy="98" r="5" fill="#e09f67" />
              </g>

              {/* OVERSIZED FUNKO HEAD */}
              <g className="h-head-tilt">
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

                {/* Eyes (follow the cursor) */}
                <g ref={heroEyesRef}>
                  <circle cx="33" cy="42" r="7.5" fill="#1a1a1a" />
                  <circle cx="35" cy="40" r="2.5" fill="#ffffff" />
                  <circle cx="67" cy="42" r="7.5" fill="#1a1a1a" />
                  <circle cx="69" cy="40" r="2.5" fill="#ffffff" />
                </g>

                {/* Nose & Mustache */}
                <ellipse cx="50" cy="46" rx="2" ry="1.5" fill="#c07d4b" />
                <path d="M 43 52 Q 50 50 57 52" stroke="#1c1917" strokeWidth="2.5" strokeLinecap="round" fill="none" />

                {/* Smile */}
                <path d="M 44 55 Q 50 60 56 55" stroke="#1c1917" strokeWidth="2" strokeLinecap="round" fill="none" />
              </g>

              {/* BOUQUET HELD IN FRONT */}
              {heroHasBouquet && !imgFailed && (
                <image
                  href="/bouquet.png"
                  x="55"
                  y="15"
                  width="75"
                  height="95"
                  preserveAspectRatio="xMidYMid meet"
                  onError={() => setImgFailed(true)}
                />
              )}
              {heroHasBouquet && imgFailed && (
                <text x="62" y="92" fontSize="56">
                  💐
                </text>
              )}
            </svg>
          </div>
        </div>
      </div>

      {/* ───────────── PARTNER ───────────── */}
      {scene && phase !== 'idle' && (
        <div
          ref={partnerRef}
          className={`partner-sprite${partnerStanding ? ' p-stand' : ''}`}
          onAnimationEnd={handlePartnerAnimEnd}
          style={{
            position: 'absolute',
            bottom: '2px',
            left: 0,
            width: `${SPRITE_W}px`,
            height: `${SPRITE_H}px`,
            pointerEvents: 'none',
            transform: `translateX(${partnerStanding || phase === 'delivered' ? scene.targetX : scene.startX}px)`,
            animation: partnerAnimation,
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              transform: `scaleX(${partnerFaceRight ? 1 : -1})`,
              transformOrigin: 'center center',
            }}
          >
            <div className="p-body-bob">
              <svg width="150" height="141" viewBox="0 0 140 132" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible' }}>
                {/* BACK ARM */}
                <g className="p-arm-l">
                  <rect x="27" y="73" width="10" height="22" rx="5" fill={C.skinShade} />
                  <circle cx="32" cy="98" r="5" fill={C.skinShade} />
                </g>

                {/* BACK LEG */}
                <g className="p-leg-l">
                  <rect x="35" y="96" width="10" height="30" rx="5" fill={C.skinShade} />
                  <g className="p-foot-l">
                    <rect x="35" y="122" width="16" height="8" rx="4" fill={C.shoe} />
                  </g>
                </g>

                {/* FRONT LEG */}
                <g className="p-leg-r">
                  <rect x="55" y="96" width="10" height="30" rx="5" fill={C.skin} />
                  <g className="p-foot-r">
                    <rect x="55" y="122" width="16" height="8" rx="4" fill={C.shoe} />
                  </g>
                </g>

                {/* OLIVE-GREEN DRESS */}
                <rect x="30" y="68" width="40" height="30" rx="8" fill={C.dress} />
                <path d="M 30 90 L 25 114 Q 50 121 75 114 L 70 90 Z" fill={C.dress} />
                <rect x="30" y="84" width="40" height="8" fill={C.dressDark} />
                <line x1="36" y1="84" x2="36" y2="92" stroke={C.dress} strokeWidth="1.2" />
                <line x1="43" y1="84" x2="43" y2="92" stroke={C.dress} strokeWidth="1.2" />
                <line x1="50" y1="84" x2="50" y2="92" stroke={C.dress} strokeWidth="1.2" />
                <line x1="57" y1="84" x2="57" y2="92" stroke={C.dress} strokeWidth="1.2" />
                <line x1="64" y1="84" x2="64" y2="92" stroke={C.dress} strokeWidth="1.2" />
                <path d="M 40 94 L 38 114" stroke={C.dressDark} strokeWidth="1" opacity="0.6" />
                <path d="M 60 94 L 62 114" stroke={C.dressDark} strokeWidth="1" opacity="0.6" />
                <path d="M 39 68 L 61 68 L 50 84 Z" fill={C.skin} />
                <path d="M 40.5 68 Q 50 82 59.5 68" stroke={C.gold} strokeWidth="1.3" fill="none" />
                <circle cx="50" cy="79.5" r="2.2" fill="#f3dc95" stroke={C.gold} strokeWidth="0.8" />

                {/* LONG HAIR */}
                <path d="M 15 36 C 11 56 12 78 17 90 C 22 94 29 92 31 86 C 28 72 27 56 29 42 Z" fill={C.hair} />
                <path d="M 85 36 C 89 56 88 78 83 90 C 78 94 71 92 69 86 C 72 72 73 56 71 42 Z" fill={C.hair} />

                {/* FRONT ARM */}
                <g className={partnerHas ? 'arm-hold' : 'p-arm-r'}>
                  <rect x="63" y="73" width="10" height="22" rx="5" fill={C.skin} />
                  <rect x="63" y="89.5" width="10" height="2.5" fill={C.gold} />
                  <circle cx="68" cy="98" r="5" fill={C.skin} />
                </g>

                {/* OVERSIZED FUNKO HEAD */}
                <g className="p-head-tilt">
                  <rect x="9" y="12" width="82" height="54" rx="24" fill={C.hair} />
                  <rect x="12" y="10" width="76" height="58" rx="20" fill={C.skin} />

                  <path d="M 10 40 Q 6 6 50 6 Q 94 6 90 40 Q 86 24 66 17 Q 56 14 50 15 Q 44 14 34 17 Q 14 24 10 40 Z" fill={C.hair} />
                  <path d="M 50 8 L 50 15" stroke={C.hairShine} strokeWidth="1.2" strokeLinecap="round" />
                  <path d="M 12 32 Q 13 22 25 22 Q 20 42 23 64 Q 14 66 12 56 Z" fill={C.hair} />
                  <path d="M 88 32 Q 87 22 75 22 Q 80 42 77 64 Q 86 66 88 56 Z" fill={C.hair} />

                  {/* Eyebrows */}
                  <path d="M 25 32 Q 32 28 40 32" stroke={C.hair} strokeWidth="2.2" strokeLinecap="round" fill="none" />
                  <path d="M 60 32 Q 68 28 75 32" stroke={C.hair} strokeWidth="2.2" strokeLinecap="round" fill="none" />

                  {/* Eyes (follow cursor) */}
                  <g ref={partnerEyesRef}>
                    <circle cx="33" cy="42" r="7" fill="#2b1b16" />
                    <circle cx="35" cy="40" r="2.3" fill="#ffffff" />
                    <circle cx="67" cy="42" r="7" fill="#2b1b16" />
                    <circle cx="69" cy="40" r="2.3" fill="#ffffff" />
                  </g>

                  {/* cheeks, nose */}
                  <circle cx="29" cy="53" r="4" fill="#d98a6a" opacity="0.35" />
                  <circle cx="71" cy="53" r="4" fill="#d98a6a" opacity="0.35" />
                  <ellipse cx="50" cy="47" rx="2" ry="1.5" fill="#b98058" />

                  {/* soft closed smile */}
                  <path d="M 44 56 Q 50 59.5 57 55" stroke="#8e3b3b" strokeWidth="2" strokeLinecap="round" fill="none" />
                </g>

                {/* BOUQUET (after transfer) */}
                {partnerHas && !imgFailed && (
                  <image href="/bouquet.png" x="55" y="15" width="75" height="95" preserveAspectRatio="xMidYMid meet" />
                )}
                {partnerHas && imgFailed && (
                  <text x="62" y="92" fontSize="56">
                    💐
                  </text>
                )}
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Bouquet travelling from his hand to hers */}
      {phase === 'give' &&
        scene &&
        (() => {
          const flyStyle = {
            position: 'fixed',
            left: scene.bouquetFrom,
            top: scene.top + 16,
            width: 80,
            height: 102,
            zIndex: 1000001,
            pointerEvents: 'none',
            transition: 'transform 0.9s ease-in-out',
            transform: arrived ? `translateX(${scene.bouquetTo - scene.bouquetFrom}px)` : 'translateX(0px)',
          };
          return imgFailed ? (
            <div style={{ ...flyStyle, fontSize: 72, lineHeight: '102px', textAlign: 'center' }}>💐</div>
          ) : (
            <img
              src="/bouquet.png"
              alt="Bouquet"
              onError={() => setImgFailed(true)}
              style={{ ...flyStyle, objectFit: 'contain' }}
            />
          );
        })()}

      {/* Hearts & petals burst between the two */}
      {phase === 'delivered' && scene && (
        <div style={{ position: 'fixed', left: scene.mid, top: scene.top + 15, zIndex: 1000003, pointerEvents: 'none' }}>
          {hearts.map((h) => (
            <span
              key={h.id}
              style={{
                position: 'absolute',
                fontSize: h.size,
                '--dx': `${h.dx}px`,
                '--dy': `${h.dy}px`,
                animation: `heartFloat 2.4s ease-out ${h.delay}s both`,
              }}
            >
              {h.emoji}
            </span>
          ))}
        </div>
      )}

      {/* POPUP TEXT CARD AFTER GIVING BOUQUET */}
      {phase === 'delivered' && scene && (
        <div
          className="popup-delivered-text"
          style={{
            position: 'fixed',
            left: cardX,
            bottom: SPRITE_H + 40,
            zIndex: 1000002,
            pointerEvents: 'auto',
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.95)',
            border: '1.5px solid #ffd1dc',
            borderRadius: '16px',
            padding: '12px 20px',
            boxShadow: '0 6px 20px rgba(255, 77, 109, 0.25)',
            maxWidth: '280px',
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ff4d6d', marginBottom: '8px' }}>
            💐 {message}
          </div>
          <button onClick={handleThanks} style={btnStyle}>
            Thank you 💖
          </button>
        </div>
      )}
    </div>
  );
}

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