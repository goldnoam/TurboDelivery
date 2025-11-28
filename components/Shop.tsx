
import React, { useState } from 'react';
import { VehicleType, GameState } from '../types';
import { VEHICLES } from '../constants';
import { ShoppingCart, Check, Lock, Play, Zap, ArrowUpCircle, AlertTriangle, X, Gauge, Move, DollarSign, Plus } from 'lucide-react';
import { playPurchaseSound, playUpgradeSound } from '../audio';

interface ShopProps {
  gameState: GameState;
  onPurchase: (vehicleId: VehicleType) => void;
  onUpgrade: (vehicleId: VehicleType, stat: 'speed' | 'handling' | 'income') => void;
  onEquip: (vehicleId: VehicleType) => void;
  onNextLevel: () => void;
}

export const Shop: React.FC<ShopProps> = ({ gameState, onPurchase, onUpgrade, onEquip, onNextLevel }) => {
  const [confirmPurchaseId, setConfirmPurchaseId] = useState<VehicleType | null>(null);

  const getUpgradeCost = (vehicleId: VehicleType, currentLevel: number) => {
      const basePrice = Math.max(VEHICLES[vehicleId].price * 0.1, 50);
      return Math.floor(basePrice * currentLevel * 1.5);
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

  const renderUpgradeRow = (
      vehicleId: VehicleType, 
      stat: 'speed' | 'handling' | 'income', 
      label: string, 
      icon: React.ReactNode, 
      color: string
    ) => {
      const upgrades = gameState.vehicleUpgrades[vehicleId] || { speed: 1, handling: 1, income: 1 };
      const currentLevel = upgrades[stat];
      const cost = getUpgradeCost(vehicleId, currentLevel);
      const canAfford = gameState.money >= cost;
      const isMaxed = currentLevel >= 5;

      return (
          <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 w-20">
                  <div className={`p-1 rounded ${color} bg-opacity-20`}>{icon}</div>
                  <span className="font-bold text-slate-300">{label}</span>
              </div>
              
              <div className="flex-1 flex gap-0.5 h-2 bg-slate-800 rounded-full overflow-hidden">
                  {[1, 2, 3, 4, 5].map(lvl => (
                      <div 
                        key={lvl} 
                        className={`flex-1 transition-all ${
                            lvl <= currentLevel 
                                ? color.replace('text-', 'bg-') 
                                : 'bg-slate-700'
                        }`}
                      />
                  ))}
              </div>

              {!isMaxed ? (
                   <button
                   onClick={() => {
                       playUpgradeSound();
                       onUpgrade(vehicleId, stat);
                   }}
                   disabled={!canAfford}
                   className={`px-2 py-1 rounded flex items-center gap-1 min-w-[60px] justify-center transition-all ${
                       canAfford 
                       ? 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600' 
                       : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-800'
                   }`}
                   >
                       {canAfford ? <Plus size={10} /> : <Lock size={10} />}
                       ${cost}
                   </button>
              ) : (
                  <div className="px-2 py-1 min-w-[60px] text-center font-bold text-slate-500 bg-slate-900 rounded border border-slate-800">
                      MAX
                  </div>
              )}
          </div>
      );
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
          
          const upgrades = gameState.vehicleUpgrades[vehicle.id] || { speed: 1, handling: 1, income: 1 };
          
          return (
            <div
              key={vehicle.id}
              className={`relative group rounded-2xl p-4 transition-all duration-300 border-2 flex flex-col ${
                isEquipped
                  ? 'bg-slate-800 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                  : isOwned
                  ? 'bg-slate-900 border-slate-700 hover:border-slate-500'
                  : 'bg-slate-900/50 border-slate-800 opacity-80'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="text-5xl filter drop-shadow-lg group-hover:scale-110 transition-transform duration-300">
                  {vehicle.icon}
                </div>
                <div className="flex flex-col items-end gap-2">
                    {isEquipped && (
                    <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full border border-green-500/50 font-bold uppercase tracking-wider">
                        Equipped
                    </span>
                    )}
                </div>
              </div>

              <h3 className="text-xl font-bold mb-1">{vehicle.name}</h3>
              <p className="text-xs text-slate-400 mb-4 h-8 leading-snug line-clamp-2">{vehicle.description}</p>

              {isOwned ? (
                  <div className="flex flex-col gap-3 mb-4 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                       {renderUpgradeRow(vehicle.id, 'speed', 'Speed', <Gauge size={12} />, 'text-blue-400')}
                       {renderUpgradeRow(vehicle.id, 'handling', 'Handling', <Move size={12} />, 'text-purple-400')}
                       {renderUpgradeRow(vehicle.id, 'income', 'Income', <DollarSign size={12} />, 'text-yellow-400')}
                  </div>
              ) : (
                  <div className="flex-grow flex flex-col justify-end space-y-2 mb-4">
                       <div className="flex justify-between text-xs text-slate-500">
                           <span>Base Speed</span>
                           <span className="text-blue-400">{vehicle.speed}x</span>
                       </div>
                       <div className="flex justify-between text-xs text-slate-500">
                           <span>Base Handling</span>
                           <span className="text-purple-400">{vehicle.handling}x</span>
                       </div>
                       <div className="flex justify-between text-xs text-slate-500">
                           <span>Multiplier</span>
                           <span className="text-yellow-400">{vehicle.incomeMultiplier}x</span>
                       </div>
                  </div>
              )}

              <div className="mt-auto">
                {isOwned ? (
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
