import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface DevModeContextType {
  isDevMode: boolean;
  toggleDevMode: () => void;
  activationMethod: 'konami' | 'typed' | null;
}

const DevModeContext = createContext<DevModeContextType | null>(null);

const KONAMI_CODE = [
  'ArrowUp', 'ArrowUp',
  'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight',
  'ArrowLeft', 'ArrowRight',
  'KeyB', 'KeyA'
];

const TYPED_CODE = 'devmode';

export function DevModeProvider({ children }: { children: ReactNode }) {
  const [isDevMode, setIsDevMode] = useState(false);
  const [activationMethod, setActivationMethod] = useState<'konami' | 'typed' | null>(null);
  const [konamiIndex, setKonamiIndex] = useState(0);
  const [typedBuffer, setTypedBuffer] = useState('');

  const activateDevMode = useCallback((method: 'konami' | 'typed') => {
    setIsDevMode(true);
    setActivationMethod(method);

    // Log welcome message for developers
    console.log('%c🔧 Dev Mode Activated!', 'color: #00ff41; font-size: 24px; font-weight: bold;');
    console.log('%cWelcome, developer! You found the easter egg.', 'color: #00ff41; font-size: 14px;');
    console.log('%c─────────────────────────────────────', 'color: #333;');
    console.log('%cAudiio is built with:', 'color: #a3a3a3; font-size: 12px;');
    console.log('%c  • React 18 + TypeScript', 'color: #61dafb; font-size: 12px;');
    console.log('%c  • Zustand for state', 'color: #ff6b35; font-size: 12px;');
    console.log('%c  • Vite for builds', 'color: #646cff; font-size: 12px;');
    console.log('%c  • Electron for desktop', 'color: #9feaf9; font-size: 12px;');
    console.log('%c─────────────────────────────────────', 'color: #333;');
    console.log('%cCheck out our GitHub: https://github.com/magicianjarden/audiio-official', 'color: #a3a3a3; font-size: 12px;');
  }, []);

  const toggleDevMode = useCallback(() => {
    if (isDevMode) {
      setIsDevMode(false);
      setActivationMethod(null);
      console.log('%c🔧 Dev Mode Deactivated', 'color: #666; font-size: 14px;');
    }
  }, [isDevMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Check Konami code
      if (e.code === KONAMI_CODE[konamiIndex]) {
        const newIndex = konamiIndex + 1;
        if (newIndex === KONAMI_CODE.length) {
          activateDevMode('konami');
          setKonamiIndex(0);
        } else {
          setKonamiIndex(newIndex);
        }
      } else if (e.code === KONAMI_CODE[0]) {
        setKonamiIndex(1);
      } else {
        setKonamiIndex(0);
      }

      // Check typed code
      const key = e.key.toLowerCase();
      if (key.length === 1 && /[a-z]/.test(key)) {
        const newBuffer = (typedBuffer + key).slice(-TYPED_CODE.length);
        setTypedBuffer(newBuffer);

        if (newBuffer === TYPED_CODE) {
          activateDevMode('typed');
          setTypedBuffer('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [konamiIndex, typedBuffer, activateDevMode]);

  // Reset typed buffer after inactivity
  useEffect(() => {
    if (typedBuffer) {
      const timeout = setTimeout(() => setTypedBuffer(''), 2000);
      return () => clearTimeout(timeout);
    }
  }, [typedBuffer]);

  return (
    <DevModeContext.Provider value={{ isDevMode, toggleDevMode, activationMethod }}>
      {children}
    </DevModeContext.Provider>
  );
}

export function useDevMode() {
  const context = useContext(DevModeContext);
  if (!context) {
    throw new Error('useDevMode must be used within a DevModeProvider');
  }
  return context;
}
