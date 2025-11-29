
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
  playMagnetSound,
  playSlipSound,
  playBirdSound
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
  const [spinOut, setSpinOut] = useState(0); // Degrees of rotation from slipping
  
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
            vx = (Math.random() - 0.5) * 60; // Wider spread
            vy = 50 + Math.random() * 30; // Moves down fast
            size = Math.random() * 1.0 + 0.5;
            decay = 2.0;
            color = Math.random() > 0.5 ? '#06b6d4' : '#60a5fa'; // Cyan/Blue flames
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
                spawnParticles(playerPos.current, 85, 25, 'boost');
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
      setSpinOut(0);
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
      animationFrameId.current = requestAnimationFrame(update);
      return;
    }

    const deltaTime = Math.min((time - lastTime.current) / 1000, 0.1);
    lastTime.current = time;

    // Spin Decay
    if (spinOut > 0) {
        setSpinOut(prev => Math.max(0, prev - 720 * deltaTime)); // Spin back to 0 over ~0.5s
    }

    // Magnet Timer
    if (magnetTimer.current > 0)