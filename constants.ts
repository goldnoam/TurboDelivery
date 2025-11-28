import { VehicleStats, VehicleType } from './types';

export const LEVEL_DURATION = 20; // seconds

export const VEHICLES: Record<VehicleType, VehicleStats> = {
  [VehicleType.SCOOTER]: {
    id: VehicleType.SCOOTER,
    name: "Rusty Scooter",
    price: 0,
    speed: 1.0,
    handling: 1.0,
    incomeMultiplier: 1,
    icon: "🛴",
    description: "It squeaks, but it moves."
  },
  [VehicleType.BICYCLE]: {
    id: VehicleType.BICYCLE,
    name: "Speedy Bike",
    price: 150,
    speed: 1.2,
    handling: 1.2,
    incomeMultiplier: 1.5,
    icon: "🚲",
    description: "Pedal power! Good for tight squeezes."
  },
  [VehicleType.HOVERBOARD]: {
    id: VehicleType.HOVERBOARD,
    name: "Neon Board",
    price: 450,
    speed: 1.4,
    handling: 0.8, // Floaty
    incomeMultiplier: 2.5,
    icon: "🛸",
    description: "Future tech. A bit slippery."
  },
  [VehicleType.SEGWAY]: {
    id: VehicleType.SEGWAY,
    name: "Tech Roller",
    price: 900,
    speed: 1.3,
    handling: 1.5,
    incomeMultiplier: 3.5,
    icon: "🤖",
    description: "Maximum balance, maximum efficiency."
  },
  [VehicleType.ATV]: {
    id: VehicleType.ATV,
    name: "Mud Masher",
    price: 1500,
    speed: 1.6,
    handling: 1.4,
    incomeMultiplier: 4.0,
    icon: "🚜", // Using tractor emoji as closest for ATV/Quad if generic not avail, or 4-wheeler
    description: "Off-road beast. Handles bumps like a champ."
  },
  [VehicleType.MOTORCYCLE]: {
    id: VehicleType.MOTORCYCLE,
    name: "Road King",
    price: 2000,
    speed: 1.8,
    handling: 1.1,
    incomeMultiplier: 5,
    icon: "🏍️",
    description: "Loud, fast, and dangerous."
  },
  [VehicleType.TRACTOR]: {
    id: VehicleType.TRACTOR,
    name: "Farm Heavy",
    price: 3500,
    speed: 1.1,
    handling: 0.7,
    incomeMultiplier: 7.0,
    icon: "🚜", 
    description: "Slow as molasses, but carries a ton."
  },
  [VehicleType.RACECAR]: {
    id: VehicleType.RACECAR,
    name: "F1 Delivery",
    price: 5000,
    speed: 2.2,
    handling: 1.8,
    incomeMultiplier: 10,
    icon: "🏎️",
    description: "When same-day delivery isn't fast enough."
  }
};

export const INITIAL_GAME_STATE = {
  money: 0,
  currentLevel: 1,
  ownedVehicles: [VehicleType.SCOOTER],
  equippedVehicle: VehicleType.SCOOTER,
  highScore: 0,
  vehicleLevels: {
    [VehicleType.SCOOTER]: 1,
    [VehicleType.BICYCLE]: 1,
    [VehicleType.HOVERBOARD]: 1,
    [VehicleType.SEGWAY]: 1,
    [VehicleType.ATV]: 1,
    [VehicleType.MOTORCYCLE]: 1,
    [VehicleType.TRACTOR]: 1,
    [VehicleType.RACECAR]: 1
  }
};