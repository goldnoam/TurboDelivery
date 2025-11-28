
export enum VehicleType {
  SCOOTER = 'SCOOTER',
  BICYCLE = 'BICYCLE',
  HOVERBOARD = 'HOVERBOARD',
  SEGWAY = 'SEGWAY',
  ATV = 'ATV',
  MOTORCYCLE = 'MOTORCYCLE',
  TRACTOR = 'TRACTOR',
  RACECAR = 'RACECAR'
}

export interface VehicleStats {
  id: VehicleType;
  name: string;
  price: number;
  speed: number; // Downward scroll speed of world
  handling: number; // Left/right movement speed
  incomeMultiplier: number;
  icon: string;
  description: string;
}

export enum EntityType {
  OBSTACLE_DOG = 'OBSTACLE_DOG',
  OBSTACLE_CAT = 'OBSTACLE_CAT',
  OBSTACLE_PERSON = 'OBSTACLE_PERSON',
  OBSTACLE_KID = 'OBSTACLE_KID',
  OBSTACLE_CONE = 'OBSTACLE_CONE',
  OBSTACLE_BARRIER = 'OBSTACLE_BARRIER',
  OBSTACLE_CAR = 'OBSTACLE_CAR',
  PACKAGE = 'PACKAGE',
  COIN = 'COIN',
  POWERUP_SHIELD = 'POWERUP_SHIELD',
  POWERUP_MAGNET = 'POWERUP_MAGNET'
}

export interface Entity {
  id: string;
  type: EntityType;
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  width: number; // Percentage
  height: number; // Percentage
  speedOffset: number; // Some obstacles might move faster/slower
  vx?: number; // Horizontal velocity for moving obstacles
}

export interface VehicleUpgradeSpecs {
    speed: number;
    handling: number;
    income: number;
}

export interface GameState {
  money: number;
  currentLevel: number;
  ownedVehicles: VehicleType[];
  equippedVehicle: VehicleType;
  highScore: number;
  vehicleUpgrades: Record<VehicleType, VehicleUpgradeSpecs>;
}

export interface LevelTheme {
  title: string;
  description: string;
  environmentColor: string;
  primaryObstacle: string;
}
