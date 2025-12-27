/**
 * Spring Animation Utilities - Native-like spring physics
 *
 * Provides reusable spring animation functions for smooth,
 * natural-feeling animations throughout the mobile app.
 */

import { useRef, useState, useCallback, useEffect } from 'react';

// Spring configuration presets
export const SPRING_PRESETS = {
  // iOS-like bouncy spring
  bouncy: { tension: 200, friction: 20 },
  // Snappy response with slight overshoot
  snappy: { tension: 300, friction: 30 },
  // Gentle, smooth transitions
  gentle: { tension: 150, friction: 25 },
  // Quick response, no overshoot
  stiff: { tension: 400, friction: 40 },
  // Very bouncy, playful
  wobbly: { tension: 180, friction: 12 },
} as const;

export type SpringPreset = keyof typeof SPRING_PRESETS;

export interface SpringConfig {
  tension: number;  // Spring stiffness (higher = stiffer)
  friction: number; // Damping (higher = less bounce)
}

export interface SpringState {
  value: number;
  velocity: number;
  isAnimating: boolean;
}

/**
 * Calculate next spring physics step
 */
export function springStep(
  current: number,
  target: number,
  velocity: number,
  config: SpringConfig,
  deltaTime: number = 0.016 // ~60fps
): { value: number; velocity: number; settled: boolean } {
  const displacement = target - current;
  const springForce = displacement * config.tension;
  const dampingForce = velocity * config.friction;
  const acceleration = (springForce - dampingForce) / 100;

  const newVelocity = velocity + acceleration * deltaTime;
  const newValue = current + newVelocity * deltaTime;

  // Check if settled (close enough and slow enough)
  const settled = Math.abs(displacement) < 0.001 && Math.abs(newVelocity) < 0.001;

  return {
    value: settled ? target : newValue,
    velocity: settled ? 0 : newVelocity,
    settled,
  };
}

/**
 * Hook for spring animations with JS-driven physics
 *
 * @example
 * const [value, animateTo, stop] = useSpring(0, 'bouncy');
 * // Later:
 * animateTo(100); // Spring animate to 100
 */
export function useSpring(
  initialValue: number,
  configOrPreset: SpringConfig | SpringPreset = 'snappy'
): [number, (target: number) => void, () => void, boolean] {
  const config = typeof configOrPreset === 'string'
    ? SPRING_PRESETS[configOrPreset]
    : configOrPreset;

  const [state, setState] = useState<SpringState>({
    value: initialValue,
    velocity: 0,
    isAnimating: false,
  });

  const animationRef = useRef<number | null>(null);
  const targetRef = useRef(initialValue);
  const stateRef = useRef(state);

  // Keep ref in sync
  stateRef.current = state;

  const stop = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setState(prev => ({ ...prev, isAnimating: false, velocity: 0 }));
  }, []);

  const animateTo = useCallback((target: number) => {
    targetRef.current = target;

    // Already animating, just update target
    if (animationRef.current) return;

    setState(prev => ({ ...prev, isAnimating: true }));

    let lastTime = performance.now();

    const animate = (time: number) => {
      const deltaTime = Math.min((time - lastTime) / 1000, 0.1); // Cap to 100ms
      lastTime = time;

      const { value, velocity, settled } = springStep(
        stateRef.current.value,
        targetRef.current,
        stateRef.current.velocity,
        config,
        deltaTime
      );

      if (settled) {
        setState({
          value: targetRef.current,
          velocity: 0,
          isAnimating: false,
        });
        animationRef.current = null;
      } else {
        setState({
          value,
          velocity,
          isAnimating: true,
        });
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [config]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return [state.value, animateTo, stop, state.isAnimating];
}

/**
 * Hook for gesture-driven spring with initial velocity
 *
 * @example
 * const spring = useGestureSpring(0, 'snappy');
 * // On gesture end:
 * spring.release(currentPosition, velocity);
 */
export function useGestureSpring(
  initialValue: number,
  configOrPreset: SpringConfig | SpringPreset = 'snappy'
) {
  const config = typeof configOrPreset === 'string'
    ? SPRING_PRESETS[configOrPreset]
    : configOrPreset;

  const [state, setState] = useState<SpringState>({
    value: initialValue,
    velocity: 0,
    isAnimating: false,
  });

  const animationRef = useRef<number | null>(null);
  const targetRef = useRef(initialValue);
  const stateRef = useRef(state);

  stateRef.current = state;

  const stop = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setState(prev => ({ ...prev, isAnimating: false }));
  }, []);

  const set = useCallback((value: number) => {
    stop();
    setState({ value, velocity: 0, isAnimating: false });
  }, [stop]);

  const release = useCallback((target: number, initialVelocity: number = 0) => {
    targetRef.current = target;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    // Set initial velocity from gesture
    setState(prev => ({
      ...prev,
      velocity: initialVelocity,
      isAnimating: true,
    }));

    let lastTime = performance.now();

    const animate = (time: number) => {
      const deltaTime = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const { value, velocity, settled } = springStep(
        stateRef.current.value,
        targetRef.current,
        stateRef.current.velocity,
        config,
        deltaTime
      );

      if (settled) {
        setState({
          value: targetRef.current,
          velocity: 0,
          isAnimating: false,
        });
        animationRef.current = null;
      } else {
        setState({
          value,
          velocity,
          isAnimating: true,
        });
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [config]);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return {
    value: state.value,
    velocity: state.velocity,
    isAnimating: state.isAnimating,
    set,
    release,
    stop,
  };
}

/**
 * CSS spring easing approximation using cubic-bezier
 * These are approximations since CSS doesn't support true spring physics
 */
export const CSS_SPRING_EASING = {
  // Smooth ease-out with slight bounce
  bouncy: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  // Snappy with minimal overshoot
  snappy: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  // Gentle ease
  gentle: 'cubic-bezier(0.4, 0, 0.2, 1)',
  // Quick response
  stiff: 'cubic-bezier(0.4, 0, 0.6, 1)',
  // iOS-style spring approximation
  ios: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
} as const;
