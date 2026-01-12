// src/utils/index.ts

export interface SafeArea {
    top: string;
    bottom: string;
    left: string;
    right: string;
  }
  
  export const safeArea: SafeArea = {
    top: 'env(safe-area-inset-top)',
    bottom: 'env(safe-area-inset-bottom)',
    left: 'env(safe-area-inset-left)',
    right: 'env(safe-area-inset-right)',
  };
  
  export interface TelegramColors {
    primary: string;
    primaryDark: string;
    secondary: string;
    background: string;
    surface: string;
    surfaceLight: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    accent: string;
    error: string;
    success: string;
    warning: string;
    info: string;
  }
  
  export const telegramColors: TelegramColors = {
    primary: '#0088cc',
    primaryDark: '#006699',
    secondary: '#2ecc71',
    background: '#0f0f0f',
    surface: '#1e1e1e',
    surfaceLight: '#2d2d2d',
    text: '#ffffff',
    textSecondary: '#6b6b6b',
    textTertiary: '#a0a0a0',
    accent: '#ffc107',
    error: '#e91e63',
    success: '#34a853',
    warning: '#ff9800',
    info: '#2196f3',
  };
  
  export const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return num.toString();
  };
  
  export const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return `${Math.floor(seconds / 604800)}w ago`;
  };
  
  export const generateGradient = (from: string, to: string, angle: number = 135) => {
    return `linear-gradient(${angle}deg, ${from}, ${to})`;
  };
  
  export const debounce = <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    
    return (...args: Parameters<T>) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };