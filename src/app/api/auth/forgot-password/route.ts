import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail, emailPasswordReset } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email requerido" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (user) {
      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || ""}/reset-password?token=${token}`;
      const emailParams = emailPasswordReset(user.name, user.email, resetUrl);
      await sendEmail(emailParams);
    }

    return NextResponse.json({
      message: "Si el correo existe, recibirás un enlace para restablecer tu contraseña.",
    });
  } catch {
    return NextResponse.json({
      message: "Si el correo existe, recibirás un enlace para restablecer tu contraseña.",
    });
  }
}
