/** Startup display: renders a creative PZEE terminal dashboard. */
const SAFFRON = '\u001B[38;2;255;153;51m';
const GREEN = '\u001B[38;2;120;200;80m';
const WHITE = '\u001B[97m';
const MUTED = '\u001B[90m';
const RESET = '\u001B[0m';

const ROOF_1 = '\u001B[38;2;255;146;84m';
const ROOF_2 = '\u001B[38;2;240;116;64m';
const ROOF_3 = '\u001B[38;2;219;92;50m';
const ROOF_4 = '\u001B[38;2;194;70;42m';
const WALL = '\u001B[38;2;214;178;132m';
const WINDOW = '\u001B[1m\u001B[38;2;255;208;92m';
const DOOR = '\u001B[38;2;120;74;42m';

const PZEE_ART = [
  '██████╗ ███████╗███████╗███████╗',
  '██╔══██╗╚══███╔╝██╔════╝██╔════╝',
  '██████╔╝  ███╔╝ █████╗  █████╗  ',
  '██╔═══╝  ███╔╝  ██╔══╝  ██╔══╝  ',
  '██║     ███████╗███████╗███████╗',
  '╚═╝     ╚══════╝╚══════╝╚══════╝',
];

/** Hut mark — 6 rows, 18 columns, pre-coloured to sit left of PZEE_ART. */
const HUT_ART = [
  `      ${ROOF_1}▄▄▄▄▄${RESET}       `,
  `     ${ROOF_2}╱█████╲${RESET}      `,
  `    ${ROOF_3}╱███████╲${RESET}     `,
  `   ${ROOF_4}╱█████████╲${RESET}    `,
  `   ${WALL}│ ${WINDOW}▣${RESET}${WALL}  ${DOOR}▐█▌${WALL}  │${RESET}    `,
  `   ${WALL}│▁▁▁▁▁▁▁▁▁│${RESET}    `,
];

const HUT_WIDTH = 18;

export function printStartupBanner(host: string, port: number): void {
  const environment = process.env.NODE_ENV ?? 'development';
  const details = [
    `${WHITE}Welcome to ${SAFFRON}PZEE${RESET}`,
    '',
    `${WHITE}Server running as ${GREEN}${environment} [READY]${RESET}`,
    '',
    `${WHITE}Connection:${RESET}`,
    `  ${MUTED}Host:${RESET}   ${GREEN}http://${host}:${port}${RESET}`,
    `  ${MUTED}Root:${RESET}   ${GREEN}/api${RESET}`,
    '',
    `${WHITE}Available routes:${RESET}`,
    `  ${SAFFRON}GET${RESET}    ${GREEN}/api/example${RESET}`,
    `  ${SAFFRON}GET${RESET}    ${GREEN}/api/health${RESET}`,
    `  ${SAFFRON}DOCS${RESET}   ${GREEN}/api/docs${RESET}`,
  ];

  const artWidth = Math.max(...PZEE_ART.map((line) => line.length));
  const rowCount = Math.max(PZEE_ART.length, details.length);
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const hut = HUT_ART[index] ?? ' '.repeat(HUT_WIDTH);
    const art = (PZEE_ART[index] ?? '').padEnd(artWidth);
    const detail = details[index] ?? '';
    return `  ${hut}  ${SAFFRON}${art}${RESET}     ${detail}`.trimEnd();
  });

  const divider = `${MUTED}${'─'.repeat(artWidth + HUT_WIDTH + 41)}${RESET}`;
  process.stdout.write(`\n${divider}\n${rows.join('\n')}\n${divider}\n\n`);
}