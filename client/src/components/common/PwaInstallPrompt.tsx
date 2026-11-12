import React, { useState, useEffect } from 'react';
import { Download, Share2, PlusSquare, X, Smartphone, CheckCircle } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showIosModal, setShowIosModal] = useState<boolean>(false);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Listen for beforeinstallprompt event (Android / Chromium)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      console.log('[PWA] Smart Bus was installed successfully.');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIosModal(true);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback instructions for desktop or unprompted browsers
      alert('To install Smart Bus:\n1. Open your browser menu (⋮ or ⋯)\n2. Select "Install Smart Bus" or "Add to Home Screen"');
    }
  };

  if (isInstalled || bannerDismissed) return null;

  return (
    <>
      {/* Top Banner on Mobile & Desktop */}
      <div className="bg-brand-secondary/90 border-b border-brand-primary text-brand-navy px-4 py-2.5 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="bg-white p-1.5 rounded-lg shadow-sm flex-shrink-0 text-brand-accent">
              <Smartphone className="w-4 h-4 text-[#263746]" />
            </div>
            <div className="truncate">
              <span className="font-semibold text-brand-navy">Install Smart Bus App:</span>{' '}
              <span className="text-brand-gray hidden sm:inline">Add to your Home Screen for instant tracking & offline alerts.</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleInstallClick}
              className="bg-brand-accent hover:bg-[#5b95c3] text-white font-medium px-3.5 py-1.5 rounded-lg text-xs shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Add to Home Screen</span>
            </button>
            <button
              onClick={() => setBannerDismissed(true)}
              className="text-brand-gray hover:text-brand-navy p-1 rounded-md"
              title="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Instructions Modal */}
      {showIosModal && (
        <div className="fixed inset-0 bg-brand-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-brand-secondary animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-brand-secondary rounded-xl text-brand-accent">
                  <Smartphone className="w-5 h-5 text-brand-navy" />
                </div>
                <div>
                  <h3 className="font-bold text-brand-navy text-lg">Install on iPhone / iPad</h3>
                  <p className="text-xs text-brand-gray">Follow these quick steps in Safari</p>
                </div>
              </div>
              <button
                onClick={() => setShowIosModal(false)}
                className="text-brand-gray hover:text-brand-navy p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm text-brand-navy my-4">
              <div className="flex items-start gap-3 bg-brand-cream/60 p-3 rounded-xl border border-brand-primary/40">
                <span className="w-6 h-6 rounded-full bg-brand-accent text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <p className="font-semibold">Tap the Share button</p>
                  <p className="text-xs text-brand-gray mt-0.5 flex items-center gap-1">
                    At the bottom of Safari, tap the <Share2 className="w-3.5 h-3.5 inline text-blue-600" /> Share icon.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-brand-cream/60 p-3 rounded-xl border border-brand-primary/40">
                <span className="w-6 h-6 rounded-full bg-brand-accent text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <p className="font-semibold">Select "Add to Home Screen"</p>
                  <p className="text-xs text-brand-gray mt-0.5 flex items-center gap-1">
                    Scroll down and tap <PlusSquare className="w-3.5 h-3.5 inline text-brand-navy" /> <strong>Add to Home Screen</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-brand-cream/60 p-3 rounded-xl border border-brand-primary/40">
                <span className="w-6 h-6 rounded-full bg-brand-accent text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <p className="font-semibold">Confirm Installation</p>
                  <p className="text-xs text-brand-gray mt-0.5 flex items-center gap-1">
                    Tap <CheckCircle className="w-3.5 h-3.5 inline text-green-600" /> <strong>Add</strong> in the top-right corner.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIosModal(false)}
              className="w-full bg-brand-primary hover:bg-brand-accent hover:text-white text-brand-navy font-semibold py-2.5 rounded-xl transition-colors mt-2"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
