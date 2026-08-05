/** Startup display: renders the colourful PZEE terminal control centre. */
const COLOUR_ENABLED = !process.env.NO_COLOR && process.env.TERM !== 'dumb';
const CSI = `${String.fromCharCode(27)}[`;

const sgr = (code: string): string => (COLOUR_ENABLED ? `${CSI}${code}m` : '');

const RESET = sgr('0');
const BOLD = sgr('1');
const DIM = sgr('2');

const AMBER = sgr('38;2;255;196;84');
const ORANGE = sgr('38;2;255;139;43');
const CORAL = sgr('38;2;255;91;76');
const MAGENTA = sgr('38;2;207;105;255');
const VIOLET = sgr('38;2;132;92;246');
const CYAN = sgr('38;2;70;218;255');
const BLUE = sgr('38;2;92;139;255');
const GREEN = sgr('38;2;105;240;101');
const WHITE = sgr('38;2;248;246;255');
const MUTED = sgr('38;2;151;140;171');
const BORDER = sgr('38;2;91;65;122');

/** Amber to violet ramp, swept diagonally across the wordmark. */
const GRADIENT = [
  AMBER,
  sgr('38;2;255;168;60'),
  ORANGE,
  sgr('38;2;255;115;58'),
  CORAL,
  sgr('38;2;240;97;150'),
  MAGENTA,
  sgr('38;2;168;99;255'),
  VIOLET,
];

const ANSI_PATTERN = new RegExp(`${CSI}[0-?]*[ -/]*[@-~]`, 'g');
const RULE = `${String.fromCharCode(0)}rule`;
const LABEL_WIDTH = 8;
const PANEL_PADDING = 5;

const LETTER_P = [
  '██████ ',
  '██   ██',
  '██████ ',
  '██     ',
  '██     ',
  '██     ',
];
const LETTER_Z = [
  '███████',
  '     ██',
  '    ██ ',
  '   ██  ',
  '  ██   ',
  '███████',
];
const LETTER_E = [
  '███████',
  '██     ',
  '██████ ',
  '██     ',
  '██     ',
  '███████',
];

const WORDMARK = LETTER_P.map((letterP, index) =>
  [letterP, LETTER_Z[index], LETTER_E[index], LETTER_E[index]].join('  '),
);

/** The PG house mark, sized to sit flush against the six wordmark rows. */
const HOUSE = [
  '        ╱╲       ',
  '      ╱────╲     ',
  '    ╱────────╲   ',
  '  ╱────────────╲ ',
  '  │ ▄▄  ██  ▄▄ │ ',
  '  ╰─────██─────╯ ',
];

function visibleLength(value: string): number {
  return value.replace(ANSI_PATTERN, '').length;
}

function padAnsiEnd(value: string, width: number): string {
  return value + ' '.repeat(Math.max(0, width - visibleLength(value)));
}

/** Paints glyphs with a diagonal sweep so the mark reads as one gradient. */
function paintGradient(line: string, row: number, rows: number): string {
  const columns = Math.max(1, line.length - 1);
  let painted = '';
  let active = '';

  for (let column = 0; column < line.length; column += 1) {
    const character = line[column];

    if (character === ' ') {
      painted += ' ';
      continue;
    }

    const ratio =
      (column / columns) * 0.78 + (row / Math.max(1, rows - 1)) * 0.22;
    const index = Math.min(
      GRADIENT.length - 1,
      Math.floor(ratio * GRADIENT.length),
    );

    if (GRADIENT[index] !== active) {
      active = GRADIENT[index];
      painted += active;
    }

    painted += character;
  }

  return `${BOLD}${painted}${RESET}`;
}

function buildBrandPanel(): string[] {
  const step = (GRADIENT.length - 1) / Math.max(1, HOUSE.length - 1);
  const artwork = WORDMARK.map((line, index) => {
    const house = `${GRADIENT[Math.round(index * step)]}${HOUSE[index]}${RESET}`;
    return `${house} ${paintGradient(line, index, WORDMARK.length)}`;
  });

  return [
    ...artwork,
    '',
    `   ${AMBER}◆${RESET} ${WHITE}${BOLD}BUILD${RESET}   ${CORAL}◆${RESET} ${WHITE}${BOLD}CONNECT${RESET}   ${MAGENTA}◆${RESET} ${WHITE}${BOLD}SCALE${RESET}`,
    `   ${MUTED}${DIM}NestJS   ·   Prisma   ·   Supabase${RESET}`,
    '',
    `   ${VIOLET}╰─${RESET} ${MUTED}${DIM}crafted for fast, reliable APIs${RESET}`,
  ];
}

function section(title: string): string[] {
  return [RULE, `${VIOLET}▍${RESET}${WHITE}${BOLD}${title}${RESET}`];
}

function detail(
  icon: string,
  iconColour: string,
  label: string,
  value: string,
): string {
  const key = `${MUTED}${label.padEnd(LABEL_WIDTH)}${RESET}`;
  return `  ${iconColour}${icon}${RESET} ${key}${WHITE}${value}${RESET}`;
}

