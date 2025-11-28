
import React, { useState } from 'react';
import { VehicleType, GameState } from '../types';
import { VEHICLES } from '../constants';
import { ShoppingCart, Check, Lock, Play, Zap, ArrowUpCircle, AlertTriangle, X } from 'lucide-react';
import { playPurchaseSound, playUpgradeSound } from '../audio';

interface ShopProps {
  gameState: GameState;
  onPurchase: (vehicleId: VehicleType) => void;
  onUpgrade: (vehicleId: VehicleType) => void;
  onEquip: (vehicleId: VehicleType) => void;
  onNextLevel: () => void;
}

export const Shop: React.FC<ShopProps> = ({ gameState, onPurchase, onUpgrade, onEquip, onNextLevel }) => {
  const [confirmPurchaseId, setConfirmPurchaseId] = useState<VehicleType | null>(null);

  const getUpgradeCost = (vehicleId: VehicleType, currentLevel: number) => {
      const basePrice = VEHICLES[vehicleId].price || 100; // Handle free scooter base
      return Math.floor(basePrice * 0.4 * currentLevel) + (100 * currentLevel);
  };

  const handlePurchaseClick = (vehicleId: VehicleType) => {
    setConfirmPurchaseId(vehicleId);
  };

  const confirmPurchase = () => {
    if (confirmPurchaseId) {
      playPurchaseSound();
      onPurchase(confirmPurchaseId);
      setConfirmPurchaseId(null);
    }
  };

  const cancelPurchase = () => {
    setConfirmPurchaseId(null);
  };

  return (
    <div className="absolute inset-0 bg-slate-950 text-white flex flex-col p-4 md:p-8 overflow-y-auto">
      <div className="flex justify-between items-center mb-8 bg-slate-900 p-4 rounded-xl border border-slate-700 sticky top-0 z-10 shadow-xl">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
            Garage
          </h1>
          <p className="text-slate-400 text-sm">Level {gameState.currentLevel} Complete</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="text-right">
                <p className="text-xs text-slate-400 uppercase tracking-wider">Bank</p>
                <p className="text-2xl font-mono text-green-400">${gameState.money.toLocaleString()}</p>
            </div>
          <button
            onClick={onNextLevel}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg transform transition active:scale-95"
          >
            Next Mission <Play size={20} fill="currentColor" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
        {Object.values(VEHICLES).map((vehicle) => {
          const isOwned = gameState.ownedVehicles.includes(vehicle.id);
          const isEquipped = gameState.equippedVehicle === vehicle.id;
          const canAfford = gameState.money >= vehicle.price;
          
          const currentLevel = gameState.vehicleLevels[vehicle.id] || 1;
          const upgradeCost = getUpgradeCost(vehicle.id, currentLevel);
          const canAffordUpgrade = gameState.money >= upgradeCost;

          // Calculate current stats based on level
          const speedPercent = Math.min(100, (vehicle.speed * (1 + (currentLevel - 1) * 0.1)) * 20); 
          const handlingPercent = Math.min(100, (vehicle.handling * (1 + (currentLevel - 1) * 0.05)) * 25);
          const incomeDisplay = (vehicle.incomeMultiplier * (1 + (currentLevel - 1) * 0.2)).toFixed(1);

          return (
            <div
              key={vehicle.id}
              className={`relative group rounded-2xl p-6 transition-all duration-300 border-2 flex flex-col ${
                isEquipped
                  ? 'bg-slate-800 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                  : isOwned
                  ? 'bg-slate-900 border-slate-700 hover:border-slate-500'
                  : 'bg-slate-900/50 border-slate-800 opacity-80'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="text-6xl filter drop-shadow-lg group-hover:scale-110 transition-transform duration-300">
                  {vehicle.icon}
                </div>
                <div className="flex flex-col items-end gap-2">
                    {isEquipped && (
                    <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full border border-green-500/50 font-bold uppercase tracking-wider">
                        Equipped
                    </span>
                    )}
                    {isOwned && (
                        <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded-full border border-blue-500/50 font-bold uppercase tracking-wider">
                            Lvl {currentLevel}
                        </span>
                    )}
                </div>
              </div>

              <h3 className="text-xl font-bold mb-1">{vehicle.name}</h3>
              <p className="text-sm text-slate-400 mb-4 h-10 leading-snug">{vehicle.description}</p>

              <div className="space-y-3 mb-6 flex-grow">
                <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Speed</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${speedPercent}%` }} />
                    </div>
                </div>
                <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Handling</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div className="bg-purple-500 h-full rounded-full transition-all duration-500" style={{ width: `${handlingPercent}%` }} />
                    </div>
                </div>
                <div className="flex justify-between text-xs text-slate-400 items-center">
                    <span>Income Multiplier</span>
                    <span className="text-yellow-400 font-mono font-bold bg-yellow-400/10 px-2 py-0.5 rounded">x{incomeDisplay}</span>
                </div>
              </div>

              <div className="space-y-3 mt-auto">
                {isOwned ? (
                    <>
                        <button
                        onClick={() => {
                            playUpgradeSound();
                            onUpgrade(vehicle.id);
                        }}
                        disabled={!canAffordUpgrade}
                        className={`w-full py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all border ${
                            canAffordUpgrade
                            ? 'bg-slate-800 hover:bg-slate-700 border-yellow-500/50 text-yellow-400'
                            : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                        }`}
                        >
                            <ArrowUpCircle size={16} />
                            Upgrade (${upgradeCost.toLocaleString()})
                        </button>

                        <button
                        onClick={() => onEquip(vehicle.id)}
                        disabled={isEquipped}
                        className={`w-full py-3 rounded-xl font-bold transition-all ${
                            isEquipped
                            ? 'bg-slate-700 text-slate-500 cursor-default'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/50'
                        }`}
                        >
                        {isEquipped ? 'Ready' : 'Equip'}
                        </button>
                    </>
                ) : (
                    <button
                    onClick={() => handlePurchaseClick(vehicle.id)}
                    disabled={!canAfford}
                    className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                        canAfford
                        ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-lg shadow-yellow-900/20'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                    >
                    {canAfford ? <ShoppingCart size={18} /> : <Lock size={18} />}
                    ${vehicle.price.toLocaleString()}
                    </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      {confirmPurchaseId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-800 p-6 rounded-2xl max-w-sm w-full border border-slate-700 shadow-2xl transform transition-all scale-100">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <ShoppingCart className="text-yellow-400" /> Confirm Purchase
            </h3>
            <p className="text-slate-300 mb-6">
              Are you sure you want to buy the <span className="text-white font-bold">{VEHICLES[confirmPurchaseId].name}</span> for <span className="text-yellow-400 font-mono">${VEHICLES[confirmPurchaseId].price.toLocaleString()}</span>?
            </p>
            <div className="flex gap-4">
              <button
                onClick={cancelPurchase}
                className="flex-1 py-3 rounded-xl font-bold bg-slate-700 hover:bg-slate-600 text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmPurchase}
                className="flex-1 py-3 rounded-xl font-bold bg-yellow-500 hover:bg-yellow-400 text-black shadow-lg shadow-yellow-900/20 transition-colors"
              >
                Buy Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
