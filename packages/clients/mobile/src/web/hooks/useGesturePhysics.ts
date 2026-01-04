/**
 * useGesturePhysics - Physics-based gesture utilities
 *
 * Features:
 * - Velocity tracking for swipe gestures
 * - Momentum-based animations
 * - Spring physics for snap points
 * - Rubber-band effect for overscroll
 */

import { useRef, useCallback } from 'react';

interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

interface VelocityState {
  x: number;
  y: number;
}

interface GestureState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  velocityX: number;
  velocityY: number;
  isDragging: boolean;
}

interface UseGesturePhysicsOptions {
  /** Deceleration factor for momentum (0-1, higher = faster stop) */
  deceleration?: number;
  /** Minimum velocity to trigger momentum */
  minVelocity?: number;
  /** Maximum velocity cap */
  maxVelocity?: number;
  /** Resistance factor for rubber-band effect (0-1) */
  rubberBandResistance?: number;
}

const DEFAULT_OPTIONS: Required<UseGesturePhysicsOptions> = {
  deceleration: 0.95,
  minVelocity: 0.1,
  maxVelocity: 5,
  rubberBandResistance: 0.55,
};

/**
 * Calculate velocity from touch history
 */
function calculateVelocity(points: TouchPoint[]): VelocityState {
  if (points.length < 2) {
    return { x: 0, y: 0 };
  }

  // Use last few points for more accurate velocity
  const recentPoints = points.slice(-5);
  const first = recentPoints[0];
  const last = recentPoints[recentPoints.length - 1];
  const dt = last.time - first.time;

  if (dt === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: (last.x - first.x) / dt,
    y: (last.y - first.y) / dt,
  };
}

/**
 * Apply rubber-band resistance to a value
 */
export function rubberBand(value: number, limit: number, resistance: number): number {
  if (value >= 0 && value <= limit) {
    return value;
  }

  const overflow = value > limit ? value - limit : -value;
  const resistedOverflow = (1 - Math.exp(-overflow / limit * 2)) * limit * resistance;

  return value > limit ? limit + resistedOverflow : -resistedOverflow;
}

/**
 * Spring physics animation
 */
export function springAnimation(
  current: number,
  target: number,
  velocity: number,
  stiffness: number = 170,
  damping: number = 26
): { position: number; velocity: number; isComplete: boolean } {
  const displacement = current - target;
  const springForce = -stiffness * displacement;
  const dampingForce = -damping * velocity;
  const acceleration = springForce + dampingForce;

  const newVelocity = velocity + acceleration * 0.016; // Assuming 60fps
  const newPosition = current + newVelocity * 0.016;

  const isComplete = Math.abs(displacement) < 0.5 && Math.abs(newVelocity) < 0.5;

  return {
    position: isComplete ? target : newPosition,
    velocity: isComplete ? 0 : newVelocity,
    isComplete,
  };
}

/**
 * Find the closest snap point
 */
export function findClosestSnapPoint(
  value: number,
  velocity: number,
  snapPoints: number[],
  velocityWeight: number = 100
): number {
  if (snapPoints.length === 0) {
    return value;
  }

  // Project where the value would end up with current velocity
  const projectedValue = value + velocity * velocityWeight;

  // Find closest snap point to projected value
  let closest = snapPoints[0];
  let minDistance = Math.abs(projectedValue - closest);

  for (const point of snapPoints) {
    const distance = Math.abs(projectedValue - point);
    if (distance < minDistance) {
      minDistance = distance;
      closest = point;
    }
  }

  return closest;
}

/**
 * Hook for gesture physics
 */
export function useGesturePhysics(options: UseGesturePhysicsOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const touchHistoryRef = useRef<TouchPoint[]>([]);
  const gestureStateRef = useRef<GestureState>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    velocityX: 0,
    velocityY: 0,
    isDragging: false,
  });

  const startGesture = useCallback((x: number, y: number) => {
    touchHistoryRef.current = [{ x, y, time: Date.now() }];
    gestureStateRef.current = {
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      velocityX: 0,
      velocityY: 0,
      isDragging: true,
    };

    return gestureStateRef.current;
  }, []);

  const updateGesture = useCallback((x: number, y: number) => {
    const now = Date.now();
    touchHistoryRef.current.push({ x, y, time: now });

    // Keep only recent points for velocity calculation
    if (touchHistoryRef.current.length > 10) {
      touchHistoryRef.current = touchHistoryRef.current.slice(-10);
    }

    const velocity = calculateVelocity(touchHistoryRef.current);

    gestureStateRef.current = {
      ...gestureStateRef.current,
      currentX: x,
      currentY: y,
      velocityX: Math.max(-opts.maxVelocity, Math.min(opts.maxVelocity, velocity.x)),
      velocityY: Math.max(-opts.maxVelocity, Math.min(opts.maxVelocity, velocity.y)),
    };

    return gestureStateRef.current;
  }, [opts.maxVelocity]);

  const endGesture = useCallback(() => {
    gestureStateRef.current.isDragging = false;
    touchHistoryRef.current = [];

    return gestureStateRef.current;
  }, []);

  const getGestureState = useCallback(() => {
    return gestureStateRef.current;
  }, []);

  const getDelta = useCallback(() => {
    const state = gestureStateRef.current;
    return {
      x: state.currentX - state.startX,
      y: state.currentY - state.startY,
    };
  }, []);

  const applyRubberBand = useCallback((value: number, min: number, max: number) => {
    if (value < min) {
      return min - rubberBand(min - value, max - min, opts.rubberBandResistance);
    }
    if (value > max) {
      return max + rubberBand(value - max, max - min, opts.rubberBandResistance);
    }
    return value;
  }, [opts.rubberBandResistance]);

  return {
    startGesture,
    updateGesture,
    endGesture,
    getGestureState,
    getDelta,
    applyRubberBand,
    rubberBand,
    springAnimation,
    findClosestSnapPoint,
  };
}
