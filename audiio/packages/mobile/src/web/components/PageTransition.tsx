/**
 * PageTransition - Native-like page transitions with spring physics
 *
 * Features:
 * - Direction-aware animations (forward/back/deep)
 * - Spring-like easing curves
 * - Scale + translate for depth effect
 */

import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './PageTransition.module.css';

interface PageTransitionProps {
  children: React.ReactNode;
}

// Detail/modal-like routes that should use vertical transition
const DEEP_ROUTES = ['/now-playing', '/lyrics', '/queue', '/artist/', '/album/', '/playlist/'];

function isDeepRoute(path: string): boolean {
  return DEEP_ROUTES.some(route => path.startsWith(route) || path === route.slice(0, -1));
}

function getTransitionType(
  prevPath: string,
  nextPath: string
): 'forward' | 'back' | 'deep' | 'same' {
  if (prevPath === nextPath) return 'same';

  const prevDepth = prevPath.split('/').filter(Boolean).length;
  const nextDepth = nextPath.split('/').filter(Boolean).length;

  // Going to a deep route (modal-like)
  if (isDeepRoute(nextPath) && !isDeepRoute(prevPath)) {
    return 'deep';
  }

  // Coming back from a deep route
  if (isDeepRoute(prevPath) && !isDeepRoute(nextPath)) {
    return 'back';
  }

  // Standard forward/back based on depth
  if (nextDepth > prevDepth) {
    return 'forward';
  } else if (nextDepth < prevDepth) {
    return 'back';
  }

  // Same depth - treat as forward
  return 'forward';
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionStage, setTransitionStage] = useState<string>('idle');
  const previousPathRef = useRef(location.pathname);

  useEffect(() => {
    // Check if path changed (not just search params)
    if (location.pathname !== previousPathRef.current) {
      const transitionType = getTransitionType(
        previousPathRef.current,
        location.pathname
      );

      // Determine exit animation class
      let exitClass = 'exit';
      let enterClass = 'enter';
      let exitDuration = 150;
      let enterDuration = 350;

      if (transitionType === 'deep') {
        exitClass = 'exitDeep';
        enterClass = 'enterDeep';
        exitDuration = 200;
        enterDuration = 400;
      } else if (transitionType === 'back') {
        exitClass = 'exitBack';
        enterClass = 'enterBack';
      }

      // Start exit animation
      setTransitionStage(exitClass);

      // After exit animation, swap content and enter
      const exitTimeout = setTimeout(() => {
        setDisplayChildren(children);
        setTransitionStage(enterClass);
        previousPathRef.current = location.pathname;

        // Reset to idle after enter
        const enterTimeout = setTimeout(() => {
          setTransitionStage('idle');
        }, enterDuration);

        return () => clearTimeout(enterTimeout);
      }, exitDuration);

      return () => clearTimeout(exitTimeout);
    } else {
      // Same path, just update children
      setDisplayChildren(children);
    }
  }, [location.pathname, children]);

  return (
    <div
      className={`${styles.wrapper} ${styles[transitionStage] || ''}`}
    >
      {displayChildren}
    </div>
  );
}
