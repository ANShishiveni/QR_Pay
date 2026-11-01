import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export const lightColors = {
  primary: '#06796B', onPrimary: '#FFFFFF', primarySoft: '#E4F4EF',
  navy: '#11263D', background: '#F6F8FA', surface: '#FFFFFF', surfaceRaised: '#FFFFFF',
  text: '#142230', textSecondary: '#59697A', border: '#DDE5EC', controlBorder: '#7A8997',
  success: '#06796B', successSoft: '#E4F4EF', warning: '#7A4C00', warningSoft: '#FFF4D6',
  error: '#B42332', onError: '#FFFFFF', errorSoft: '#FDECEE', info: '#245E91', infoSoft: '#E9F1FA',
  disabled: '#E7ECF0', onDisabled: '#637282', overlay: 'rgba(11,20,32,0.54)',
  hero: '#11263D', heroText: '#FFFFFF', heroMuted: '#BBCBDA', white: '#FFFFFF', black: '#000000',
};

export const darkColors = {
  primary: '#40C8AD', onPrimary: '#062E28', primarySoft: '#153D36',
  navy: '#E7EFF9', background: '#0B1420', surface: '#142131', surfaceRaised: '#1B2A3D',
  text: '#F4F7FA', textSecondary: '#AAB9CA', border: '#2B3C50', controlBorder: '#6E8196',
  success: '#40C8AD', successSoft: '#153D36', warning: '#F5CA79', warningSoft: '#3F301A',
  error: '#FF9FA8', onError: '#400A17', errorSoft: '#40212B', info: '#98C9F4', infoSoft: '#1D344B',
  disabled: '#263647', onDisabled: '#9AAABC', overlay: 'rgba(0,0,0,0.7)',
  hero: '#1B344B', heroText: '#F4F7FA', heroMuted: '#BBCBDA', white: '#FFFFFF', black: '#000000',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const radii = { control: 12, card: 18, hero: 24, pill: 999 };
export const elevation = { flat: 0, raised: 2, modal: 8 };
export const typography = {
  hero: { fontSize: 40, lineHeight: 48, fontWeight: '700', letterSpacing: -1.2 },
  h1: { fontSize: 30, lineHeight: 38, fontWeight: '700', letterSpacing: -0.8 },
  h2: { fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.5 },
  h3: { fontSize: 20, lineHeight: 28, fontWeight: '600', letterSpacing: -0.3 },
  h4: { fontSize: 18, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  body1: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  body2: { fontSize: 14, lineHeight: 21, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 18, fontWeight: '400' },
  kicker: { fontSize: 12, lineHeight: 18, fontWeight: '700', letterSpacing: 1.7 },
  button: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
};

export function createAppTheme(isDark = false) {
  const palette = isDark ? darkColors : lightColors;
  const base = isDark ? MD3DarkTheme : MD3LightTheme;
  const paperTheme = {
    ...base, roundness: 3,
    colors: {
      ...base.colors, primary: palette.primary, onPrimary: palette.onPrimary,
      primaryContainer: palette.primarySoft, onPrimaryContainer: palette.text,
      secondary: palette.navy, onSecondary: palette.background,
      background: palette.background, onBackground: palette.text,
      surface: palette.surface, onSurface: palette.text, surfaceVariant: palette.background,
      onSurfaceVariant: palette.textSecondary, outline: palette.border, outlineVariant: palette.border,
      error: palette.error, onError: palette.onError, errorContainer: palette.errorSoft, onErrorContainer: palette.error,
      surfaceDisabled: palette.disabled, onSurfaceDisabled: palette.onDisabled,
      backdrop: palette.overlay, elevation: { level0: 'transparent', level1: palette.surface,
        level2: palette.surfaceRaised, level3: palette.surfaceRaised, level4: palette.surfaceRaised, level5: palette.surfaceRaised },
      text: palette.text, placeholder: palette.textSecondary, disabled: palette.onDisabled,
    },
  };
  return { colors: palette, paperTheme, theme: paperTheme, isDark,
    tokens: { spacing, typography, radii, elevation }, spacing, typography, radii, elevation };
}

// Compatibility exports for screens migrated in later phases. New screens use
// useAppTheme so appearance changes render immediately without static colors.
export const theme = createAppTheme(false).paperTheme;
export const colors = {
  ...lightColors, primaryDark: '#066355', primaryLight: '#40C8AD', secondary: '#11263D',
  secondaryDark: '#11263D', secondaryLight: '#59697A', tertiary: '#245E91', tertiaryDark: '#11263D',
  danger: lightColors.error, dangerLight: '#FDECEE', muted: lightColors.textSecondary,
  subtle: lightColors.background, transparentBlack: lightColors.overlay, transparentWhite: 'rgba(255,255,255,0.7)',
  gradientPrimaryStart: '#11263D', gradientPrimaryEnd: '#087F70', gray: '#59697A', lightGray: '#F6F8FA', darkGray: '#142230',
};
