import { useState } from 'react';
import { MenuIcon, CloseIcon, GitHubIcon } from '@audiio/icons';
import { useDevMode } from '../hooks/useDevMode';
import './Navbar.css';

interface NavbarProps {
  scrolled: boolean;
}

export function Navbar({ scrolled }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isDevMode, toggleDevMode } = useDevMode();

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'Plugins', href: '#plugins' },
    { label: 'Remote', href: 'https://magicianjarden.github.io/audiio-official/remote/', external: true },
    { label: 'Docs', href: 'https://github.com/magicianjarden/audiio-official/tree/main/docs', external: true },
  ];

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''} ${isDevMode ? 'dev-mode' : ''}`}>
      <div className="navbar-container container">
        <a href="#" className="navbar-logo">
          <span className="logo-text">audiio</span>
          {isDevMode && <span className="dev-badge" onClick={toggleDevMode}>DEV</span>}
        </a>

        <div className={`navbar-links ${mobileMenuOpen ? 'open' : ''}`}>
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="nav-link"
              onClick={() => setMobileMenuOpen(false)}
              {...('external' in link && link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {link.label}
            </a>
          ))}
          <a
            href="https://github.com/magicianjarden/audiio-official"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-link github-link"
          >
            <GitHubIcon size={20} />
            <span className="github-text">GitHub</span>
          </a>
        </div>

        <div className="navbar-actions">
          <a href="#download" className="btn btn-primary">
            Download
          </a>
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <CloseIcon size={24} /> : <MenuIcon size={24} />}
          </button>
        </div>
      </div>
    </nav>
  );
}
