import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Features } from './components/Features';
import { ThemeShowcase } from './components/ThemeShowcase';
import { PluginEcosystem } from './components/PluginEcosystem';
import { Community } from './components/Community';
import { Download } from './components/Download';
import { Footer } from './components/Footer';
import { DevModeProvider, useDevMode } from './hooks/useDevMode';

function AppContent() {
  const { isDevMode } = useDevMode();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={`app ${isDevMode ? 'dev-mode' : ''}`}>
      <Navbar scrolled={scrolled} />
      <main>
        <Hero />
        <Features />
        <ThemeShowcase />
        <PluginEcosystem />
        <Community />
        <Download />
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <DevModeProvider>
      <AppContent />
    </DevModeProvider>
  );
}
