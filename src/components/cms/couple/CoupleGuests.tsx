'use client';

import { useState } from 'react';
import { Users, LayoutGrid } from 'lucide-react';
import CoupleSeatingCanvas from '@/components/cms/couple/CoupleSeatingCanvas';
import GuestListMain from '@/components/cms/couple/GuestListMain';

const TAB_KEY = 'couple-guests-active-tab';

type TabKey = 'guests' | 'seating';

function getInitialTab(): TabKey {
  if (typeof window === 'undefined') return 'guests';
  try {
    const stored = localStorage.getItem(TAB_KEY);
    if (stored === 'seating' || stored === 'guests') return stored;
  } catch { /* ignore */ }
  return 'guests';
}

export default function CoupleGuests() {
  const [activeTab, setActiveTab] = useState<TabKey>(getInitialTab);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    try {
      localStorage.setItem(TAB_KEY, tab);
    } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div className="flex items-center gap-1 border-b border-champagne-silk px-4 shrink-0">
        <button
          onClick={() => handleTabChange('guests')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-200 cursor-pointer ${
            activeTab === 'guests'
              ? 'border-cinematic-gold text-cinematic-gold'
              : 'border-transparent text-charcoal-ink/50 hover:text-charcoal-ink/80 hover:border-charcoal-ink/20'
          }`}
        >
          <Users className="size-4" />
          Guest List
        </button>
        <button
          onClick={() => handleTabChange('seating')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-200 cursor-pointer ${
            activeTab === 'seating'
              ? 'border-cinematic-gold text-cinematic-gold'
              : 'border-transparent text-charcoal-ink/50 hover:text-charcoal-ink/80 hover:border-charcoal-ink/20'
          }`}
        >
          <LayoutGrid className="size-4" />
          Seating Plan
        </button>
      </div>

      {/* Tab Content — both panels stay mounted to preserve state across tab switches */}
      <div className="flex-1 min-h-0">
        <div style={{ display: activeTab === 'guests' ? 'block' : 'none' }}>
          <GuestListMain />
        </div>
        <div style={{ display: activeTab === 'seating' ? 'block' : 'none' }}>
          <CoupleSeatingCanvas activeTab={activeTab} />
        </div>
      </div>
    </div>
  );
}
