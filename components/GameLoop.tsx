
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { VehicleStats, Entity, EntityType, LevelTheme } from '../types';
import { LEVEL_DURATION } from '../constants';
import { Trophy, Package, ChevronLeft, ChevronRight, Gauge } from 'lucide-react';
import { playCollectSound, playCrashSound } from '../audio';

interface GameLoopProps {
  vehicle: VehicleStats;
  theme: LevelTheme;
  level: number;
  onGameOver: (earnedMoney: number, survived: boolean) => void;
}

type ParticleShape = 'circle' | 'square' | 'triangle' | 'star';
type ParticleType = 'exhaust' | 'collect' | 'coin' | 'crash';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0-1
  decay: number;
  size: number;
  color: string;
  rotation: number;
  rotSpeed: number;
  shape: ParticleShape;
  gravity: number;
  type: ParticleType;
}

export const GameLoop: React.FC<GameLoopProps> = ({ vehicle, theme, level, onGameOver }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [timeLeft, setTimeLeft] = useState(LEVEL_DURATION);
  const [earnedMoney, setEarnedMoney] = useState(0);
  const [feedback, setFeedback] = useState<{id: number, text: React.ReactNode, x: number, y: number, color: string}[]>([]);
  const [shake, setShake] = useState(0);
  
  // Game State Refs
  const playerPos = useRef(50); // X percentage 0-100
  const entities = useRef<Entity[]>([]);
  const particles = useRef<Particle[]>([]);
  const lastTime = useRef(0);
  const lastSpawn = useRef(0);
  const lastParticleSpawn = useRef(0);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const gameActive = useRef(true);
  const animationFrameId = useRef<number>(0);
  
  const earnedMoneyRef = useRef(0);

  // Difficulty & Visuals
  const speedMultiplier = 1 + (level * 0.1);
  const spawnRate = Math.max(200, 1000 - (level * 50)); 
  const displaySpeed = Math.round(vehicle.speed * 50 * speedMultiplier); // Fake km/h for display
  const maxDisplaySpeed = 250; 
  const gaugePercent = Math.min(100, (displaySpeed / maxDisplaySpeed) * 100);

  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysPressed.current[e.key] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysPressed.current[e.key] = false; };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const spawnEntity = useCallback(() => {
    const r = Math.random();
    let type = EntityType.PACKAGE;
    let width = 8;
    let height = 6;
    let speedOffset = 0;

    // 40% chance of obstacle
    if (r > 0.6) {
      const obstacleTypes = [
        EntityType.OBSTACLE_DOG,
        EntityType.OBSTACLE_CAT,
        EntityType.OBSTACLE_PERSON,
        EntityType.OBSTACLE_KID
      ];
      type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
      width = 10;
      height = 8;
      speedOffset = (Math.random() * 0.5) - 0.2; 
    } else if (r < 0.1) {
       type = EntityType.COIN;
       width = 6;
       height = 6;
    }

    const entity: Entity = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      x: Math.random() * 80 + 10,
      y: -15, 
      width,
      height,
      speedOffset
    };
    entities.current.push(entity);
  }, []);

  const getRandomColor = () => {
    const colors = ['#f472b6', '#a78bfa', '#34d399', '#facc15', '#60a5fa', '#fb923c', '#2dd4bf', '#e879f9'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const spawnParticles = (x: number, y: number, count: number, type: ParticleType) => {
      for (let i = 0; i < count; i++) {
        let vx = (Math.random() - 0.5) * 50;
        let vy = (Math.random() - 0.5) * 50;
        let size = Math.random() * 0.8 + 0.4;
        let decay = 1.5;
        let gravity = 0;
        let color = getRandomColor();
        let shape: ParticleShape = 'circle';
        let rotSpeed = (Math.random() - 0.5) * 720;

        if (type === 'exhaust') {
            vx = (Math.random() - 0.5) * 15;
            vy = 25 + Math.random() * 15; // Moves down
            size = Math.random() * 0.6 + 0.3;
            decay = 2.0;
            color = Math.random() > 0.5 ? '#94a3b8' : '#cbd5e1'; // Slate/Gray
            shape = 'circle';
            rotSpeed = (Math.random() - 0.5) * 100;
        } else if (type === 'collect') {
            vx = (Math.random() - 0.5) * 90;
            vy = (Math.random() - 0.5) * 90;
            decay = 0.8 + Math.random() * 0.5;
            gravity = 30; // Float down confetti style
            shape = Math.random() > 0.6 ? 'square' : (Math.random() > 0.5 ? 'triangle' : 'circle');
            size = Math.random() * 0.6 + 0.4;
        } else if (type === 'coin') {
             vx = (Math.random() - 0.5) * 70;
             vy = (Math.random() - 0.5) * 70 - 30; // Pop up
             color = Math.random() > 0.3 ? '#facc15' : '#fef08a'; // Yellows
             shape = 'star';
             decay = 1.0;
             gravity = 20;
             size = Math.random() * 0.8 + 0.4;
        } else if (type === 'crash') {
            vx = (Math.random() - 0.5) * 120;
            vy = (Math.random() - 0.5) * 120;
            color = Math.random() > 0.5 ? '#ef4444' : '#fee2e2'; // Reds
            if (Math.random() > 0.8) color = '#1e293b'; // Some smoke
            shape = Math.random() > 0.5 ? 'triangle' : 'square';
            decay = 0.8;
            gravity = 60; // Fall fast
            size = Math.random() + 0.5;
        }

        particles.current.push({
            id: Math.random(),
            x,
            y,
            vx,
            vy,
            life: 1.0,
            decay,
            size,
            color,
            rotation: Math.random() * 360,
            rotSpeed,
            shape,
            gravity,
            type
        });
      }
  };

  const showFeedback = (content: React.ReactNode, x: number, y: number, color: string = 'text-white') => {
      const id = Date.now();
      setFeedback(prev => [...prev, { id, text: content, x, y, color }]);
      setTimeout(() => {
          setFeedback(prev => prev.filter(f => f.id !== id));
      }, 800);
  };

  const update = useCallback((time: number) => {
    if (!gameActive.current) return;
    
    if (lastTime.current === 0) {
      lastTime.current = time;
      animationFrameId.current = requestAnimationFrame(update);
      return;
    }

    const deltaTime = Math.min((time - lastTime.current) / 1000, 0.1);
    lastTime.current = time;

    // Timer
    setTimeLeft(prev => {
        const newVal = prev - deltaTime;
        if (newVal <= 0) {
            gameActive.current = false;
            onGameOver(earnedMoneyRef.current, true); 
            return 0;
        }
        return newVal;
    });

    // Screen shake decay
    if (shake > 0) setShake(s => Math.max(0, s - 1));

    // Player Movement
    const moveSpeed = 40 * vehicle.handling * deltaTime; 
    if (keysPressed.current['ArrowLeft'] || keysPressed.current['a']) {
        playerPos.current = Math.max(5, playerPos.current - moveSpeed);
    }
    if (keysPressed.current['ArrowRight'] || keysPressed.current['d']) {
        playerPos.current = Math.min(95, playerPos.current + moveSpeed);
    }

    // Exhaust Particles
    if (time - lastParticleSpawn.current > 80) { // Faster spawn rate for exhaust
        spawnParticles(playerPos.current, 85, 1, 'exhaust');
        lastParticleSpawn.current = time;
    }

    // Update Particles
    particles.current.forEach(p => {
        p.x += p.vx * deltaTime;
        p.y += p.vy * deltaTime;
        p.vy += p.gravity * deltaTime; // Apply gravity
        p.rotation += p.rotSpeed * deltaTime;
        p.life -= p.decay * deltaTime;
    });
    particles.current = particles.current.filter(p => p.life > 0);

    // Spawning
    if (time - lastSpawn.current > spawnRate) {
        spawnEntity();
        lastSpawn.current = time;
    }

    // Entity Updates
    const baseSpeed = 30 * vehicle.speed * speedMultiplier * deltaTime;
    
    entities.current.forEach(ent => {
        ent.y += baseSpeed + (ent.speedOffset * 10 * deltaTime);
    });

    // Collision Detection
    const px = playerPos.current;
    const py = 85; 
    const pw = 8; 
    const ph = 10; 

    entities.current = entities.current.filter(ent => {
        const collision = 
            px < ent.x + ent.width &&
            px + pw > ent.x &&
            py < ent.y + ent.height &&
            py + ph > ent.y;

        if (collision) {
            if (ent.type === EntityType.PACKAGE) {
                playCollectSound();
                const amount = Math.floor(10 * vehicle.incomeMultiplier);
                setEarnedMoney(m => {
                    const newVal = m + amount;
                    earnedMoneyRef.current = newVal;
                    return newVal;
                });
                showFeedback(<span className="flex items-center gap-1">+{amount} <Package size={16}/></span>, ent.x, ent.y, 'text-green-400');
                spawnParticles(ent.x, ent.y, 20, 'collect');
                return false; 
            } else if (ent.type === EntityType.COIN) {
                playCollectSound();
                const amount = Math.floor(50 * vehicle.incomeMultiplier);
                setEarnedMoney(m => {
                    const newVal = m + amount;
                    earnedMoneyRef.current = newVal;
                    return newVal;
                });
                showFeedback(<span className="flex items-center gap-1">+{amount} 💰</span>, ent.x, ent.y, 'text-yellow-400');
                spawnParticles(ent.x, ent.y, 15, 'coin');
                return false;
            } else {
                // Obstacle Hit
                playCrashSound();
                setTimeLeft(t => Math.max(0, t - 2)); 
                setShake(10);
                showFeedback(<span className="font-bold text-red-500 text-3xl">-2s</span>, ent.x, ent.y, 'text-red-500');
                spawnParticles(ent.x, ent.y, 25, 'crash');
                return false; 
            }
        }
        
        return ent.y < 120;
    });

    // Render Logic
    if (containerRef.current && playerRef.current) {
       // Player Update
       playerRef.current.style.left = `${playerPos.current}%`;
       
       const tilt = (keysPressed.current['ArrowRight'] ? 15 : 0) + (keysPressed.current['ArrowLeft'] ? -15 : 0);
       playerRef.current.style.transform = `translateX(-50%) rotate(${tilt}deg)`;
    }
    
    // Force React re-render for entities/particles/shake
    setTick(t => t + 1);

    if (gameActive.current) {
        animationFrameId.current = requestAnimationFrame(update);
    }
  }, [vehicle, spawnEntity, speedMultiplier, onGameOver, shake]);

  const [_, setTick] = useState(0);

  useEffect(() => {
    animationFrameId.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId.current);
  }, [update]);

  // Touch Controls
  const handleTouchStart = (side: 'left' | 'right') => {
      keysPressed.current[side === 'left' ? 'ArrowLeft' : 'ArrowRight'] = true;
  };
  const handleTouchEnd = (side: 'left' | 'right') => {
      keysPressed.current[side === 'left' ? 'ArrowLeft' : 'ArrowRight'] = false;
  };

  const getEntityIcon = (type: EntityType) => {
      switch(type) {
          case EntityType.PACKAGE: return '📦';
          case EntityType.COIN: return '💰';
          case EntityType.OBSTACLE_DOG: return '🐕';
          case EntityType.OBSTACLE_CAT: return '🐈';
          case EntityType.OBSTACLE_PERSON: return '🚶';
          case EntityType.OBSTACLE_KID: return '🧒';
          default: return '❓';
      }
  };

  return (
    <div 
        ref={containerRef} 
        className={`relative w-full h-full overflow-hidden ${theme.environmentColor} select-none`}
        style={{ transform: `translate(${Math.random() * shake - shake/2}px, ${Math.random() * shake - shake/2}px)` }}
    >
      <style>{`
        @keyframes speedLine {
          0% { transform: translateY(-100%) scaleX(0.5); opacity: 0; }
          50% { opacity: ${0.2 + (vehicle.speed * 0.1)}; }
          100% { transform: translateY(100%) scaleX(0.5); opacity: 0; }
        }
        .speed-line {
          position: absolute;
          width: 2px;
          height: 100px;
          background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.8), transparent);
          animation: speedLine 0.5s linear infinite;
        }
        @keyframes rainbow {
          0% { border-color: #ef4444; }
          20% { border-color: #f97316; }
          40% { border-color: #eab308; }
          60% { border-color: #22c55e; }
          80% { border-color: #3b82f6; }
          100% { border-color: #a855f7; }
        }
      `}</style>
      
      {/* Moving Road Effect with Neon Borders */}
      <div className="absolute inset-0 flex justify-center opacity-40 pointer-events-none border-l-4 border-r-4 border-indigo-500/50" style={{ animation: 'rainbow 5s linear infinite' }}>
          <div className="w-full h-full absolute top-0 left-0 bg-gradient-to-b from-transparent via-purple-900/10 to-transparent"></div>
          <div className="w-4 h-full bg-dashed-line bg-repeat-y animate-road-scroll mix-blend-overlay"></div>
          {/* Colorful road markings */}
          <div className="absolute inset-y-0 left-[20%] w-1 bg-cyan-500/30 blur-[2px]"></div>
          <div className="absolute inset-y-0 right-[20%] w-1 bg-pink-500/30 blur-[2px]"></div>
      </div>

      {/* Speed Lines Effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
         {Array.from({ length: 8 }).map((_, i) => (
             <div 
                key={i} 
                className="speed-line"
                style={{ 
                    left: `${Math.random() * 100}%`, 
                    animationDuration: `${0.2 + Math.random() * 0.3}s`,
                    animationDelay: `${Math.random()}s`,
                    background: `linear-gradient(to bottom, transparent, ${getRandomColor()}, transparent)`
                }} 
             />
         ))}
      </div>
      
      {/* Particles */}
      {particles.current.map(p => {
          let borderRadius = '0%';
          let clipPath = 'none';
          
          if (p.shape === 'circle') borderRadius = '50%';
          else if (p.shape === 'triangle') clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
          else if (p.shape === 'star') clipPath = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
          
          return (
             <div 
                key={p.id}
                className="absolute mix-blend-screen will-change-transform"
                style={{
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    width: `${p.size}rem`,
                    height: `${p.size}rem`,
                    backgroundColor: p.color,
                    opacity: p.life,
                    borderRadius: borderRadius,
                    clipPath: clipPath,
                    transform: `translate(-50%, -50%) rotate(${p.rotation}deg) scale(${p.life})`,
                    boxShadow: p.shape === 'circle' ? `0 0 10px ${p.color}` : 'none'
                }}
              />
          );
      })}

      {/* Entities */}
      {entities.current.map(ent => (
        <div
            key={ent.id}
            className="absolute flex items-center justify-center text-4xl will-change-transform filter drop-shadow-xl"
            style={{
                left: `${ent.x}%`,
                top: `${ent.y}%`,
                width: `${ent.width}%`,
                height: `${ent.height}%`,
                transform: 'translate(-50%, -50%)',
            }}
        >
            {getEntityIcon(ent.type)}
        </div>
      ))}

      {/* Player */}
      <div
        ref={playerRef}
        id="player-sprite"
        className="absolute bottom-[15%] text-6xl transition-transform will-change-transform z-10 filter drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]"
        style={{ left: '50%', transform: 'translateX(-50%)' }}
      >
        {vehicle.icon}
      </div>

      {/* Feedback Popups */}
      {feedback.map(fb => (
          <div 
            key={fb.id}
            className={`absolute font-black pointer-events-none animate-bounce flex items-center gap-1 ${fb.color}`}
            style={{ 
                left: `${fb.x}%`, 
                top: `${fb.y}%`, 
                textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                fontSize: '1.75rem',
                zIndex: 40
            }}
          >
              {fb.text}
          </div>
      ))}

      {/* HUD */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-20 pointer-events-none">
        <div className="bg-black/60 text-white p-2 md:p-3 rounded-xl backdrop-blur-md flex items-center gap-3 border border-white/10 shadow-lg ring-1 ring-white/20">
            <Trophy className="text-yellow-400" size={24} />
            <div>
                <p className="text-[10px] text-gray-400 font-bold tracking-wider">EARNINGS</p>
                <p className="text-xl font-mono font-bold leading-none text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-200">${earnedMoney}</p>
            </div>
        </div>

        <div className={`p-4 rounded-full border-4 font-bold text-2xl w-20 h-20 flex items-center justify-center shadow-2xl transition-all ${timeLeft < 5 ? 'bg-red-600 border-red-400 animate-pulse text-white scale-110' : 'bg-slate-800/80 border-cyan-500 text-cyan-100 backdrop-blur-sm'}`}>
            {Math.ceil(timeLeft)}
        </div>
        
        {/* Speedometer */}
        <div className="bg-black/60 text-white p-2 md:p-3 rounded-xl backdrop-blur-md flex flex-col items-center border border-white/10 shadow-lg w-28 ring-1 ring-white/20">
             <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold tracking-wider w-full justify-center mb-1">
                 <Gauge size={12} /> SPEED
             </div>
             <div className="relative w-full h-1 bg-slate-700 rounded-full overflow-hidden mb-1">
                 <div 
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 transition-all duration-300"
                    style={{ width: `${gaugePercent}%` }}
                 />
             </div>
             <div className="text-xl font-mono font-bold leading-none flex items-baseline gap-1">
                 {displaySpeed} <span className="text-[10px] text-gray-500">KM/H</span>
             </div>
        </div>
      </div>

      <div className="absolute top-24 left-0 right-0 text-center pointer-events-none z-10">
          <h2 className="text-white/10 font-black text-4xl uppercase tracking-widest scale-y-150 transform mix-blend-overlay">{theme.primaryObstacle}</h2>
      </div>

      {/* Visible Mobile Controls */}
      <div className="absolute inset-0 flex z-30 pointer-events-none">
        <div 
            className="w-1/2 h-full flex items-end justify-start pb-12 pl-6 pointer-events-auto active:bg-gradient-to-r from-white/10 to-transparent transition-all touch-none"
            onTouchStart={() => handleTouchStart('left')}
            onTouchEnd={() => handleTouchEnd('left')}
            onMouseDown={() => handleTouchStart('left')}
            onMouseUp={() => handleTouchEnd('left')}
            onMouseLeave={() => handleTouchEnd('left')}
        >
            <div className="bg-white/10 hover:bg-white/20 p-6 rounded-full backdrop-blur-sm border border-white/20 text-white/70 shadow-2xl transition-all active:scale-95 active:bg-white/30">
                <ChevronLeft size={48} strokeWidth={3} />
            </div>
        </div>
        <div 
            className="w-1/2 h-full flex items-end justify-end pb-12 pr-6 pointer-events-auto active:bg-gradient-to-l from-white/10 to-transparent transition-all touch-none"
            onTouchStart={() => handleTouchStart('right')}
            onTouchEnd={() => handleTouchEnd('right')}
            onMouseDown={() => handleTouchStart('right')}
            onMouseUp={() => handleTouchEnd('right')}
            onMouseLeave={() => handleTouchEnd('right')}
        >
             <div className="bg-white/10 hover:bg-white/20 p-6 rounded-full backdrop-blur-sm border border-white/20 text-white/70 shadow-2xl transition-all active:scale-95 active:bg-white/30">
                <ChevronRight size={48} strokeWidth={3} />
            </div>
        </div>
      </div>
    </div>
  );
};
