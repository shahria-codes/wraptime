import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, Share } from 'lucide-react';

export const PwaInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Check if already running in standalone PWA mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
      setShowPrompt(false);
      return;
    }

    // Check if dismissed during current session
    if (sessionStorage.getItem('pwa_prompt_dismissed') === 'true') {
      return;
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // If iOS and not standalone, show prompt after 2 seconds
    if (isIosDevice) {
      const timer = setTimeout(() => setShowPrompt(true), 2000);
      return () => clearTimeout(timer);
    }

    // Show banner on non-standalone desktop/Android as well if prompt is ready
    const fallbackTimer = setTimeout(() => {
      setShowPrompt(true);
    }, 2500);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } else {
      // Manual fallback instructions
      alert("To install WrapTime on your device:\n\n• On Chrome/Android: Tap the 3 dots menu and select 'Install app' or 'Add to Home screen'.\n• On Safari/iOS: Tap the Share button and select 'Add to Home Screen'.");
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '75px',
      right: '16px',
      left: '16px',
      maxWidth: '440px',
      margin: '0 auto',
      zIndex: 99999,
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div 
        className="glass-card" 
        style={{ 
          padding: '0.9rem 1.1rem', 
          border: '1px solid var(--border-bright)', 
          background: 'rgba(15, 23, 42, 0.95)', 
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          borderRadius: '16px',
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.85rem' 
        }}
      >
        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F172A', flexShrink: 0, fontWeight: 900 }}>
          <Smartphone size={22} />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#FFF' }}>Install WrapTime PWA</div>
          <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {isIos ? (
              <span>Tap Share <Share size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> then "Add to Home Screen"</span>
            ) : (
              <span>Add to your home screen for quick schedule access & offline mode</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button className="btn btn-sm btn-primary" onClick={handleInstallClick} style={{ padding: '6px 12px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
            <Download size={14} /> Install
          </button>
          <button className="btn btn-sm btn-secondary" onClick={handleDismiss} style={{ padding: '6px 8px' }} title="Close">
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
