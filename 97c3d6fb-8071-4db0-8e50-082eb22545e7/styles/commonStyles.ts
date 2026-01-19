
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';

// BALDE App Color Palette - Modern, vibrant with gradients
export const colors = {
  // Light theme
  light: {
    background: '#F8FAFC',
    card: '#FFFFFF',
    text: '#0F172A',
    textSecondary: '#64748B',
    primary: '#6366F1', // Indigo
    primaryDark: '#4F46E5',
    secondary: '#8B5CF6', // Purple
    secondaryDark: '#7C3AED',
    accent: '#EC4899', // Pink
    accentDark: '#DB2777',
    highlight: '#F59E0B', // Amber
    highlightDark: '#D97706',
    border: '#E2E8F0',
    success: '#10B981',
    successDark: '#059669',
    error: '#EF4444',
    errorDark: '#DC2626',
    warning: '#F59E0B',
    warningDark: '#D97706',
    info: '#3B82F6',
    infoDark: '#2563EB',
    // Gradient colors
    gradientStart: '#6366F1',
    gradientEnd: '#8B5CF6',
    cardGradientStart: '#FFFFFF',
    cardGradientEnd: '#F8FAFC',
  },
  // Dark theme
  dark: {
    background: '#0F172A',
    card: '#1E293B',
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    primary: '#818CF8', // Lighter indigo
    primaryDark: '#6366F1',
    secondary: '#A78BFA', // Lighter purple
    secondaryDark: '#8B5CF6',
    accent: '#F472B6', // Lighter pink
    accentDark: '#EC4899',
    highlight: '#FBBF24', // Lighter amber
    highlightDark: '#F59E0B',
    border: '#334155',
    success: '#34D399',
    successDark: '#10B981',
    error: '#F87171',
    errorDark: '#EF4444',
    warning: '#FBBF24',
    warningDark: '#F59E0B',
    info: '#60A5FA',
    infoDark: '#3B82F6',
    // Gradient colors
    gradientStart: '#818CF8',
    gradientEnd: '#A78BFA',
    cardGradientStart: '#1E293B',
    cardGradientEnd: '#0F172A',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
};

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 40,
  },
  h2: {
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 32,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
};

// Modern boxShadow syntax (replaces deprecated shadow* props)
export const shadows = {
  small: {
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  medium: {
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    elevation: 4,
  },
  large: {
    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15)',
    elevation: 8,
  },
};

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shadow: {
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
});
