import React from 'react';
import { BoltIcon } from '@heroicons/react/24/solid';
import { GlobeAltIcon } from '@heroicons/react/24/outline';

const Header: React.FC = () => {
  return (
    <header 
      className="px-8 py-5 border-b flex items-center justify-between shadow-sm"
      style={{
        background: 'linear-gradient(135deg, var(--surface) 0%, rgba(30, 41, 59, 0.8) 100%)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div 
            className="p-1.5 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
            }}
          >
            <BoltIcon className="w-5 h-5" style={{ color: 'white' }} />
          </div>
          <div 
            className="text-2xl font-bold tracking-tight"
            style={{
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            HyperSignal
          </div>
        </div>
        <div 
          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(132, 204, 22, 0.2) 100%)',
            color: '#86efac',
            border: '1px solid rgba(16, 185, 129, 0.3)',
          }}
        >
          AI Powered
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div 
          className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-md"
          style={{
            backgroundColor: 'var(--background)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
          }}
        >
          <GlobeAltIcon className="w-4 h-4" />
          <span>KST (UTC+9)</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
