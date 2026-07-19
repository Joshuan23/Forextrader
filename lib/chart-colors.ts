// Chart palette — validated with the dataviz six-checks validator against
// the dark card surface (#0c111c): lightness band, chroma, CVD separation,
// normal-vision floor, contrast. Positive/negative are always redundantly
// encoded (bar direction from a zero baseline, ▲/▼ glyphs, labels).
export const CHART = {
  line: '#3d8ef5', // primary single-series line/bar hue
  pos: '#0d9d88', // long / positive R
  neg: '#e5495a', // short / negative R
  warn: '#f0b429', // caution status (always with icon + label)
  grid: 'hsl(219 25% 15%)',
  axis: 'hsl(215 14% 60%)',
  surface: '#0c111c',
} as const
