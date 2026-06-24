// Envio de e-mails transacionais via Resend (resend.com).
//
// Hoje só existe um e-mail: o de recuperação de senha. O cliente do Resend é
// criado de forma preguiçosa e só quando há RESEND_API_KEY configurada.
//
// MOCK: se a RESEND_API_KEY não estiver no ambiente (ex.: em testes locais),
// nada é enviado de verdade — o conteúdo (incluindo o link) é apenas logado no
// console com um aviso claro. Assim dá para testar o fluxo ponta a ponta sem
// gastar envio real nem precisar da chave.

const { Resend } = require("resend");

// Remetente verificado no Resend. Sem domínio próprio verificado, o Resend só
// permite enviar a partir de onboarding@resend.dev. Configurável via .env.
const REMETENTE = process.env.RESEND_FROM || "Chute do Vidente <onboarding@resend.dev>";

let resendClient = null;
function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// Monta o HTML do e-mail. Tema místico do app (Madame Placar), mas sem exagero:
// o foco é deixar claro o que fazer e que o link expira em 30 minutos.
function montarHtml(link) {
  return `
  <div style="margin:0;padding:24px;background:#0f0d23;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#171436;border:1px solid rgba(124,58,237,0.25);border-radius:18px;padding:32px;color:#f0ecff;">
      <p style="font-size:22px;font-weight:700;margin:0 0 4px;">
        🔮 <span style="color:#a78bfa;">Chute do Vidente</span>
      </p>
      <p style="font-size:13px;color:#a99fd6;margin:0 0 24px;">Recuperação de senha</p>

      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
        A Madame Placar consultou os astros e viu que você quer redefinir sua senha. ✨
      </p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">
        Clique no botão abaixo para escolher uma nova senha. Este link é único e
        <strong>expira em 30 minutos</strong> — depois disso, será preciso pedir um novo.
      </p>

      <div style="text-align:center;margin:0 0 24px;">
        <a href="${link}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:10px;font-size:15px;">
          Redefinir minha senha
        </a>
      </div>

      <p style="font-size:13px;line-height:1.6;color:#a99fd6;margin:0 0 8px;">
        Se o botão não funcionar, copie e cole este endereço no navegador:
      </p>
      <p style="font-size:12px;word-break:break-all;color:#a78bfa;margin:0 0 24px;">${link}</p>

      <p style="font-size:13px;line-height:1.6;color:#a99fd6;margin:0;border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;">
        Se você não pediu para redefinir sua senha, pode ignorar este e-mail com tranquilidade —
        sua conta continua segura.
      </p>
    </div>
  </div>`;
}

// Envia o e-mail de recuperação. Retorna { enviado, mock } para o chamador
// saber se foi um envio real ou apenas mock (mas a resposta da API ao usuário
// é sempre genérica, independentemente disso).
async function enviarEmailRecuperacao(destinatario, link) {
  const resend = getResend();

  if (!resend) {
    console.warn(
      "[email] RESEND_API_KEY não configurada — envio MOCKADO (nenhum e-mail real foi enviado).",
    );
    console.warn(`[email] Para: ${destinatario}`);
    console.warn(`[email] Link de recuperação: ${link}`);
    return { enviado: false, mock: true };
  }

  await resend.emails.send({
    from: REMETENTE,
    to: destinatario,
    subject: "Redefinição de senha — Chute do Vidente 🔮",
    html: montarHtml(link),
  });

  return { enviado: true, mock: false };
}

module.exports = { enviarEmailRecuperacao };
