import nodemailer from "nodemailer";

const globalForMail = globalThis as unknown as {
  mailTransport?: nodemailer.Transporter;
};

export function getTransport(): nodemailer.Transporter {
  if (!globalForMail.mailTransport) {
    globalForMail.mailTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "localhost",
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: false,
    });
  }
  return globalForMail.mailTransport;
}

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  await getTransport().sendMail({
    from: process.env.SMTP_FROM ?? "oPortfolio <no-reply@oportfolio.local>",
    to,
    subject,
    text,
  });
}
