
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { VehicleStats, Entity, EntityType, LevelTheme, GhostRun, WeatherType } from '../types';
import { LEVEL_DURATION } from '../constants';
import { Trophy, Package, ChevronLeft, ChevronRight, Gauge, Zap, Map as MapIcon, Shield, Magnet, Pause, RotateCcw, LogOut, Play, FastForward, Wrench, CloudRain, CloudFog, Ghost } from 'lucide-react';
import { 
  playCollectSound, 
  playGenericCrash, 
  playBoostSound, 
  playDogBark, 
  playCatScreech, 
  playCarHonk,
  playPowerupSound,
  playShieldBreakSound,
  playMagnetSound,
  playSlipSound,
  playBirdSound
} from '../audio';

interface GameLoopProps {
  vehicle: VehicleStats;
  theme: LevelTheme;
  level: number;
  onGameOver: (earnedMoney: number, survived: boolean, recording: GhostRun) => void;
  ghostRun?: GhostRun | null;
}

type ParticleShape = 'circle' | 'square' | 'triangle' | 'star';
type ParticleType = 'exhaust' | 'collect' | 'coin' | 'crash' | 'boost' | 'shield_break' | 'magic' | 'fire' | 'smoke_damage';

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

export const GameLoop: React.FC<GameLoopProps> = ({ vehicle, theme, level, onGameOver, ghostRun }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [timeLeft, setTimeLeft] = useState(LEVEL_DURATION);
  const [earnedMoney, setEarnedMoney] = useState(0);
  const [feedback, setFeedback] = useState<{id: number, text: React.ReactNode, x: number, y: number, color: string}[]>([]);
  const [shake, setShake] = useState(0);
  const [boostLevel, setBoostLevel] = useState(100);
  const [screenCrack, setScreenCrack] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [spinOut, setSpinOut] = useState(0); // Degrees of rotation from slipping
  const [isBoosting, setIsBoosting] = useState(false); // State for UI updates
  const [damage, setDamage] = useState(0); // 0-100 visual damage
  const [weather, setWeather] = useState<WeatherType>(WeatherType.CLEAR);
  const [ghostPos, setGhostPos] = useState<number | null>(null);
  
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
  
  // Ghost Recording
  const currentRun = useRef<GhostRun>([]);
  const lastRecordTime = useRef(0);
  
  const earnedMoneyRef = useRef(0);

  // Difficulty & Visuals
  const speedMultiplier = 1 + (level * 0.1);
  const baseSpawnRate = Math.max(200, 1000 - (level * 50)); 
  
  const displaySpeed = Math.round(vehicle.speed * 50 * speedMultiplier * (isBoosting ? 2 : 1)); 
  const maxDisplaySpeed = 400; 
  const gaugePercent = Math.min(100, (displaySpeed / maxDisplaySpeed) * 100);

  // Initialize Weather
  useEffect(() => {
    const roll = Math.random();
    if (roll < 0.2) setWeather(WeatherType.RAIN);
    else if (roll < 0.4) setWeather(WeatherType.FOG);
    else setWeather(WeatherType.CLEAR);
  }, []);

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
            vx = (Math.random() - 0.5) * 120; // Wide spread
            vy = 60 + Math.random() * 40; // Fast down
            size = Math.random() * 1.2 + 0.6;
            decay = 3.0; // Die fast
            color = Math.random() > 0.3 ? '#06b6d4' : '#22d3ee'; // Cyan/Electric Blue
            shape = 'triangle';
            rotSpeed = (Math.random() - 0.5) * 720;
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
        } else if (type === 'fire') {
            vx = (Math.random() - 0.5) * 30;
            vy = 30 + Math.random() * 20; // Moves down
            color = Math.random() > 0.5 ? '#ef4444' : '#f59e0b'; // Red/Orange
            shape = 'triangle';
            decay = 2.5;
            size = Math.random() * 0.8 + 0.4;
        } else if (type === 'smoke_damage') {
             vx = (Math.random() - 0.5) * 20;
             vy = 20 + Math.random() * 15;
             color = '#57534e'; // Stone gray
             shape = 'circle';
             decay = 1.5;
             size = Math.random() * 0.7 + 0.4;
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
                playBoostSound();
                spawnParticles(playerPos.current, 85, 25, 'boost');
                setIsBoosting(true);
            }
            isBoostingRef.current = true;
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => { 
        keysPressed.current[e.key] = false; 
        if (e.code === 'Space') {
            isBoostingRef.current = false;
            setIsBoosting(false);
        }
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
      setSpinOut(0);
      setDamage(0);
      setFeedback([]);
      setIsBoosting(false);
      
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
      currentRun.current = [];
  };

  const handleQuit = () => {
      onGameOver(earnedMoneyRef.current, false, []);
  };

  const handleSkip = () => {
      onGameOver(earnedMoneyRef.current, true, []);
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
      if (obstacleRoll < 0.15) {
         type = EntityType.OBSTACLE_CONE;
         width = 6;
         height = 6;
      } else if (obstacleRoll < 0.3) {
         type = EntityType.OBSTACLE_BARRIER;
         width = 18;
         height = 8;
      } else if (obstacleRoll < 0.45) {
         type = EntityType.OBSTACLE_CAR;
         width = 12;
         height = 14;
         speedOffset = 0.2; // Cars move faster
         vx = (Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 20); // Moving sideways
      } else if (obstacleRoll < 0.55) {
         type = EntityType.OBSTACLE_OIL;
         width = 10;
         height = 8;
      } else if (obstacleRoll < 0.65) {
         type = EntityType.OBSTACLE_PIGEON;
         width = 8;
         height = 6;
         speedOffset = 0.5; // Fast
         vx = (Math.random() > 0.5 ? 1 : -1) * (20 + Math.random() * 30);
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
    if (type === EntityType.OBSTACLE_CAR || type === EntityType.OBSTACLE_PIGEON) {
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
      lastRecordTime.current = time;
      animationFrameId.current = requestAnimationFrame(update);
      return;
    }

    const deltaTime = Math.min((time - lastTime.current) / 1000, 0.1);
    lastTime.current = time;

    // Ghost Recording (Every 100ms)
    if (time - lastRecordTime.current > 100) {
        const elapsedTime = LEVEL_DURATION - timeLeft;
        currentRun.current.push({ t: elapsedTime, x: playerPos.current });
        lastRecordTime.current = time;
        
        // Ghost Playback Position
        if (ghostRun) {
            const ghostFrame = ghostRun.find(f => f.t >= elapsedTime);
            if (ghostFrame) setGhostPos(ghostFrame.x);
            else setGhostPos(null); // Ghost finished or not started
        }
    }

    // Spin Decay
    if (spinOut > 0) {
        setSpinOut(prev => Math.max(0, prev - 720 * deltaTime)); // Spin back to 0 over ~0.5s
    }

    // Magnet Timer
    if (magnetTimer.current > 0) {
        magnetTimer.current -= deltaTime;
    }

    // Boost Logic
    if (isBoostingRef.current && boostLevelRef.current > 0) {
        boostLevelRef.current -= deltaTime * 30; // Drain fuel
        setBoostLevel(boostLevelRef.current);
        
        // Boost Effects
        spawnParticles(playerPos.current, 90, 2, 'boost');
        if (Math.random() > 0.5) {
            setShake(Math.random() * 3 - 1.5); // Rumble
        }
    } else {
        if (boostLevelRef.current < 100) {
            boostLevelRef.current += deltaTime * 10; // Recharge
            setBoostLevel(boostLevelRef.current);
        }
        if (!screenCrack && spinOut === 0) setShake(0);
        if (isBoostingRef.current && boostLevelRef.current <= 0) {
             isBoostingRef.current = false; // Auto cut-off
             setIsBoosting(false);
        }
    }

    // Damage Effects
    if (damage > 50) {
         // Smoke
         if (Math.random() < 0.1) spawnParticles(playerPos.current, 85, 1, 'smoke_damage');
    }
    if (damage > 75) {
         // Fire
         if (Math.random() < 0.15) spawnParticles(playerPos.current, 85, 1, 'fire');
    }

    // Spawn Logic
    if (time - lastSpawn.current > (baseSpawnRate / (isBoostingRef.current ? 2 : 1))) {
      spawnEntity();
      lastSpawn.current = time;
    }

    // Movement Logic
    const speed = vehicle.speed * 50 * speedMultiplier * (isBoostingRef.current ? 2 : 1);
    
    // Handling modifier based on weather
    const handlingMod = weather === WeatherType.RAIN ? 0.8 : 1.0;
    
    if (keysPressed.current['ArrowLeft']) playerPos.current = Math.max(5, playerPos.current - vehicle.handling * handlingMod * 60 * deltaTime);
    if (keysPressed.current['ArrowRight']) playerPos.current = Math.min(95, playerPos.current + vehicle.handling * handlingMod * 60 * deltaTime);

    // Update Entities
    entities.current.forEach(entity => {
      let moveSpeed = speed;
      if (entity.speedOffset) moveSpeed *= (1 + entity.speedOffset);
      
      entity.y += moveSpeed * deltaTime;
      
      // Horizontal movement for obstacles
      if (entity.vx) {
          entity.x += entity.vx * deltaTime;
      }
      
      // Magnet Effect
      if (magnetTimer.current > 0 && (entity.type === EntityType.PACKAGE || entity.type === EntityType.COIN)) {
           const dx = playerPos.current - entity.x;
           const dy = 85 - entity.y;
           const dist = Math.sqrt(dx*dx + dy*dy);
           if (dist < 30) {
               entity.x += dx * 5 * deltaTime;
               entity.y += dy * 5 * deltaTime;
           }
      }
    });

    // Collision Detection
    const playerRect = { x: playerPos.current - 4, y: 80, width: 8, height: 8 }; // Approximate hit box
    
    entities.current = entities.current.filter(entity => {
      // Check collision
      if (
        entity.x < playerRect.x + playerRect.width &&
        entity.x + entity.width > playerRect.x &&
        entity.y < playerRect.y + playerRect.height &&
        entity.y + entity.height > playerRect.y
      ) {
        // Handle Collision
        if (entity.type === EntityType.PACKAGE) {
          playCollectSound();
          earnedMoneyRef.current += (10 * vehicle.incomeMultiplier);
          setEarnedMoney(Math.floor(earnedMoneyRef.current));
          spawnParticles(entity.x, entity.y, 10, 'collect');
          showFeedback(<span>+${10 * vehicle.incomeMultiplier}</span>, entity.x, entity.y, 'text-green-400');
          return false;
        } else if (entity.type === EntityType.COIN) {
           playCollectSound();
           earnedMoneyRef.current += (50 * vehicle.incomeMultiplier);
           setEarnedMoney(Math.floor(earnedMoneyRef.current));
           spawnParticles(entity.x, entity.y, 15, 'coin');
           showFeedback(<span>+${50 * vehicle.incomeMultiplier}</span>, entity.x, entity.y, 'text-yellow-400');
           return false;
        } else if (entity.type === EntityType.POWERUP_SHIELD) {
            playPowerupSound();
            shieldActive.current = true;
            showFeedback(<div className="flex items-center gap-1"><Shield size={16}/> SHIELD</div>, entity.x, entity.y, 'text-blue-400');
            return false;
        } else if (entity.type === EntityType.POWERUP_MAGNET) {
            playMagnetSound();
            magnetTimer.current = 10; // 10 seconds
            showFeedback(<div className="flex items-center gap-1"><Magnet size={16}/> MAGNET</div>, entity.x, entity.y, 'text-purple-400');
            return false;
        } else {
          // Obstacle Hit
          if (shieldActive.current) {
              playShieldBreakSound();
              shieldActive.current = false;
              spawnParticles(entity.x, entity.y, 20, 'shield_break');
              showFeedback("BLOCKED!", entity.x, entity.y, 'text-blue-500');
              setShake(5); // Impact shake
              setTimeout(() => setShake(0), 300);
              return false; // Destroy obstacle
          }

          // Damage
          setTimeLeft(prev => Math.max(0, prev - 2));
          setDamage(prev => Math.min(100, prev + 10)); // Increase damage
          setShake(10);
          setScreenCrack(true);
          
          let color = '#ef4444';
          let shape: ParticleShape = 'triangle';
          
          // Specific Obstacle Logic
          if (entity.type === EntityType.OBSTACLE_DOG) { playDogBark(); shape = 'circle'; color = '#92400e'; }
          else if (entity.type === EntityType.OBSTACLE_CAT) { playCatScreech(); shape = 'star'; color = '#fbbf24'; }
          else if (entity.type === EntityType.OBSTACLE_CAR) { playCarHonk(); shape = 'square'; color = '#1e293b'; }
          else if (entity.type === EntityType.OBSTACLE_OIL) {
              playSlipSound();
              setSpinOut(360); // Spin player
              color = '#000000';
              showFeedback("SLIP!", entity.x, entity.y, 'text-slate-400');
              return false;
          } else if (entity.type === EntityType.OBSTACLE_PIGEON) {
              playBirdSound();
              color = '#a8a29e';
              shape = 'triangle';
          }
          else playGenericCrash();

          spawnParticles(entity.x, entity.y, 15, 'crash', { color, shape });
          showFeedback("-2s", entity.x, entity.y, 'text-red-500');
          setTimeout(() => { setShake(0); setScreenCrack(false); }, 400);
          return false;
        }
      }
      
      // Remove if off screen
      return entity.y < 120;
    });

    // Timer
    setTimeLeft(prev => {
        const newVal = prev - deltaTime;
        if (newVal <= 0) {
            gameActive.current = false;
            onGameOver(earnedMoneyRef.current, true, currentRun.current);
            return 0;
        }
        return newVal;
    });

    // Particle Logic
    particles.current.forEach(p => {
        p.x += p.vx * deltaTime;
        p.y += p.vy * deltaTime;
        p.vy += p.gravity * deltaTime;
        p.life -= p.decay * deltaTime;
        p.rotation += p.rotSpeed * deltaTime;
    });
    particles.current = particles.current.filter(p => p.life > 0);

    // Auto-spawn exhaust
    if (time - lastParticleSpawn.current > 100) { // Every 100ms
        spawnParticles(playerPos.current, 90, 1, 'exhaust');
        lastParticleSpawn.current = time;
    }

    animationFrameId.current = requestAnimationFrame(update);
  }, [vehicle, level, onGameOver, spawnParticles, spawnEntity, damage, weather, ghostRun, timeLeft]);

  useEffect(() => {
    animationFrameId.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId.current);
  }, [update]);

  // Touch Controls
  const handleTouchStart = (direction: 'left' | 'right' | 'boost') => {
      if (direction === 'boost') {
          if (!isBoostingRef.current) {
               playBoostSound();
               spawnParticles(playerPos.current, 85, 20, 'boost');
               setIsBoosting(true);
          }
          isBoostingRef.current = true;
      } else {
          keysPressed.current[direction === 'left' ? 'ArrowLeft' : 'ArrowRight'] = true;
      }
  };

  const handleTouchEnd = (direction: 'left' | 'right' | 'boost') => {
      if (direction === 'boost') {
          isBoostingRef.current = false;
          setIsBoosting(false);
      } else {
          keysPressed.current[direction === 'left' ? 'ArrowLeft' : 'ArrowRight'] = false;
      }
  };

  const activeUpgrades = theme.primaryObstacle ? [] : []; // Just to use theme

  return (
    <div 
        ref={containerRef}
        className={`relative w-full h-full overflow-hidden transition-all duration-300 ${theme.environmentColor} ${isBoosting ? 'scale-[1.02] contrast-125 saturate-125' : ''}`}
        style={{ transform: `translate(${shake}px, ${shake}px)` }}
    >
      {/* Road Background with Perspective */}
      <div className={`absolute inset-0 opacity-30 bg-dashed-line animate-road-scroll ${isBoosting ? 'duration-200' : 'duration-500'}`} 
           style={{ transform: 'perspective(500px) rotateX(20deg) scale(1.5)' }}></div>
      
      {/* Dynamic Sidewalk/Neon Borders */}
      <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-cyan-500 to-transparent opacity-50 shadow-[0_0_15px_rgba(6,182,212,0.8)]"></div>
      <div className="absolute inset-y-0 right-0 w-2 bg-gradient-to-l from-purple-500 to-transparent opacity-50 shadow-[0_0_15px_rgba(168,85,247,0.8)]"></div>

      {/* Boost Vignette Overlay */}
      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${isBoosting ? 'opacity-100' : 'opacity-0'}`}
           style={{ background: 'radial-gradient(circle at center, transparent 40%, rgba(6, 182, 212, 0.4) 100%)', boxShadow: 'inset 0 0 100px rgba(6, 182, 212, 0.5)' }}>
      </div>

      {/* Weather Overlays */}
      {weather === WeatherType.RAIN && (
          <div className="absolute inset-0 pointer-events-none z-20 opacity-50 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')] animate-road-scroll"></div>
      )}
      {weather === WeatherType.FOG && (
          <div className="absolute inset-0 pointer-events-none z-20 bg-gradient-to-b from-gray-400/50 to-transparent h-1/2"></div>
      )}

      {/* Screen Crack Overlay */}
      {screenCrack && (
          <div className="absolute inset-0 pointer-events-none z-50 bg-red-500/10 backdrop-blur-[1px] flex items-center justify-center">
               <div className="text-6xl opacity-50 rotate-12">💥</div>
               <div className="absolute inset-0 border-4 border-red-500/50"></div>
          </div>
      )}

      {/* Speed Lines Effect */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] mix-blend-overlay"></div>
      {displaySpeed > 100 && (
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-white to-transparent w-full h-full"
             style={{ 
                 opacity: (displaySpeed / maxDisplaySpeed) * (isBoosting ? 0.8 : 0.3),
                 backgroundSize: '10px 100%',
                 transform: 'scaleY(20)',
                 mixBlendMode: 'overlay'
             }}>
        </div>
      )}

      {/* Particles */}
      {particles.current.map(p => (
          <div
            key={p.id}
            className="absolute rounded-full pointer-events-none"
            style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.size}rem`,
                height: `${p.size}rem`,
                backgroundColor: p.color,
                opacity: p.life,
                transform: `rotate(${p.rotation}deg)`,
                clipPath: p.shape === 'square' ? 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)' :
                          p.shape === 'triangle' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : 
                          p.shape === 'star' ? 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' : 
                          'none'
            }}
          />
      ))}

      {/* Entities */}
      {entities.current.map(entity => (
        <div
          key={entity.id}
          className="absolute flex items-center justify-center transition-transform"
          style={{
            left: `${entity.x}%`,
            top: `${entity.y}%`,
            width: `${entity.width}%`,
            height: `${entity.height}%`,
            fontSize: `${entity.width * 0.25}rem`,
            transform: entity.vx ? `scaleX(${entity.vx > 0 ? -1 : 1})` : 'none'
          }}
        >
          {entity.type === EntityType.PACKAGE && <Package className="text-yellow-600 drop-shadow-lg" size={32} fill="#fbbf24" />}
          {entity.type === EntityType.COIN && <div className="text-2xl animate-pulse">🪙</div>}
          {entity.type === EntityType.POWERUP_SHIELD && <Shield className="text-blue-500 drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]" size={28} fill="#3b82f6" />}
          {entity.type === EntityType.POWERUP_MAGNET && <Magnet className="text-purple-500 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]" size={28} fill="#a855f7" />}
          {entity.type === EntityType.OBSTACLE_DOG && <div className="text-2xl">🐕</div>}
          {entity.type === EntityType.OBSTACLE_CAT && <div className="text-2xl">🐈</div>}
          {entity.type === EntityType.OBSTACLE_PERSON && <div className="text-2xl">🚶</div>}
          {entity.type === EntityType.OBSTACLE_KID && <div className="text-2xl">🧒</div>}
          {entity.type === EntityType.OBSTACLE_CONE && <div className="text-2xl">⚠️</div>}
          {entity.type === EntityType.OBSTACLE_BARRIER && <div className="bg-stripes-yellow-black w-full h-full rounded border-2 border-yellow-600 shadow-lg">🚧</div>}
          {entity.type === EntityType.OBSTACLE_CAR && <div className="text-4xl">🚗</div>}
          {entity.type === EntityType.OBSTACLE_OIL && <div className="text-3xl opacity-80">⚫</div>}
          {entity.type === EntityType.OBSTACLE_PIGEON && <div className="text-2xl animate-bounce">🐦</div>}
        </div>
      ))}

      {/* Ghost Player */}
      {ghostPos !== null && (
          <div 
            className="absolute transition-all duration-300 text-5xl opacity-40 grayscale pointer-events-none"
            style={{
                left: `${ghostPos}%`,
                top: '80%',
                transform: 'translateX(-50%)',
                filter: 'drop-shadow(0 0 10px white)'
            }}
          >
              <div className="relative">
                  {vehicle.icon}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white bg-black/50 px-1 rounded flex items-center gap-1">
                      <Ghost size={8} /> BEST
                  </div>
              </div>
          </div>
      )}

      {/* Player */}
      <div
        ref={playerRef}
        className="absolute transition-all duration-75 text-5xl filter drop-shadow-xl z-10"
        style={{
          left: `${playerPos.current}%`,
          top: '80%',
          transform: `translateX(-50%) rotate(${ (keysPressed.current['ArrowLeft'] ? -15 : keysPressed.current['ArrowRight'] ? 15 : 0) + spinOut}deg) ${damage > 70 ? `translate(${Math.random()*2}px, ${Math.random()*2}px)` : ''}`,
          filter: isBoosting 
            ? 'drop-shadow(0 0 15px #06b6d4) brightness(1.2)' 
            : damage > 0 
                ? `sepia(${damage}%) saturate(${100 + damage}%) hue-rotate(-${damage * 0.5}deg) drop-shadow(0 4px 6px rgba(0,0,0,0.5))`
                : 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))'
        }}
      >
        {vehicle.icon}
        {/* Shield Overlay */}
        {shieldActive.current && (
            <div className="absolute -inset-2 rounded-full border-2 border-blue-400 bg-blue-400/20 animate-pulse shadow-[0_0_15px_#3b82f6]"></div>
        )}
        {/* Magnet Overlay */}
        {magnetTimer.current > 0 && (
             <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-purple-300 font-bold bg-purple-900/80 px-1 rounded animate-bounce">
                 🧲 {Math.ceil(magnetTimer.current)}s
             </div>
        )}
      </div>

      {/* HUD - Top Bar */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start text-white bg-gradient-to-b from-black/80 to-transparent z-20">
        <div>
           <div className="text-3xl font-bold font-mono tracking-widest flex items-center gap-2" style={{ color: timeLeft < 5 ? '#ef4444' : 'white' }}>
             {timeLeft.toFixed(1)}s
           </div>
           <div className="text-sm text-slate-300 font-bold uppercase tracking-wider">{theme.title}</div>
           
           {/* Weather Icon */}
           {weather !== WeatherType.CLEAR && (
               <div className="mt-1 flex items-center gap-1 text-xs font-bold text-slate-300">
                   {weather === WeatherType.RAIN ? <CloudRain size={12} className="text-blue-400"/> : <CloudFog size={12} className="text-gray-400"/>}
                   {weather}
               </div>
           )}

           {/* Damage Indicator */}
           {damage > 0 && (
               <div className="mt-2 flex items-center gap-1 text-xs font-bold text-red-400 animate-pulse">
                   <Wrench size={12} /> {damage}% DMG
                   <div className="w-16 h-1 bg-red-900 rounded-full overflow-hidden ml-1">
                       <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${damage}%` }}></div>
                   </div>
               </div>
           )}
        </div>
        
        <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 bg-black/50 px-3 py-1 rounded-full border border-slate-700 backdrop-blur-sm">
                <span className="text-yellow-400 font-bold text-xl">${earnedMoney}</span>
                <Trophy size={16} className="text-yellow-600" />
            </div>
            
            {/* Speedometer */}
            <div className="relative w-32 h-16 bg-black/60 rounded-t-full border-t-2 border-x-2 border-slate-600 overflow-hidden flex items-end justify-center pb-1">
                 <div className="absolute bottom-0 w-full h-full flex items-end justify-center">
                     <div className="w-[90%] h-[90%] rounded-t-full border-[6px] border-slate-700 border-b-0 relative"></div>
                 </div>
                 {/* Needle */}
                 <div 
                    className="absolute bottom-1 left-1/2 w-1 h-[85%] bg-red-500 origin-bottom transition-transform duration-100 ease-out z-10"
                    style={{ transform: `translateX(-50%) rotate(${(gaugePercent * 1.8) - 90}deg)` }}
                 ></div>
                 <div className="relative z-20 font-mono text-xs font-bold text-cyan-400">{displaySpeed} KM/H</div>
            </div>
            
            <button onClick={togglePause} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 border border-slate-600">
                <Pause size={16} />
            </button>
        </div>
      </div>
      
      {/* HUD - Mini Map */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-48 bg-black/40 border border-slate-600 rounded-full overflow-hidden hidden md:block backdrop-blur">
           {/* Player Dot */}
           <div className="absolute left-0 w-full h-1 bg-blue-500 top-[80%] shadow-[0_0_5px_#3b82f6]"></div>
           {/* Entities Dots */}
           {entities.current.map(e => {
               // Map world Y (-15 to 120) to map height (0 to 100%)
               // If entity.y is 120 (bottom), map is 100%. If -15 (top), map is 0%.
               // Actually map is simplified: items come from top (0) to bottom (100). 
               // Player is at 80%.
               const mapY = Math.max(0, Math.min(100, (e.y + 15) / 1.35)); 
               
               let color = 'bg-white';
               if (e.type === EntityType.PACKAGE) color = 'bg-green-400';
               if (e.type === EntityType.COIN) color = 'bg-yellow-400';
               if (e.type.includes('OBSTACLE')) color = 'bg-red-500';
               
               return (
                   <div key={e.id} className={`absolute left-0.5 w-2 h-2 rounded-full ${color}`} style={{ top: `${mapY}%` }}></div>
               )
           })}
      </div>

      {/* Boost Bar - Right Side */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 h-48 w-4 bg-slate-800 rounded-full border border-slate-600 overflow-hidden shadow-xl">
          <div 
            className={`absolute bottom-0 w-full transition-all duration-100 ${isBoosting ? 'bg-cyan-400 animate-pulse shadow-[0_0_15px_#22d3ee]' : 'bg-blue-600'}`}
            style={{ height: `${boostLevel}%` }}
          ></div>
          <div className="absolute bottom-1 w-full flex justify-center">
              <Zap size={10} className={isBoosting ? "text-white fill-white" : "text-blue-300"} />
          </div>
      </div>

      {/* Popups */}
      {feedback.map(f => (
          <div 
            key={f.id} 
            className={`absolute font-black text-2xl animate-bounce pointer-events-none whitespace-nowrap z-30 ${f.color}`}
            style={{ left: `${f.x}%`, top: `${f.y}%`, textShadow: '2px 2px 0px rgba(0,0,0,0.8)' }}
          >
              {f.text}
          </div>
      ))}

      {/* Mobile Controls Overlay */}
      <div className="absolute bottom-0 left-0 w-full h-1/3 flex z-30">
          <div 
            className="flex-1 active:bg-white/10 flex items-center justify-center transition-colors"
            onTouchStart={() => handleTouchStart('left')}
            onTouchEnd={() => handleTouchEnd('left')}
          >
              <ChevronLeft size={48} className="text-white/20" />
          </div>
          <div className="w-1/4"></div> {/* Dead zone center */}
          <div 
            className="flex-1 active:bg-white/10 flex items-center justify-center transition-colors"
            onTouchStart={() => handleTouchStart('right')}
            onTouchEnd={() => handleTouchEnd('right')}
          >
              <ChevronRight size={48} className="text-white/20" />
          </div>
      </div>
      
      {/* Boost Button (Mobile) */}
      <button
          className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border-4 flex items-center justify-center z-40 transition-all active:scale-95 shadow-lg ${
              boostLevel > 0 
              ? 'bg-blue-600/80 border-blue-400 text-white shadow-blue-500/30' 
              : 'bg-slate-700/80 border-slate-600 text-slate-500'
          }`}
          onTouchStart={() => handleTouchStart('boost')}
          onTouchEnd={() => handleTouchEnd('boost')}
          onMouseDown={() => handleTouchStart('boost')} // Mouse fallback
          onMouseUp={() => handleTouchEnd('boost')}
      >
          <Zap size={32} className={isBoosting ? "fill-white animate-pulse" : ""} />
      </button>

      {/* Pause Menu */}
      {isPaused && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl w-full max-w-xs text-center space-y-4">
                  <h2 className="text-3xl font-bold text-white mb-6">PAUSED</h2>
                  
                  <button onClick={togglePause} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                      <Play size={20} /> Resume
                  </button>
                  
                  <button onClick={handleRestart} className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                      <RotateCcw size={20} /> Restart Level
                  </button>

                  <button onClick={handleSkip} className="w-full bg-purple-700 hover:bg-purple-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                      <FastForward size={20} /> Skip Level
                  </button>
                  
                  <button onClick={handleQuit} className="w-full bg-red-900/50 hover:bg-red-800/50 text-red-200 border border-red-800 py-3 rounded-xl font-bold flex items-center justify-center gap-2 mt-4">
                      <LogOut size={20} /> Quit to Shop
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};
