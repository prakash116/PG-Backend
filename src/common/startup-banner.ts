/** Startup display: renders a creative PZEE terminal dashboard. */
const SAFFRON = '\u001B[38;2;255;153;51m';
const GREEN = '\u001B[38;2;120;200;80m';
const WHITE = '\u001B[97m';
const MUTED = '\u001B[90m';
const RESET = '\u001B[0m';

const PZEE_ART = [
  '██████╗ ███████╗███████╗███████╗',
  '██╔══██╗╚══███╔╝██╔════╝██╔════╝',
  '██████╔╝  ███╔╝ █████╗  █████╗  ',
  '██╔═══╝  ███╔╝  ██╔══╝  ██╔══╝  ',
  '██║     ███████╗███████╗███████╗',
  '╚═╝     ╚══════╝╚══════╝╚══════╝',
];

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
  ];

  const artWidth = Math.max(...PZEE_ART.map((line) => line.length));
  const rowCount = Math.max(PZEE_ART.length, details.length);
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const art = (PZEE_ART[index] ?? '').padEnd(artWidth);
    const detail = details[index] ?? '';
    return `  ${SAFFRON}${art}${RESET}     ${detail}`.trimEnd();
  });

  const divider = `${MUTED}${'─'.repeat(artWidth + 39)}${RESET}`;
  process.stdout.write(`\n${divider}\n${rows.join('\n')}\n${divider}\n\n`);
}
