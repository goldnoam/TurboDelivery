
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { VehicleStats, Entity, EntityType, LevelTheme } from '../types';
import { LEVEL_DURATION } from '../constants';
import { Trophy, Package, ChevronLeft, ChevronRight, Gauge, Zap, Map as MapIcon, Shield, Magnet, Pause, RotateCcw, LogOut, Play, FastForward } from 'lucide-react';
import { 
  playCollectSound, 
  playGenericCrash, 
  playBoostSound, 
  playDogBark, 
  playCatScreech, 
  playCarHonk,
  playPowerupSound,
  playShieldBreakSound,
  playMagnetSound
} from '../audio';

interface GameLoopProps {
  vehicle: VehicleStats;
  theme: LevelTheme;
  level: number;
  onGameOver: (earnedMoney: number, survived: boolean) => void;
}

type ParticleShape = 'circle' | 'square' | 'triangle' | 'star';
type ParticleType = 'exhaust' | 'collect' | 'coin' | 'crash' | 'boost' | 'shield_break' | 'magic';

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
  const [boostLevel, setBoostLevel] = useState(100);
  const [screenCrack, setScreenCrack] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  // Power-up States
  const shieldActive = useRef(false);
  const magnetTimer = useRef(0);
  const boostLevelRef = useRef(100); // Physics ref to avoid dependency cycles
  
  // Game State Refs
  const playerPos = useRef(50); // X percentage 0-100
  const entities = useRef<Entity[]>([]);
  const particles = useRef<Particle[]>([]);
  const lastTime = useRef(0);
  const lastSpawn = useRef(0);
  const lastParticleSpawn = useRef(0);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const isBoostingRef = useRef(false);
  const gameActive = useRef(true);
  const animationFrameId = useRef<number>(0);
  
  const earnedMoneyRef = useRef(0);

  // Difficulty & Visuals
  const speedMultiplier = 1 + (level * 0.1);
  const baseSpawnRate = Math.max(200, 1000 - (level * 50)); 
  
  const displaySpeed = Math.round(vehicle.speed * 50 * speedMultiplier * (isBoostingRef.current ? 2 : 1)); 
  const maxDisplaySpeed = 400; 
  const gaugePercent = Math.min(100, (displaySpeed / maxDisplaySpeed) * 100);

  const getRandomColor = () => {
    const colors = ['#f472b6', '#a78bfa', '#34d399', '#facc15', '#60a5fa', '#fb923c', '#2dd4bf', '#e879f9'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const spawnParticles = useCallback((x: number, y: number, count: number, type: ParticleType, options?: { color?: string, shape?: ParticleShape }) => {
      for (let i = 0; i < count; i++) {
        let vx = (Math.random() - 0.5) * 50;
        let vy = (Math.random() - 0.5) * 50;
        let size = Math.random() * 0.8 + 0.4;
        let decay = 1.5;
        let gravity = 0;
        let color = options?.color || getRandomColor();
        let shape: ParticleShape = options?.shape || 'circle';
        let rotSpeed = (Math.random() - 0.5) * 720;

        if (type === 'exhaust') {
            vx = (Math.random() - 0.5) * 15;
            vy = 25 + Math.random() * 15; // Moves down
            size = Math.random() * 0.6 + 0.3;
            decay = 2.0;
            color = Math.random() > 0.5 ? '#94a3b8' : '#cbd5e1'; // Slate/Gray
            shape = 'circle';
            rotSpeed = (Math.random() - 0.5) * 100;
        } else if (type === 'boost') {
            vx = (Math.random() - 0.5) * 40; // Wider spread
            vy = 40 + Math.random() * 20; // Moves down fast
            size = Math.random() * 0.8 + 0.4;
            decay = 2.5;
            color = Math.random() > 0.5 ? '#3b82f6' : '#60a5fa'; // Blue flames
            shape = Math.random() > 0.5 ? 'triangle' : 'circle';
            rotSpeed = (Math.random() - 0.5) * 360;
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
            
            // Default crash colors if not overridden
            if (!options?.color) {
               color = Math.random() > 0.5 ? '#ef4444' : '#fee2e2'; // Reds
               if (Math.random() > 0.8) color = '#1e293b'; // Some smoke
            }
            
            shape = options?.shape || (Math.random() > 0.5 ? 'triangle' : 'square');
            decay = 0.8;
            gravity = 60; // Fall fast
            size = Math.random() + 0.5;
        } else if (type === 'shield_break') {
            vx = (Math.random() - 0.5) * 100;
            vy = (Math.random() - 0.5) * 100;
            color = '#3b82f6';
            shape = 'square';
            decay = 1.2;
            gravity = 10;
        } else if (type === 'magic') {
            vx = (Math.random() - 0.5) * 60;
            vy = (Math.random() - 0.5) * 60 - 20;
            color = '#d8b4fe';
            shape = 'star';
            decay = 1.0;
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
  }, []);

  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
        if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
            togglePause();
            return;
        }

        if (isPaused) return;

        keysPressed.current[e.key] = true; 
        if (e.code === 'Space') {
            if (!isBoostingRef.current) {
                // Initial boost burst
                spawnParticles(playerPos.current, 85, 15, 'boost');
            }
            isBoostingRef.current = true;
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => { 
        keysPressed.current[e.key] = false; 
        if (e.code === 'Space') isBoostingRef.current = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPaused, spawnParticles]);

  const togglePause = () => {
      setIsPaused(prev => !prev);
  };

  const handleRestart = () => {
      setIsPaused(false);
      setTimeLeft(LEVEL_DURATION);
      setEarnedMoney(0);
      setBoostLevel(100);
      setScreenCrack(false);
      setShake(0);
      setFeedback([]);
      
      // Reset Refs
      earnedMoneyRef.current = 0;
      entities.current = [];
      particles.current = [];
      playerPos.current = 50;
      lastTime.current = 0;
      boostLevelRef.current = 100;
      shieldActive.current = false;
      magnetTimer.current = 0;
      keysPressed.current = {};
      isBoostingRef.current = false;
      gameActive.current = true;
  };

  const handleQuit = () => {
      onGameOver(earnedMoneyRef.current, false);
  };

  const handleSkip = () => {
      onGameOver(earnedMoneyRef.current, true);
  };

  const spawnEntity = useCallback(() => {
    const r = Math.random();
    let type = EntityType.PACKAGE;
    let width = 8;
    let height = 6;
    let speedOffset = 0;
    let vx = 0;

    // 5% chance of Power-up
    if (r < 0.05) {
        if (Math.random() > 0.5) {
            type = EntityType.POWERUP_SHIELD;
            width = 8;
            height = 8;
        } else {
            type = EntityType.POWERUP_MAGNET;
            width = 8;
            height = 8;
        }
    } 
    // 10% chance of Coin
    else if (r < 0.15) {
       type = EntityType.COIN;
       width = 6;
       height = 6;
    }
    // 40% chance of Obstacle (approx)
    else if (r > 0.6) {
      const obstacleRoll = Math.random();
      if (obstacleRoll < 0.2) {
         type = EntityType.OBSTACLE_CONE;
         width = 6;
         height = 6;
      } else if (obstacleRoll < 0.4) {
         type = EntityType.OBSTACLE_BARRIER;
         width = 18;
         height = 8;
      } else if (obstacleRoll < 0.6) {
         type = EntityType.OBSTACLE_CAR;
         width = 12;
         height = 14;
         speedOffset = 0.2; // Cars move faster
         vx = (Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 20); // Moving sideways
      } else {
        const organicObstacles = [
            EntityType.OBSTACLE_DOG,
            EntityType.OBSTACLE_CAT,
            EntityType.OBSTACLE_PERSON,
            EntityType.OBSTACLE_KID
        ];
        type = organicObstacles[Math.floor(Math.random() * organicObstacles.length)];
        width = 10;
        height = 8;
        speedOffset = (Math.random() * 0.5) - 0.2;
      }
    }

    // Adjust spawn x for moving cars so they don't immediately go off screen
    let startX = Math.random() * 80 + 10;
    if (type === EntityType.OBSTACLE_CAR) {
        startX = vx > 0 ? 10 : 90;
    }

    const entity: Entity = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      x: startX,
      y: -15, 
      width,
      height,
      speedOffset,
      vx
    };
    entities.current.push(entity);
  }, []);

  const showFeedback = (content: React.ReactNode, x: number, y: number, color: string = 'text-white') => {
      const id = Date.now();
      setFeedback(prev => [...prev, { id, text: content, x, y, color }]);
      setTimeout(() => {
          setFeedback(prev => prev.filter(f => f.id !== id));
      }, 800);
  };

  const update = useCallback((time: number) => {
    if (!gameActive.current || isPaused) return;
    
    if (lastTime.current === 0) {
      lastTime.current = time;
      animationFrameId.current = requestAnimationFrame(update);
      return;
    }

    const deltaTime = Math.min((time - lastTime.current) / 1000, 0.1);
    lastTime.current = time;

    // Magnet Timer
    if (magnetTimer.current > 0) {
        magnetTimer.current -= deltaTime;
    }

    // Boost Logic
    let boostMultiplier = 1.0;
    if (isBoostingRef.current && boostLevelRef.current > 0) {
        boostMultiplier = 2.0;
        boostLevelRef.current = Math.max(0, boostLevelRef.current - deltaTime * 30);
        if (Math.random() > 0.8) playBoostSound();
    } else {
        isBoostingRef.current = false;
        boostLevelRef.current = Math.min(100, boostLevelRef.current + deltaTime * 5);
    }
    
    // Sync UI (throttled slightly by react state batching, but ensures decoupled logic)
    setBoostLevel(boostLevelRef.current);

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

    // Exhaust/Boost Particles
    const particleRate = isBoostingRef.current ? 30 : 80;
    if (time - lastParticleSpawn.current > particleRate) { 
        spawnParticles(playerPos.current, 85, 1, isBoostingRef.current ? 'boost' : 'exhaust');
        lastParticleSpawn.current = time;
    }

    // Update Particles
    particles.current.forEach(p => {
        p.x += p.vx * deltaTime;
        p.y += p.vy * deltaTime;
        p.vy += p.gravity * deltaTime; 
        p.rotation += p.rotSpeed * deltaTime;
        p.life -= p.decay * deltaTime;
    });
    particles.current = particles.current.filter(p => p.life > 0);

    // Spawning
    const effectiveSpawnRate = baseSpawnRate / boostMultiplier;
    if (time - lastSpawn.current > effectiveSpawnRate) {
        spawnEntity();
        lastSpawn.current = time;
    }

    // Entity Updates
    const baseSpeed = 30 * vehicle.speed * speedMultiplier * boostMultiplier * deltaTime;
    
    entities.current.forEach(ent => {
        // Basic movement
        ent.y += baseSpeed + (ent.speedOffset * 10 * deltaTime);
        if (ent.vx) {
            ent.x += ent.vx * deltaTime;
            if (ent.x <= 5 || ent.x >= 95) ent.vx *= -1; 
        }

        // Magnet Effect
        if (magnetTimer.current > 0 && (ent.type === EntityType.PACKAGE || ent.type === EntityType.COIN)) {
            // Check if within vertical range
            if (ent.y > 40 && ent.y < 95) {
                const dx = playerPos.current - ent.x;
                const dist = Math.abs(dx);
                if (dist < 40) {
                    // Pull towards player
                    ent.x += (dx * 5 * deltaTime); 
                }
            }
        }
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
                spawnParticles(ent.x, ent.y, 20, 'collect', { shape: 'square' });
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
                spawnParticles(ent.x, ent.y, 15, 'coin', { shape: 'star' });
                return false;
            } else if (ent.type === EntityType.POWERUP_SHIELD) {
                playPowerupSound();
                shieldActive.current = true;
                showFeedback(<span className="flex items-center gap-1">SHIELD! 🛡️</span>, ent.x, ent.y, 'text-blue-400');
                spawnParticles(ent.x, ent.y, 20, 'magic');
                return false;
            } else if (ent.type === EntityType.POWERUP_MAGNET) {
                playMagnetSound();
                magnetTimer.current = 10;
                showFeedback(<span className="flex items-center gap-1">MAGNET! 🧲</span>, ent.x, ent.y, 'text-purple-400');
                spawnParticles(ent.x, ent.y, 20, 'magic');
                return false;
            } else {
                // Obstacle Hit
                if (shieldActive.current) {
                    playShieldBreakSound();
                    shieldActive.current = false;
                    spawnParticles(ent.x, ent.y, 20, 'shield_break');
                    showFeedback(<span className="font-bold text-blue-300">BLOCKED!</span>, ent.x, ent.y, 'text-blue-300');
                    return false; // Destroy obstacle, no damage
                }

                // Play specific sound based on obstacle
                if (ent.type === EntityType.OBSTACLE_DOG) playDogBark();
                else if (ent.type === EntityType.OBSTACLE_CAT) playCatScreech();
                else if (ent.type === EntityType.OBSTACLE_CAR) playCarHonk();
                else playGenericCrash();

                // Determine dynamic particle config based on obstacle type
                let crashColor = '#ef4444'; 
                let crashShape: ParticleShape = 'square';
                
                if (ent.type === EntityType.OBSTACLE_DOG) {
                    crashColor = '#8B4513'; // SaddleBrown
                    crashShape = 'circle';
                } else if (ent.type === EntityType.OBSTACLE_CAT) {
                    crashColor = '#FFA500'; // Orange
                    crashShape = 'circle';
                } else if (ent.type === EntityType.OBSTACLE_CONE) {
                    crashColor = '#F97316'; // Orange-500
                    crashShape = 'triangle';
                } else if (ent.type === EntityType.OBSTACLE_BARRIER) {
                    crashColor = '#EAB308'; // Yellow-500
                    crashShape = 'square';
                } else if (ent.type === EntityType.OBSTACLE_CAR) {
                    crashColor = '#94A3B8'; // Slate-400
                    crashShape = 'square';
                }

                // Damage Effects
                setTimeLeft(t => Math.max(0, t - 2)); 
                setShake(10);
                setScreenCrack(true);
                setTimeout(() => setScreenCrack(false), 300); // Quick flash

                showFeedback(<span className="font-bold text-red-500 text-3xl">-2s</span>, ent.x, ent.y, 'text-red-500');
                spawnParticles(ent.x, ent.y, 25, 'crash', { color: crashColor, shape: crashShape });
                return false; 
            }
        }
        
        return ent.y < 120;
    });

    // Render Logic
    if (containerRef.current && playerRef.current) {
       playerRef.current.style.left = `${playerPos.current}%`;
       
       const tilt = (keysPressed.current['ArrowRight'] ? 15 : 0) + (keysPressed.current['ArrowLeft'] ? -15 : 0);
       playerRef.current.style.transform = `translateX(-50%) rotate(${tilt}deg)`;
    }
    
    setTick(t => t + 1);

    if (gameActive.current) {
        animationFrameId.current = requestAnimationFrame(update);
    }
  }, [vehicle, spawnEntity, speedMultiplier, onGameOver, shake, baseSpawnRate, isPaused, spawnParticles]);

  const [_, setTick] = useState(0);

  // Restart loop when unpausing
  useEffect(() => {
    if (!isPaused && gameActive.current) {
        lastTime.current = 0;
        animationFrameId.current = requestAnimationFrame(update);
    }
    return () => cancelAnimationFrame(animationFrameId.current);
  }, [isPaused, update]);

  // Touch Controls
  const handleTouchStart = (side: 'left' | 'right') => {
      keysPressed.current[side === 'left' ? 'ArrowLeft' : 'ArrowRight'] = true;
  };
  const handleTouchEnd = (side: 'left' | 'right') => {
      keysPressed.current[side === 'left' ? 'ArrowLeft' : 'ArrowRight'] = false;
  };
  
  const handleBoostStart = () => { 
      if (!isBoostingRef.current) {
          spawnParticles(playerPos.current, 85, 15, 'boost');
      }
      isBoostingRef.current = true; 
  };
  const handleBoostEnd = () => { isBoostingRef.current = false; };

  const getEntityIcon = (type: EntityType) => {
      switch(type) {
          case EntityType.PACKAGE: return '📦';
          case EntityType.COIN: return '💰';
          case EntityType.OBSTACLE_DOG: return '🐕';
          case EntityType.OBSTACLE_CAT: return '🐈';
          case EntityType.OBSTACLE_PERSON: return '🚶';
          case EntityType.OBSTACLE_KID: return '🧒';
          case EntityType.OBSTACLE_CONE: return '⚠️';
          case EntityType.OBSTACLE_BARRIER: return '🚧';
          case EntityType.OBSTACLE_CAR: return '🚗';
          case EntityType.POWERUP_SHIELD: return '🛡️';
          case EntityType.POWERUP_MAGNET: return '🧲';
          default: return '❓';
      }
  };
  
  const getEntityMiniMapColor = (type: EntityType) => {
      switch(type) {
          case EntityType.PACKAGE: 
          case EntityType.COIN: return 'bg-green-400';
          case EntityType.POWERUP_SHIELD: return 'bg-blue-400';
          case EntityType.POWERUP_MAGNET: return 'bg-purple-400';
          default: return 'bg-red-500';
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
      <div className={`absolute inset-0 flex justify-center opacity-40 pointer-events-none border-l-4 border-r-4 transition-colors duration-300 ${isBoostingRef.current ? 'border-blue-400' : 'border-indigo-500/50'}`} style={{ animation: isBoostingRef.current ? 'none' : 'rainbow 5s linear infinite' }}>
          <div className="w-full h-full absolute top-0 left-0 bg-gradient-to-b from-transparent via-purple-900/10 to-transparent"></div>
          <div className={`w-4 h-full bg-dashed-line bg-repeat-y animate-road-scroll mix-blend-overlay ${isBoostingRef.current ? 'duration-75' : 'duration-300'}`}></div>
          <div className="absolute inset-y-0 left-[20%] w-1 bg-cyan-500/30 blur-[2px]"></div>
          <div className="absolute inset-y-0 right-[20%] w-1 bg-pink-500/30 blur-[2px]"></div>
      </div>

      {/* Speed Lines Effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
         {Array.from({ length: isBoostingRef.current ? 20 : 8 }).map((_, i) => (
             <div 
                key={i} 
                className="speed-line"
                style={{ 
                    left: `${Math.random() * 100}%`, 
                    animationDuration: `${(0.2 + Math.random() * 0.3) / (isBoostingRef.current ? 3 : 1)}s`,
                    animationDelay: `${Math.random()}s`,
                    background: `linear-gradient(to bottom, transparent, ${isBoostingRef.current ? '#60a5fa' : getRandomColor()}, transparent)`
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
                transform: `translate(-50%, -50%) ${ent.vx ? (ent.vx > 0 ? 'scaleX(-1)' : '') : ''}`,
            }}
        >
            {getEntityIcon(ent.type)}
        </div>
      ))}

      {/* Player */}
      <div
        ref={playerRef}
        id="player-sprite"
        className="absolute bottom-[15%] flex justify-center items-center transition-transform will-change-transform z-10"
        style={{ left: '50%', transform: 'translateX(-50%)' }}
      >
        <span className="text-6xl filter drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] z-10">
            {vehicle.icon}
        </span>
        
        {/* Shield Effect */}
        {shieldActive.current && (
            <div className="absolute w-24 h-24 rounded-full border-4 border-blue-400 bg-blue-500/20 animate-pulse shadow-[0_0_20px_rgba(59,130,246,0.6)] z-0 flex items-center justify-center">
                <Shield size={16} className="text-blue-200 absolute -top-2 bg-blue-600 rounded-full p-0.5" />
            </div>
        )}
      </div>

      {/* Magnet Effect Visualization */}
      {magnetTimer.current > 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-purple-900/80 px-3 py-1 rounded-full border border-purple-400/50 animate-pulse z-30">
              <Magnet size={16} className="text-purple-300" />
              <span className="text-xs font-bold text-purple-200">{Math.ceil(magnetTimer.current)}s</span>
          </div>
      )}

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

      {/* HUD Layer */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-20 pointer-events-none">
        
        {/* Money */}
        <div className="bg-black/60 text-white p-2 md:p-3 rounded-xl backdrop-blur-md flex items-center gap-3 border border-white/10 shadow-lg ring-1 ring-white/20">
            <Trophy className="text-yellow-400" size={24} />
            <div>
                <p className="text-[10px] text-gray-400 font-bold tracking-wider">EARNINGS</p>
                <p className="text-xl font-mono font-bold leading-none text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-200">${earnedMoney}</p>
            </div>
        </div>

        {/* Timer */}
        <div className={`p-4 rounded-full border-4 font-bold text-2xl w-20 h-20 flex items-center justify-center shadow-2xl transition-all ${timeLeft < 5 ? 'bg-red-600 border-red-400 animate-pulse text-white scale-110' : 'bg-slate-800/80 border-cyan-500 text-cyan-100 backdrop-blur-sm'}`}>
            {Math.ceil(timeLeft)}
        </div>
        
        {/* Right Controls Area: Speedometer + Pause */}
        <div className="flex flex-col gap-2 pointer-events-auto">
            {/* Speedometer */}
            <div className="bg-black/60 text-white p-2 md:p-3 rounded-xl backdrop-blur-md flex flex-col items-center border border-white/10 shadow-lg w-28 ring-1 ring-white/20 pointer-events-none">
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

            {/* Pause Button */}
            <button 
                onClick={togglePause}
                className="bg-slate-800 hover:bg-slate-700 text-white p-3 rounded-xl border border-white/10 shadow-lg flex items-center justify-center active:scale-95 transition-all self-end"
            >
                <Pause size={24} />
            </button>
        </div>
      </div>
      
      {/* Mini-Map */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 border border-white/10 rounded-lg p-2 backdrop-blur-sm z-20 hidden md:flex flex-col items-center gap-2">
           <MapIcon size={16} className="text-slate-400" />
           <div className="w-16 h-48 bg-slate-800/50 rounded border border-slate-700 relative overflow-hidden">
               {/* Player Dot on Minimap - Fixed at 85% */}
               <div className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,1)]" style={{ top: '85%' }}></div>
               
               {/* Entities on Minimap - Map y from -20 to 100 */}
               {entities.current.map(ent => {
                   if (ent.y < -20 || ent.y > 100) return null;
                   // Normalize Y: -20 -> 0%, 100 -> 100%
                   const miniY = ((ent.y + 20) / 120) * 100;
                   return (
                       <div 
                         key={`mm-${ent.id}`}
                         className={`absolute w-1.5 h-1.5 rounded-full ${getEntityMiniMapColor(ent.type)}`}
                         style={{ 
                             left: `${ent.x}%`, 
                             top: `${miniY}%`,
                             transform: 'translate(-50%, -50%)'
                         }}
                       />
                   )
               })}
           </div>
      </div>

      {/* Boost UI & Mobile Controls Layer */}
      <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-end">
          
          {/* Boost Bar */}
          <div className="flex flex-col items-center mb-24 w-full">
              <div className="flex items-center gap-2 mb-1">
                  <Zap size={20} className={isBoostingRef.current ? 'text-blue-400 fill-blue-400 animate-pulse' : 'text-slate-400'} />
                  <span className={`text-xs font-bold tracking-widest ${isBoostingRef.current ? 'text-blue-400' : 'text-slate-400'}`}>NITRO</span>
              </div>
              <div className="w-64 h-3 bg-slate-800 rounded-full border border-slate-600 overflow-hidden relative">
                   <div 
                        className={`absolute top-0 left-0 h-full transition-all duration-100 ${isBoostingRef.current ? 'bg-gradient-to-r from-blue-500 to-cyan-400' : 'bg-blue-600'}`}
                        style={{ width: `${boostLevel}%` }}
                   />
              </div>
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
             <button 
                className={`w-20 h-20 rounded-full border-4 flex items-center justify-center shadow-xl transition-all active:scale-90 ${isBoostingRef.current ? 'bg-blue-500 border-blue-300 shadow-[0_0_30px_rgba(59,130,246,0.6)]' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                onTouchStart={handleBoostStart}
                onTouchEnd={handleBoostEnd}
                onMouseDown={handleBoostStart}
                onMouseUp={handleBoostEnd}
                onMouseLeave={handleBoostEnd}
             >
                 <Zap size={32} className={isBoostingRef.current ? 'text-white fill-white' : 'text-slate-500'} />
             </button>
          </div>

          <div className="flex w-full h-1/2 pointer-events-none absolute bottom-0">
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
      
      {/* Screen Crack Overlay */}
      {screenCrack && (
        <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center animate-ping">
           <div className="w-full h-full bg-red-500/20 mix-blend-overlay" />
           {/* SVG simulation of cracked glass */}
           <svg className="absolute inset-0 w-full h-full opacity-60" viewBox="0 0 100 100" preserveAspectRatio="none">
               <path d="M50 50 L20 10 M50 50 L80 10 M50 50 L10 40 M50 50 L90 60 M50 50 L30 90" stroke="white" strokeWidth="0.5" fill="none" />
           </svg>
        </div>
      )}

      {/* Pause Menu Overlay */}
      {isPaused && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in duration-200">
                  <h2 className="text-3xl font-bold text-center mb-8 flex items-center justify-center gap-2">
                      <Pause size={32} className="text-blue-500"/> PAUSED
                  </h2>
                  <div className="flex flex-col gap-4">
                      <button 
                          onClick={togglePause}
                          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                      >
                          <Play size={20} fill="currentColor"/> RESUME
                      </button>
                      <button 
                          onClick={handleRestart}
                          className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                      >
                          <RotateCcw size={20} /> RESTART LEVEL
                      </button>
                       <button 
                          onClick={handleSkip}
                          className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                      >
                          <FastForward size={20} /> SKIP LEVEL
                      </button>
                      <button 
                          onClick={handleQuit}
                          className="w-full bg-red-900/50 hover:bg-red-900 text-red-200 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors border border-red-900"
                      >
                          <LogOut size={20} /> RETURN TO SHOP
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="absolute top-24 left-0 right-0 text-center pointer-events-none z-10">
          <h2 className="text-white/10 font-black text-4xl uppercase tracking-widest scale-y-150 transform mix-blend-overlay">{theme.primaryObstacle}</h2>
      </div>

    </div>
  );
};
