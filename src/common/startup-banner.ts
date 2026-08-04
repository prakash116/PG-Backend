/** Startup display: renders the colourful PZEE terminal control centre. */
const RESET = '\u001B[0m';
const BOLD = '\u001B[1m';
const DIM = '\u001B[2m';

const ORANGE = '\u001B[38;2;255;139;43m';
const AMBER = '\u001B[38;2;255;187;66m';
const CORAL = '\u001B[38;2;255;91;76m';
const MAGENTA = '\u001B[38;2;207;105;255m';
const VIOLET = '\u001B[38;2;132;92;246m';
const CYAN = '\u001B[38;2;70;218;255m';
const BLUE = '\u001B[38;2;92;139;255m';
const GREEN = '\u001B[38;2;105;240;101m';
const WHITE = '\u001B[38;2;248;246;255m';
const MUTED = '\u001B[38;2;151;140;171m';
const BORDER = '\u001B[38;2;91;65;122m';
const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g;

const LOGO_COLOURS = [AMBER, ORANGE, ORANGE, CORAL, CORAL, MAGENTA];
const HOUSE_COLOURS = [AMBER, ORANGE, CORAL, MAGENTA, VIOLET, BLUE];

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

const PZEE_ART = LETTER_P.map((letterP, index) =>
  [letterP, LETTER_Z[index], LETTER_E[index], LETTER_E[index]].join('  '),
);

const HOUSE_LINES = [
  '       /^^^^^^^\\       ',
  '      /---------\\      ',
  '     /===========\\     ',
  '    /_____________\\    ',
  '    | []   o  ||  |    ',
  '    |_____________|    ',
];

const HOUSE_ART = HOUSE_LINES.map(
  (line, index) => `${HOUSE_COLOURS[index]}${line}${RESET}`,
);

function visibleLength(value: string): number {
  return value.replace(ANSI_PATTERN, '').length;
}

function padAnsiEnd(value: string, width: number): string {
  return value + ' '.repeat(Math.max(0, width - visibleLength(value)));
}

function buildBrandPanel(): string[] {
  const artwork = PZEE_ART.map((line, index) => {
    const house = HOUSE_ART[index] ?? '';
    return `${house} ${BOLD}${LOGO_COLOURS[index]}${line}${RESET}`;
  });

  return [
    '',
    ...artwork,
    '',
    `    ${AMBER}◆${RESET} ${WHITE}${BOLD}BUILD${RESET}  ${CORAL}◆${RESET} ${WHITE}${BOLD}CONNECT${RESET}  ${MAGENTA}◆${RESET} ${WHITE}${BOLD}SCALE${RESET}`,
    `    ${MUTED}${DIM}NestJS  ·  Prisma  ·  Supabase${RESET}`,
    '',
    `    ${VIOLET}╰─${RESET} ${MUTED}crafted for fast, reliable APIs${RESET}`,
  ];
}

function buildDetailsPanel(
  host: string,
  port: number,
  environment: string,
): string[] {
  const address = `http://${host}:${port}`;

  return [
    `${MAGENTA}${BOLD}PZEE CONTROL CENTRE${RESET}`,
    `${MUTED}${DIM}Backend runtime dashboard${RESET}`,
    `${VIOLET}╭─${RESET} ${WHITE}${BOLD}RUNTIME${RESET}`,
    `${VIOLET}│${RESET}  ${GREEN}● ONLINE${RESET}  ${MUTED}ready to accept requests${RESET}`,
    `${VIOLET}│${RESET}  ${CYAN}◆ ENV${RESET}     ${WHITE}${environment}${RESET}`,
    `${VIOLET}╰─${RESET} ${BLUE}◆ URL${RESET}     ${WHITE}${address}${RESET}`,
    `${VIOLET}╭─${RESET} ${WHITE}${BOLD}AVAILABLE ROUTES${RESET}`,
    `${VIOLET}│${RESET}  ${AMBER}${BOLD}GET ${RESET} ${GREEN}/api/example${RESET}`,
    `${VIOLET}│${RESET}  ${AMBER}${BOLD}GET ${RESET} ${GREEN}/api/health${RESET}`,
    `${VIOLET}│${RESET}  ${AMBER}${BOLD}GET ${RESET} ${GREEN}/api/health/database${RESET}`,
    `${VIOLET}│${RESET}  ${CYAN}${BOLD}UI  ${RESET} ${CYAN}/api/docs${RESET}`,
    `${VIOLET}╰─${RESET} ${MAGENTA}${BOLD}JSON${RESET} ${MAGENTA}/api/docs-json${RESET}`,
  ];
}

export function printStartupBanner(host: string, port: number): void {
  const environment = process.env.NODE_ENV ?? 'development';
  const brandPanel = buildBrandPanel();
  const detailsPanel = buildDetailsPanel(host, port, environment);
  const rowCount = Math.max(brandPanel.length, detailsPanel.length);
  const leftWidth = Math.max(...brandPanel.map(visibleLength));
  const rightWidth = Math.max(...detailsPanel.map(visibleLength));
  const innerWidth = leftWidth + rightWidth + 5;
  const title = ' PZEE BACKEND ';
  const topFill = '─'.repeat(Math.max(0, innerWidth - title.length - 1));

  const topBorder = `${BORDER}╭─${RESET}${ORANGE}${BOLD}${title}${RESET}${BORDER}${topFill}╮${RESET}`;
  const bottomBorder = `${BORDER}╰${'─'.repeat(innerWidth)}╯${RESET}`;
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const left = padAnsiEnd(brandPanel[index] ?? '', leftWidth);
    const right = padAnsiEnd(detailsPanel[index] ?? '', rightWidth);
    return `${BORDER}│${RESET} ${left} ${BORDER}│${RESET} ${right} ${BORDER}│${RESET}`;
  });

  process.stdout.write(
    `\n${topBorder}\n${rows.join('\n')}\n${bottomBorder}\n\n`,
  );
}
