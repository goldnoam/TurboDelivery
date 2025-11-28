
import React, { useState, useEffect } from 'react';
import { GameState, VehicleType, LevelTheme, VehicleStats } from './types';
import { INITIAL_GAME_STATE, VEHICLES } from './constants';
import { Shop } from './components/Shop';
import { GameLoop } from './components/GameLoop';
import { generateLevelMission } from './services/geminiService';
import { Rocket, Package, AlertTriangle, PlayCircle, Info, X } from 'lucide-react';
import { initAudio } from './audio';

enum AppState {
  MENU = 'MENU',
  LOADING_LEVEL = 'LOADING_LEVEL',
  PLAYING = 'PLAYING',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE',
  GAME_OVER = 'GAME_OVER',
  SHOP = 'SHOP'
}

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [appState, setAppState] = useState<AppState>(AppState.MENU);
  const [levelTheme, setLevelTheme] = useState<LevelTheme | null>(null);
  const [lastEarnings, setLastEarnings] = useState(0);
  const [showInstructions, setShowInstructions] = useState(false);

  // Load High Score
  useEffect(() => {
    const saved = localStorage.getItem('tdd_highscore');
    if (saved) {
      setGameState(prev => ({ ...prev, highScore: parseInt(saved) }));
    }
  }, []);

  const getEffectiveStats = (vehicleId: VehicleType): VehicleStats => {
      const base = VEHICLES[vehicleId];
      const level = gameState.vehicleLevels[vehicleId] || 1;
      const levelMult = level - 1;
      
      return {
          ...base,
          speed: base.speed * (1 + levelMult * 0.1),
          handling: base.handling * (1 + levelMult * 0.05),
          incomeMultiplier: parseFloat((base.incomeMultiplier * (1 + levelMult * 0.2)).toFixed(2))
      };
  };

  const startGame = async () => {
    initAudio(); // Initialize audio context on user interaction
    setAppState(AppState.LOADING_LEVEL);
    const vehicleName = VEHICLES[gameState.equippedVehicle].name;
    const theme = await generateLevelMission(gameState.currentLevel, vehicleName);
    setLevelTheme(theme);
    setAppState(AppState.PLAYING);
  };

  const handleGameOver = (earnings: number, survived: boolean) => {
    setLastEarnings(earnings);
    setGameState(prev => {
      const newMoney = prev.money + earnings;
      const newHighScore = Math.max(prev.highScore, newMoney); 
      localStorage.setItem('tdd_highscore', newHighScore.toString());
      
      return {
        ...prev,
        money: newMoney,
        highScore: newHighScore
      };
    });
    setAppState(AppState.LEVEL_COMPLETE);
  };

  const purchaseVehicle = (id: VehicleType) => {
    const vehicle = VEHICLES[id];
    if (gameState.money >= vehicle.price && !gameState.ownedVehicles.includes(id)) {
      setGameState(prev => ({
        ...prev,
        money: prev.money - vehicle.price,
        ownedVehicles: [...prev.ownedVehicles, id],
        equippedVehicle: id,
        vehicleLevels: { ...prev.vehicleLevels, [id]: 1 } // Ensure initialized
      }));
    }
  };

  const upgradeVehicle = (id: VehicleType) => {
      const currentLevel = gameState.vehicleLevels[id] || 1;
      const basePrice = VEHICLES[id].price || 100;
      const cost = Math.floor(basePrice * 0.4 * currentLevel) + (100 * currentLevel);

      if (gameState.money >= cost) {
          setGameState(prev => ({
              ...prev,
              money: prev.money - cost,
              vehicleLevels: {
                  ...prev.vehicleLevels,
                  [id]: currentLevel + 1
              }
          }));
      }
  };

  const equipVehicle = (id: VehicleType) => {
    if (gameState.ownedVehicles.includes(id)) {
      setGameState(prev => ({ ...prev, equippedVehicle: id }));
    }
  };

  const advanceLevel = () => {
    setGameState(prev => ({ ...prev, currentLevel: prev.currentLevel + 1 }));
    startGame();
  };

  // Render Screens
  if (appState === AppState.MENU) {
    return (
      <div className="h-screen w-full bg-slate-900 flex flex-col items-center justify-center text-white p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1565514020176-892eb1036631?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80')] bg-cover bg-center opacity-20"></div>
        <div className="z-10 text-center max-w-md w-full">
            <div className="mb-6 flex justify-center">
                <Rocket size={64} className="text-orange-500 animate-bounce" />
            </div>
            <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-orange-400 to-red-600 bg-clip-text text-transparent mb-4 drop-shadow-sm">
                TURBO<br/>DELIVERY
            </h1>
            <p className="text-slate-300 mb-8 text-lg">Delivering packages at Mach 1.</p>
            
            <div className="flex flex-col gap-4">
                <button 
                    onClick={startGame}
                    className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 px-8 rounded-full text-xl shadow-lg shadow-orange-900/50 transform transition active:scale-95 flex items-center justify-center gap-3"
                >
                    <PlayCircle size={24} /> START SHIFT
                </button>
                <button 
                    onClick={() => setShowInstructions(true)}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 px-8 rounded-full shadow-lg transform transition active:scale-95 flex items-center justify-center gap-3"
                >
                    <Info size={20} /> HOW TO PLAY
                </button>
            </div>
            
            {gameState.highScore > 0 && (
                <div className="mt-8 p-4 bg-black/40 rounded-xl border border-white/10">
                    <p className="text-xs text-slate-400 uppercase tracking-widest">Career High Earnings</p>
                    <p className="text-2xl font-mono text-green-400">${gameState.highScore.toLocaleString()}</p>
                </div>
            )}
        </div>

        {/* Instructions Modal */}
        {showInstructions && (
            <div className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
                <div className="bg-slate-800 p-6 rounded-2xl max-w-sm w-full border border-slate-700 relative">
                    <button 
                        onClick={() => setShowInstructions(false)}
                        className="absolute top-4 right-4 text-slate-400 hover:text-white"
                    >
                        <X size={24} />
                    </button>
                    <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                        <Info className="text-blue-400" /> Instructions
                    </h2>
                    <ul className="space-y-4 text-slate-300 text-sm">
                        <li className="flex gap-3">
                            <span className="bg-slate-700 p-2 rounded h-fit">⬅️ ➡️</span>
                            <div>
                                <strong className="text-white block">Controls</strong>
                                Use Arrow Keys or the on-screen buttons to steer left and right.
                            </div>
                        </li>
                        <li className="flex gap-3">
                            <span className="bg-green-500/20 text-green-400 p-2 rounded h-fit">📦</span>
                            <div>
                                <strong className="text-white block">Collect</strong>
                                Grab packages and coins to earn cash.
                            </div>
                        </li>
                        <li className="flex gap-3">
                            <span className="bg-red-500/20 text-red-400 p-2 rounded h-fit">🐕</span>
                            <div>
                                <strong className="text-white block">Avoid</strong>
                                Dodging obstacles keeps your time bonus high. Hitting them loses precious seconds!
                            </div>
                        </li>
                        <li className="flex gap-3">
                            <span className="bg-yellow-500/20 text-yellow-400 p-2 rounded h-fit">⚡</span>
                            <div>
                                <strong className="text-white block">Upgrade</strong>
                                Use cash to buy faster vehicles or upgrade your current ride in the Garage.
                            </div>
                        </li>
                    </ul>
                    <button 
                        onClick={() => setShowInstructions(false)}
                        className="mt-6 w-full bg-blue-600 py-3 rounded-lg font-bold text-white"
                    >
                        Got it!
                    </button>
                </div>
            </div>
        )}
      </div>
    );
  }

  if (appState === AppState.LOADING_LEVEL) {
    return (
      <div className="h-screen w-full bg-black flex flex-col items-center justify-center text-white p-8 text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-6"></div>
        <h2 className="text-2xl font-bold mb-2">Connecting to HQ...</h2>
        <p className="text-slate-400">Downloading mission parameters.</p>
      </div>
    );
  }

  if (appState === AppState.PLAYING && levelTheme) {
    return (
      <div className="h-screen w-full max-w-md mx-auto relative shadow-2xl overflow-hidden bg-gray-900">
        <GameLoop 
            vehicle={getEffectiveStats(gameState.equippedVehicle)} 
            theme={levelTheme}
            level={gameState.currentLevel}
            onGameOver={handleGameOver}
        />
      </div>
    );
  }

  if (appState === AppState.LEVEL_COMPLETE) {
    return (
      <div className="h-screen w-full bg-slate-900 flex flex-col items-center justify-center text-white p-6 text-center">
        <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 max-w-sm w-full shadow-2xl transform transition-all animate-in fade-in zoom-in duration-300">
            <div className="inline-block p-4 bg-green-500/20 rounded-full mb-4">
                <Package size={48} className="text-green-400" />
            </div>
            <h2 className="text-3xl font-bold mb-2">Shift Complete!</h2>
            <p className="text-slate-400 mb-6">Excellent work out there.</p>
            
            <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <span className="text-slate-400">Earnings</span>
                    <span className="text-2xl font-mono text-green-400">+${lastEarnings}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <span className="text-slate-400">Total Bank</span>
                    <span className="text-xl font-mono text-white">${gameState.money.toLocaleString()}</span>
                </div>
            </div>

            <button 
                onClick={() => setAppState(AppState.SHOP)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-colors"
            >
                Go to Garage
            </button>
        </div>
      </div>
    );
  }

  if (appState === AppState.SHOP) {
      return (
          <Shop 
            gameState={gameState}
            onPurchase={purchaseVehicle}
            onUpgrade={upgradeVehicle}
            onEquip={equipVehicle}
            onNextLevel={advanceLevel}
          />
      )
  }

  return <div>Error: Unknown State</div>;
};

export default App;
