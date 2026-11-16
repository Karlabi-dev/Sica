# Rotas do frontend SICA

| Caminho | Visão | Finalidade |
| --- | --- | --- |
| `/` | Desenvolvimento | Índice temporário das rotas |
| `/login` | Funcionários | Login (a implementar) |
| `/totem` | Paciente/totem | Retirada de senha |
| `/acompanhar/:token` | Paciente | Acompanhamento individual somente leitura |
| `/atendente` | Atendente | Chamada, cadastro e encaminhamento |
| `/medico` | Médico | Chamada e confirmação de chegada |
| `/admin` | Administrador | Dashboard analítico |
| `/admin/filas` | Administrador | Sessões, filas individuais/compartilhadas |
| `/admin/pacientes` | Administrador | Cadastro e consulta |
| `/admin/funcionarios` | Administrador | Funcionários e permissões |
| `/admin/especialidades` | Administrador | Especialidades |
| `/admin/profissionais` | Administrador | Profissionais, agendas e disponibilidade |
| `/admin/salas` | Administrador | Salas e associações |
| `/admin/televisores` | Administrador | Configuração de painéis públicos |
| `/admin/relatorios` | Administrador | Indicadores e comparativos |
| `/admin/auditoria` | Administrador | Histórico operacional |
| `/admin/configuracoes` | Administrador | Configurações da clínica |
| `/tv` | Público | Painel de chamadas para TV |

**Aviso:** rotas operacionais ainda não estão protegidas; não há backend, login nem dados reais. Antes de publicar para uso clínico, implementar autenticação, autorização no backend, proteção dos tokens e tratamento de dados pessoais.
