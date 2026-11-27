import React from 'react';
import type { ToolId } from '../game/types';

export function TitleCrestSvg({ className = 'w-11 h-11' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="4" width="56" height="56" rx="14" fill="#1d3832" stroke="#e4c274" strokeWidth="2.5" />
      <path d="M12 49 C18 33, 25 27, 32 27 C39 27, 46 33, 52 49 Z" fill="#dfc082" stroke="#997641" strokeWidth="2" />
      <path d="M18 49 C23 39, 27 35, 32 35 C37 35, 41 39, 46 49 Z" fill="#c9a563" />
      <line x1="32" y1="13" x2="32" y2="39" stroke="#f7f1e1" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M33.5 14 L50 18.5 L45 23 L50 27.5 L33.5 29 Z" fill="#d96543" stroke="#f7f1e1" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="32" cy="12" r="2.6" fill="#ebc25c" />
    </svg>
  );
}

export function ToolIconSvg({ tool, className = 'w-6 h-6' }: { tool: ToolId; className?: string }) {
  switch (tool) {
    case 'broom':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M18.5 3.5L11.5 10.5" stroke="#5b3e28" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M9.5 9.5L13.5 13.5L8 20.5L3.5 16L9.5 9.5Z" fill="#deb974" stroke="#5b3e28" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9.2 10.8L12.5 14.1" stroke="#b95a40" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M6.8 14.8L5.2 17.5M9.2 16.2L7.8 19" stroke="#997641" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case 'finger':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M11 3.5C12.38 3.5 13.5 4.62 13.5 6V12.5H15.5C16.88 12.5 18 13.62 18 15V17.5C18 19.7 16.2 21.5 14 21.5H10.5C8.3 21.5 6.5 19.7 6.5 17.5V12.5C6.5 11.4 7.4 10.5 8.5 10.5V6C8.5 4.62 9.62 3.5 11 3.5Z" fill="#eab990" stroke="#5e402b" strokeWidth="1.6" strokeLinejoin="round" />
          <rect x="9.7" y="4.9" width="2.6" height="3.2" rx="1.2" fill="#fae2cc" />
        </svg>
      );
    case 'needle':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M4.5 19.5L17.8 6.2" stroke="#2c3e48" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M4.5 19.5L17.8 6.2" stroke="#d8e6ee" strokeWidth="1.3" strokeLinecap="round" />
          <ellipse cx="18.6" cy="5.4" rx="2.4" ry="1.4" transform="rotate(-45 18.6 5.4)" stroke="#4c6472" strokeWidth="1.6" fill="#f7f3ea" />
        </svg>
      );
    case 'toothpick':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M4 20L18.5 4.5L20 6L5.5 20.5L4 20Z" fill="#ecc984" stroke="#6c4d2c" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M15.8 6.8L17.6 8.6" stroke="#8a6239" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'hand':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M8.5 12V6.5C8.5 5.67 9.17 5 10 5C10.83 5 11.5 5.67 11.5 6.5V11M11.5 11V5.2C11.5 4.37 12.17 3.7 13 3.7C13.83 3.7 14.5 4.37 14.5 5.2V11M14.5 11V6.8C14.5 5.97 15.17 5.3 16 5.3C16.83 5.3 17.5 5.97 17.5 6.8V14.8C17.5 18.2 14.9 20.5 11.8 20.5C9.1 20.5 7 18.6 6.2 16L4.8 12.4C4.4 11.4 5 10.3 6 10.1C6.9 9.9 7.8 10.4 8.2 11.3L8.5 12Z" fill="#eab990" stroke="#5e402b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'bothhands':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M3.5 12.5C3.5 9.2 5.4 6.5 8 6.5C9.5 6.5 10.5 7.5 10.5 9V14.5C10.5 17.2 8.7 19.2 6.5 19.2C4.7 19.2 3.5 17.6 3.5 15.2V12.5Z" fill="#eab990" stroke="#5e402b" strokeWidth="1.5" />
          <path d="M20.5 12.5C20.5 9.2 18.6 6.5 16 6.5C14.5 6.5 13.5 7.5 13.5 9V14.5C13.5 17.2 15.3 19.2 17.5 19.2C19.3 19.2 20.5 17.6 20.5 15.2V12.5Z" fill="#eab990" stroke="#5e402b" strokeWidth="1.5" />
          <path d="M7 9.5V14M17 9.5V14" stroke="#8f6343" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
  }
}