function route(method: string, path: string, colour: string): string {
  return `  ${AMBER}${BOLD}${method.padEnd(4)}${RESET}  ${colour}${path}${RESET}`;
}

function formatClock(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  const time = [date.getHours(), date.getMinutes(), date.getSeconds()];
  return time.map(pad).join(':');
}

function displayHost(host: string): string {
  return host === '0.0.0.0' || host === '::' ? 'localhost' : host;
}

function buildDetailsPanel(host: string, port: number): string[] {
  const environment = process.env.NODE_ENV ?? 'development';
  const address = `http://${displayHost(host)}:${port}`;
  const bootTime = `${process.uptime().toFixed(2)}s`;
  const status = `${GREEN}${BOLD}ONLINE${RESET}  ${MUTED}${DIM}ready to accept requests${RESET}`;

  return [
    `${MAGENTA}${BOLD}PZEE CONTROL CENTRE${RESET}`,
    `${MUTED}${DIM}Backend runtime dashboard${RESET}`,
    ...section('RUNTIME'),
    `  ${GREEN}●${RESET} ${MUTED}${'status'.padEnd(LABEL_WIDTH)}${RESET}${status}`,
    detail('◆', CYAN, 'env', environment),
    detail('◆', BLUE, 'url', address),
    detail(
      '◆',
      VIOLET,
      'node',
      `${process.version}  ${MUTED}${DIM}pid ${process.pid}${RESET}`,
    ),
    detail(
      '◆',
      MAGENTA,
      'ready',
      `${formatClock(new Date())}  ${MUTED}${DIM}booted in ${bootTime}${RESET}`,
    ),
    ...section('ROUTES'),
    route('GET', '/api/example', GREEN),
    route('GET', '/api/health', GREEN),
    route('GET', '/api/health/database', GREEN),
    route('UI', '/api/docs', CYAN),
    route('JSON', '/api/docs-json', MAGENTA),
  ];
}

function centrePad(lines: string[], rowCount: number): string[] {
  const missing = rowCount - lines.length;
  if (missing <= 0) {
    return lines;
  }

  const top = Math.floor(missing / 2);
  return [
    ...Array.from({ length: top }, () => ''),
    ...lines,
    ...Array.from({ length: missing - top }, () => ''),
  ];
}

/** Narrow-terminal fallback so the banner never wraps into noise. */
function buildCompactBanner(host: string, port: number): string {
  const environment = process.env.NODE_ENV ?? 'development';
  const address = `http://${displayHost(host)}:${port}`;

  return [
    '',
    `${ORANGE}${BOLD}PZEE${RESET} ${BORDER}│${RESET} ${MUTED}${DIM}backend control centre${RESET}`,
    `${GREEN}●${RESET} ${GREEN}${BOLD}ONLINE${RESET}  ${CYAN}${environment}${RESET}  ${WHITE}${address}${RESET}`,
    `${MUTED}${DIM}docs${RESET}  ${CYAN}${address}/api/docs${RESET}`,
    '',
    '',
  ].join('\n');
}

export function printStartupBanner(host: string, port: number): void {
  const brandPanel = buildBrandPanel();
  const detailsPanel = buildDetailsPanel(host, port);
  const rowCount = Math.max(brandPanel.length, detailsPanel.length);
  const leftWidth = Math.max(...brandPanel.map(visibleLength));
  const rightWidth = Math.max(
    ...detailsPanel.filter((line) => line !== RULE).map(visibleLength),
  );
  const innerWidth = leftWidth + rightWidth + PANEL_PADDING;

  if ((process.stdout.columns ?? innerWidth + 2) < innerWidth + 2) {
    process.stdout.write(buildCompactBanner(host, port));
    return;
  }

  const title = ' PZEE BACKEND ';
  const leftFill = '─'.repeat(Math.max(0, leftWidth + 1 - title.length));
  const topBorder = `${BORDER}╭${RESET}${ORANGE}${BOLD}${title}${RESET}${BORDER}${leftFill}┬${'─'.repeat(rightWidth + 2)}╮${RESET}`;
  const bottomBorder = `${BORDER}╰${'─'.repeat(leftWidth + 2)}┴${'─'.repeat(rightWidth + 2)}╯${RESET}`;

  const brandRows = centrePad(brandPanel, rowCount);
  const detailRows = centrePad(detailsPanel, rowCount);
  const rule = `${BORDER}${'─'.repeat(rightWidth)}${RESET}`;

  const rows = Array.from({ length: rowCount }, (_, index) => {
    const brand = padAnsiEnd(brandRows[index] ?? '', leftWidth);
    const source = detailRows[index] ?? '';
    const details = padAnsiEnd(source === RULE ? rule : source, rightWidth);
    return `${BORDER}│${RESET} ${brand} ${BORDER}│${RESET} ${details} ${BORDER}│${RESET}`;
  });

  process.stdout.write(
    `\n${topBorder}\n${rows.join('\n')}\n${bottomBorder}\n\n`,
  );
}
