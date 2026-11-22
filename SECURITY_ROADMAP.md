# Segurança do SICA — plano do protótipo

## Implementado (sem serviços pagos adicionais)
- Firebase Authentication para contas administrativas.
- Código de verificação administrativo por e-mail, com validade de cinco minutos, limite de solicitações, tentativas e armazenamento do hash do código.
- Envio de e-mails via API HTTPS do Brevo (exige BREVO_API_KEY e BREVO_FROM_EMAIL no Render).
- Sessões administrativas com token aleatório armazenado como hash no banco, expiração e revogação.
- Rotas administrativas exigem identidade Firebase, função admin e segundo fator/sessão administrativa válida.
- CORS restrito, Helmet, limite de corpo JSON e limites de requisições em rotas sensíveis.
- Dispositivos operacionais dependem de aprovação do administrador e verificação no servidor; credenciais são armazenadas como hash no banco.

## Limitações importantes antes de dados reais de pacientes
- O segundo fator por e-mail é menos resistente a phishing que TOTP/passkeys.
- A credencial de dispositivo no localStorage é copiável; não equivale a autenticação vinculada ao hardware. Não considerar esta versão pronta para computadores de clínicas com dados reais.
- O limitador atual é em memória, por processo. Para múltiplas instâncias ou produção, usar proteção de borda e armazenamento compartilhado.
- Painéis administrativos ainda contêm dados demonstrativos. Não utilizar como fonte de verdade.
- Ainda é necessário revisar autorização em todas as rotas, controles de acesso por sala, auditoria, backups, recuperação de conta, proteção contra XSS/CSRF, privacidade/LGPD e testes automatizados.
- Não incluir segredos Firebase, Brevo, Neon ou tokens no repositório ou em logs.

## Evolução planejada
1. Testar entrega do código Brevo e acesso administrativo fim a fim.
2. Vincular guichês e consultórios aos dispositivos e registrar ações por dispositivo.
3. Migrar dispositivos para credenciais mais fortes, preferencialmente chaves vinculadas ao dispositivo, com rotação e revogação.
4. Adotar MFA TOTP nativo do Firebase Identity Platform, ou passkeys/WebAuthn, após avaliar disponibilidade e custos.
5. Implantar monitoramento, alertas, backups e testes de segurança antes de uso com pacientes reais.

**Nunca remover MFA para contornar problemas de entrega de e-mail.**
