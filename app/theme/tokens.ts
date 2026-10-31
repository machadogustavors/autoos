// Fonte: DESIGN.md (front matter). Mudou lá, muda aqui no mesmo commit.
import { Platform, TextStyle } from 'react-native';

export const colors = {
  primary: '#FF6A1A',
  primaryDeep: '#D9550F',
  onPrimary: '#1A1200',
  primarySoft: '#3A2414',
  onPrimarySoft: '#FF9A5C',
  canvas: '#17181A',
  surface: '#1F2124',
  surfaceDeep: '#26292D',
  ink: '#F5F3EF',
  muted: '#B7B2AA',
  faint: '#8B8680',
  line: '#2C2E31',
  lineStrong: '#3C3F43',
  danger: '#FF5A5F',
  dangerSoft: '#3A1E1F',
  onDanger: '#FFB4B7',
  ok: '#3DDC84',
  okSoft: '#123320',
  onOk: '#8CF0B3',
  warn: '#FFC53D',
  warnSoft: '#3A2E0A',
  onWarn: '#FFD980',
  link: '#FF9A5C',
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  screenGutter: 16,
} as const;

export const rounded = {
  xs: 3,
  sm: 6,
  full: 9999,
} as const;

export const touchHeight = 48;
export const topBarHeight = 56;
// DESIGN.md: "Tablet ≥ 600: uma coluna, max 560 no conteúdo".
export const contentMaxWidth = 560;
// DESIGN.md: "Motion: 150ms no press. Sem bounce".
export const pressMs = 150;

const mono = Platform.select({ android: 'monospace', default: 'Menu' });

export const type = {
  screenTitle: { fontSize: 20, fontWeight: '700', lineHeight: 24 },
  heading1: { fontSize: 26, fontWeight: '700', lineHeight: 31 },
  headingCard: { fontSize: 16, fontWeight: '600', lineHeight: 21 },
  bodyMd: { fontSize: 16, fontWeight: '400', lineHeight: 22 },
  bodyMdMedium: { fontSize: 16, fontWeight: '500', lineHeight: 22 },
  bodySm: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  micro: { fontSize: 12, fontWeight: '600', lineHeight: 17 },
  microUppercase: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    letterSpacing: 0.8,
  },
  buttonMd: { fontSize: 16, fontWeight: '700', lineHeight: 19 },
  telemetryValue: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 29,
    fontFamily: mono,
  },
  telemetryUnit: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17,
    fontFamily: mono,
  },
} satisfies Record<string, TextStyle>;
