# SICA — API de código por e-mail (primeira etapa)

Esta etapa **não libera o painel administrativo**. O backend atual exige MFA do Firebase em /auth/me. O código de e-mail é validado separadamente e ainda não substitui esse requisito; nunca remova a verificação de MFA para testar.

1. No Neon, banco **sica_db**, execute **db/migrations/0002_admin_email_challenges.sql** uma única vez.
2. Execute `npm install` na pasta backend (adiciona nodemailer).
3. Configure no `backend/.env` os valores SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM e ADMIN_OTP_PEPPER (segredo aleatório de pelo menos 32 caracteres). Não faça commit do .env. O provedor SMTP precisa permitir envio; não há necessidade de contratar um plano pago se já possuir um provedor gratuito adequado.
4. Garanta que o e-mail do admin em Neon seja o mesmo do Firebase, e esteja marcado como verificado no Firebase.
5. Inicie `npm run dev`. Com um Firebase ID token válido do administrador, envie POST /auth/admin/email-code/request com Authorization: Bearer <ID_TOKEN> e corpo JSON {}. A resposta contém challengeId.
6. Envie POST /auth/admin/email-code/verify com o mesmo Bearer e JSON {"challengeId":"...","code":"123456"}. O código real chega por e-mail, vence em 5 minutos, tem 5 tentativas, e só pode ser utilizado uma vez. Há limite de 3 solicitações por 15 minutos por administrador.

**Atenção:** Não use códigos de teste fixos, não exponha tokens nem senhas em logs e não coloque segredos no GitHub. O mecanismo de dispositivo confiável e a integração segura com a sessão administrativa ainda são etapas futuras. Um código por e-mail não é MFA nativo do Firebase.
