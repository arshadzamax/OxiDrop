export const getThemeColors = (isDark) => ({
  // Core Backgrounds
  bg: isDark ? '#0b0d13' : '#f8fafc',
  cardBg: isDark ? '#131722' : '#ffffff',
  cardBorder: isDark ? '#1f2638' : '#e2e8f0',
  cardBorderFocus: '#0ea5e9',
  
  // Inset Surfaces (Inputs, Code Boxes, Chat, Progress)
  insetBg: isDark ? '#0e111a' : '#f1f5f9',
  insetBorder: isDark ? '#232a3d' : '#cbd5e1',
  
  // Typography
  textPrimary: isDark ? '#f8fafc' : '#0f172a',
  textSecondary: isDark ? '#94a3b8' : '#475569',
  textMuted: isDark ? '#64748b' : '#94a3b8',
  
  // Primary Actions
  primaryBtn: '#0ea5e9',
  primaryBtnHover: '#0284c7',
  primaryBtnText: '#ffffff',
  
  // Secondary Actions
  secondaryBtn: isDark ? '#1a2030' : '#f1f5f9',
  secondaryBtnBorder: isDark ? '#2a344d' : '#cbd5e1',
  secondaryBtnText: isDark ? '#e2e8f0' : '#1e293b',
  
  // Danger / Destructive Actions
  dangerBtn: 'rgba(244, 63, 94, 0.1)',
  dangerBtnBorder: 'rgba(244, 63, 94, 0.3)',
  dangerBtnText: '#f43f5e',
  
  // Status Colors
  green: '#10b981',
  greenBg: 'rgba(16, 185, 129, 0.12)',
  greenBorder: 'rgba(16, 185, 129, 0.25)',
  
  red: '#f43f5e',
  redBg: 'rgba(244, 63, 94, 0.12)',
  redBorder: 'rgba(244, 63, 94, 0.25)',
  
  amber: '#f59e0b',
  amberBg: 'rgba(245, 158, 11, 0.12)',
  amberBorder: 'rgba(245, 158, 11, 0.25)',
  
  cyan: '#06b6d4',
  accent: '#0ea5e9',
});
