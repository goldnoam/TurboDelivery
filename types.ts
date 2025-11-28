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
  PACKAGE = 'PACKAGE',
  COIN = 'COIN'
}

export interface Entity {
  id: string;
  type: EntityType;
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  width: number; // Percentage
  height: number; // Percentage
  speedOffset: number; // Some obstacles might move faster/slower
}

export interface GameState {
  money: number;
  currentLevel: number;
  ownedVehicles: VehicleType[];
  equippedVehicle: VehicleType;
  highScore: number;
  vehicleLevels: Record<VehicleType, number>;
}

export interface LevelTheme {
  title: string;
  description: string;
  environmentColor: string;
  primaryObstacle: string;
}