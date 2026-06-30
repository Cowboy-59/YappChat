import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

/**
 * Spec 011 — email sender abstraction (T002).
 *
 * Sends via Amazon SES v2. Credentials come from the standard AWS provider chain
 * (AWS_PROFILE locally, the task role in ECS). SES is pinned to its own region
 * (SES_REGION, default us-east-1 — where the wxperts.com identity is verified),
 * independent of AWS_REGION used for S3. A send failure is logged, never thrown,
 * so it can't break the calling flow (signup, invite, etc.). All call sites are
 * provider-agnostic: they only call sendEmail().
 */
export type OutboundEmail = {
  to: string;
  subject: string;
  body: string;
  /** Optional action URL rendered as a button + surfaced in logs on failure. */
  actionUrl?: string;
};

const SES_REGION = process.env.SES_REGION ?? "us-east-1";
const EMAIL_FROM = process.env.EMAIL_FROM ?? "YappChat <admin@wxperts.com>";

let _client: SESv2Client | null = null;
function client(): SESv2Client {
  return (_client ??= new SESv2Client({ region: SES_REGION }));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderHtml(email: OutboundEmail): string {
  const action = email.actionUrl
    ? `<p style="margin:24px 0">
         <a href="${escapeHtml(email.actionUrl)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Open YappChat</a>
       </p>
       <p style="color:#6b7280;font-size:12px;word-break:break-all">Or paste this link into your browser:<br>${escapeHtml(email.actionUrl)}</p>`
    : "";
  return `<div style="font-family:system-ui,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111827">
    <h2 style="margin:0 0 12px;font-size:18px">YappChat</h2>
    <p style="font-size:14px;line-height:1.6;white-space:pre-line">${escapeHtml(email.body)}</p>
    ${action}
  </div>`;
}

export async function sendEmail(email: OutboundEmail): Promise<void> {
  const text = email.body + (email.actionUrl ? `\n\n${email.actionUrl}` : "");
  try {
    await client().send(
      new SendEmailCommand({
        FromEmailAddress: EMAIL_FROM,
        Destination: { ToAddresses: [email.to] },
        Content: {
          Simple: {
            Subject: { Data: email.subject, Charset: "UTF-8" },
            Body: {
              Html: { Data: renderHtml(email), Charset: "UTF-8" },
              Text: { Data: text, Charset: "UTF-8" },
            },
          },
        },
      }),
    );
  } catch (err) {
    // Never let a mail failure break the calling flow. Surface the link in logs.
    console.error(
      `[mailer] SES send failed (to=${email.to}): ${(err as Error).message}` +
        (email.actionUrl ? `\n[mailer]   link: ${email.actionUrl}` : ""),
    );
  }
}
