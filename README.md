# SICA — Sistema Inteligente de Controle de Atendimento

Projeto da **DivoDevs** para gerenciamento de filas de atendimento em clínicas.

## Acesso às páginas do SICA

**Aplicação publicada:** https://sica-web.onrender.com

| Área | Link direto | Acesso |
| --- | --- | --- |
| **Atendente / Recepção** | [Abrir recepção](https://sica-web.onrender.com/atendente) | Computador autorizado para recepção |
| **Médico / Atendimento** | [Abrir atendimento médico](https://sica-web.onrender.com/medico) | Computador autorizado para atendimento médico |
| **Administrador (ADM)** | [Abrir painel administrativo](https://sica-web.onrender.com/admin) | Autenticação de administrador |
| **Totem / Emissão de senhas** | [Abrir totem](https://sica-web.onrender.com/totem) | Acesso público |
| **TV / Painel de chamadas** | [Abrir painel de TV](https://sica-web.onrender.com/tv) | Visualização pública |

Para solicitar a autorização de um computador, acesse [Autorizar computador](https://sica-web.onrender.com/autorizar-computador). A aprovação é feita pelo administrador em **Dispositivos autorizados**.

> Os links apontam para o frontend hospedado no Render. O funcionamento depende de o serviço estar disponível e atualizado.

## Objetivo
Organizar recepção, triagem, consultas e exames, permitindo que pacientes acompanhem sua própria fila por link/QR Code e por painel de TV na clínica.

## Visões
- **Paciente:** totem de emissão de senha (quando disponível) e acompanhamento individual, sem login.
- **Atendente:** chamada da recepção, identificação/cadastro e encaminhamento às filas seguintes.
- **Médico:** chamada do próximo paciente e confirmação de chegada.
- **Administrador:** dashboard analítico, gerenciamento de filas, pacientes, profissionais, especialidades, salas, usuários, relatórios, auditoria e configurações.
- **TV:** painel público somente leitura, com senha, destino e sala; sem dados pessoais.

## Regras essenciais
- Cada instalação atende **uma única clínica**.
- Uma especialidade pode ter **filas individuais por profissional** ou **fila compartilhada**, com distribuição considerando disponibilidade, horários e salas.
- Prioridades legais são diferentes das categorias administrativas (convênio/particular).
- O mesmo link individual acompanha a jornada entre etapas, até seu encerramento/revogação/expiração; não exibir dados de terceiros.
- A autenticação e as permissões operacionais serão verificadas no backend. O frontend não substitui controles de segurança.

## Tecnologias planejadas
- Frontend: React + Vite, React Router, CSS modular.
- Backend futuro: Node.js + Express (monólito modular).
- Banco futuro: PostgreSQL, acessado **somente pelo backend**.
- Identidade: Firebase Authentication, com política de MFA a ser implementada conforme requisitos.

## Estrutura
```text
frontend/
  src/
    app/
    assets/
    components/
    layouts/
    pages/
      patient/
      attendant/
      doctor/
      admin/
      tv/
      auth/
    modules/
    hooks/
    routes/
    services/
    styles/
backend/            # reservado para implementação posterior
docs/
README.md
.gitignore
```

## Estado atual
**Estrutura inicial do frontend.** As páginas são placeholders de navegação, não funcionalidades operacionais nem integrações reais. Telas finais serão implementadas com base nas capturas do Figma, uma por vez. O painel de TV e integrações avançadas constam da evolução planejada no documento v1.1, embora já tenham espaço reservado no frontend.

## Rodar localmente
```bash
cd frontend
npm install
npm run dev
```
Build: `npm run build`.

## Segurança e privacidade
Nunca commitar segredos ou dados reais de pacientes. Links de acompanhamento devem usar tokens seguros emitidos pelo backend; o frontend não gera tokens de produção.

## Referência
Documento de requisitos **SICA v1.1 (07/11/2026)**. Implementação incremental; requisitos de segurança e prioridades devem ser validados antes de operação real.
