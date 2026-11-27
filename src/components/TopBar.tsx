import React from 'react';
import { ActiveWorkspaceTab, UILanguage } from '../types/dubbing';

interface TopBarProps {
  activeTab: ActiveWorkspaceTab;
  onSelectTab: (tab: ActiveWorkspaceTab) => void;
  onQuickExport: () => void;
  lang: UILanguage;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onQuickExport,
  lang,
}) => {
  const navItems: Array<{ id: ActiveWorkspaceTab; en: string; hi: string }> = [
    { id: 'timeline', en: 'Timeline', hi: 'टाइमलाइन' },
    { id: 'alignment', en: 'Alignment', hi: 'ऑडियो सिंक' },
    { id: 'tools', en: 'Tool Analysis', hi: 'टूल विश्लेषण' },
    { id: 'export', en: 'Export', hi: 'एक्सपोर्ट' },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[#242B38] bg-[#0B0E14]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-8 px-4 py-3 md:px-6">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('timeline')}
          className="font-display text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0 text-left focus-visible:outline-2 focus-visible:outline-amber-500"
        >
          DubSync Studio
        </button>

        {/* Zone 2: 4 single-line navigation links */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Workspace Navigation">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-500 ${
                  isActive
                    ? 'text-amber-400'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {lang === 'hi' ? item.hi : item.en}
                {isActive && (
                  <span className="absolute inset-x-0 -bottom-[13px] h-[2px] bg-amber-400" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onQuickExport}
            className="min-h-[40px] px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 rounded-lg hover:bg-amber-300 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            {lang === 'hi' ? 'एक्सपोर्ट करें' : 'Export Mix'}
          </button>
        </div>
      </div>

      {/* Mobile bottom-thumb friendly tab bar (<15% viewport height) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 grid grid-cols-4 border-t border-[#242B38] bg-[#0B0E14]/95 backdrop-blur-md"
        aria-label="Mobile Navigation"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`min-h-[48px] flex items-center justify-center text-xs font-medium transition-colors whitespace-nowrap px-2 ${
                isActive ? 'text-amber-400 border-t-2 border-amber-400' : 'text-slate-400'
              }`}
            >
              {lang === 'hi' ? item.hi : item.en}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
