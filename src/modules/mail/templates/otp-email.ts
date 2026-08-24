/** The verification email, as HTML and as plain text. */

interface OtpEmailInput {
  code: string;
  /** How long the code lasts, in minutes. */
  minutes: number;
  /** Shown in the greeting when we know it. */
  name?: string;
}

/**
 * Built as a table with inline styles on purpose.
 *
 * Email clients are not browsers: Gmail strips `<style>` blocks in some views,
 * Outlook renders through Word, and flexbox and grid are unreliable in both.
 * Tables with inline styles are the one layout that survives everywhere, which
 * is why every transactional email still looks like this under the hood.
 */
export function otpEmailHtml({ code, minutes, name }: OtpEmailInput): string {
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi,';
  const spaced = code.split('').join('&nbsp;&nbsp;');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Your Pzee verification code</title>
  </head>
  <body style="margin:0;padding:0;background-color:#faf7f3;">
    <!-- Shown in the inbox list under the subject, before anything is opened. -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      ${code} is your Pzee verification code. It expires in ${minutes} minutes.
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf7f3;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 2px 12px rgba(38,22,10,0.06);">

            <tr>
              <td style="background:linear-gradient(135deg,#FF7722 0%,#E85D0C 100%);padding:28px 32px;">
                <span style="display:inline-block;background-color:#ffffff;color:#1a1a1a;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;font-weight:800;letter-spacing:-0.3px;padding:8px 14px;border-radius:10px;">
                  PG&nbsp;&nbsp;Pzee
                </span>
                <p style="margin:16px 0 0;color:#ffffff;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;">
                  Confirm your email
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 6px;color:#2b2b2b;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;">
                  ${greeting}
                </p>
                <p style="margin:0 0 24px;color:#6b6b6b;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;">
                  Enter this code on Pzee to finish creating your account.
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="background-color:#fff6ef;border:1px dashed #ffb37a;border-radius:16px;padding:22px 16px;">
                      <div style="color:#8a4b16;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">
                        Your code
                      </div>
                      <div style="margin-top:10px;color:#B34700;font-family:Consolas,Menlo,Courier New,monospace;font-size:34px;font-weight:700;letter-spacing:4px;">
                        ${spaced}
                      </div>
                      <div style="margin-top:10px;color:#8a6a52;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;">
                        Expires in ${minutes} minutes
                      </div>
                    </td>
                  </tr>
                </table>

                <p style="margin:24px 0 0;color:#6b6b6b;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;">
                  Didn't ask for this? You can ignore this email — nothing was
                  created, and the code stops working on its own.
                </p>
              </td>
            </tr>

            <tr>
              <td style="background-color:#faf7f3;padding:18px 32px;border-top:1px solid #efe7de;">
                <p style="margin:0;color:#8a8177;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;">
                  Pzee — trusted PGs and rooms, without the usual hassle.<br />
                  Nobody at Pzee will ever ask you for this code.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** The fallback for clients that refuse HTML, and for spam scoring. */
export function otpEmailText({ code, minutes, name }: OtpEmailInput): string {
  return [
    name ? `Hi ${name},` : 'Hi,',
    '',
    'Enter this code on Pzee to finish creating your account:',
    '',
    `    ${code}`,
    '',
    `It expires in ${minutes} minutes.`,
    '',
    "Didn't ask for this? You can ignore this email — nothing was created,",
    'and the code stops working on its own.',
    '',
    'Nobody at Pzee will ever ask you for this code.',
  ].join('\n');
}

/** A name comes from a form, so it never goes into HTML unescaped. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
