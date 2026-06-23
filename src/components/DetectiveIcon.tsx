import React from 'react';

export default function DetectiveIcon({ className = '', size = 24 }: { className?: string, size?: number }) {
  const clipId = "detective-brim-clip";
  
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="currentColor" 
      className={className}
    >
      <defs>
        <clipPath id={clipId}>
          <path d="M 0 100 L 100 100 L 100 35 L 94 35 C 80 64, 20 64, 6 35 L 0 35 Z" />
        </clipPath>
      </defs>
      
      {/* Hat Crown */}
      <path d="M 22 38 C 25 20, 30 10, 40 12 Q 50 18 60 12 C 70 10, 75 20, 78 38 Q 50 46 22 38 Z" />
      
      {/* Hat Brim */}
      <path d="M 6 35 C 20 52, 80 52, 94 35 C 80 64, 20 64, 6 35 Z" />
      
      {/* Magnifying Glass Elements (Clipped by Brim) */}
      <g clipPath={`url(#${clipId})`}>
        {/* Outer Ring */}
        <path fillRule="evenodd" clipRule="evenodd" d="M 50 80 A 22 22 0 1 0 50 36 A 22 22 0 1 0 50 80 Z M 50 74 A 16 16 0 1 1 50 42 A 16 16 0 1 1 50 74 Z" />
        
        {/* Inner Solid Bowl */}
        <circle cx="50" cy="58" r="11" />
      </g>
      
      {/* Handle */}
      <path d="M 68 76 L 86 94 A 4.95 4.95 0 0 0 93 87 L 75 69 Z" />
    </svg>
  );
}
