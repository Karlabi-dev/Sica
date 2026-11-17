export const SECTION_META = {
  atendimentos: { title: "Atendimentos", description: "Acompanhe o fluxo de atendimento da clínica.", columns: ["Senha", "Paciente", "Profissional", "Status"], fields: ["Senha", "Paciente", "Profissional", "Status"] },
  filas: { title: "Filas de atendimento", description: "Visualize e organize as filas da recepção e dos consultórios.", columns: ["Senha", "Paciente", "Setor", "Status"], fields: ["Senha", "Paciente", "Setor", "Status"] },
  pacientes: { title: "Pacientes", description: "Gerencie os cadastros de pacientes.", columns: ["Nome", "Código", "Telefone", "Status"], fields: ["Nome", "Código", "Telefone", "Status"] },
  profissionais: { title: "Profissionais", description: "Organize os profissionais e sua disponibilidade.", columns: ["Nome", "Especialidade", "Sala", "Status"], fields: ["Nome", "Especialidade", "Sala", "Status"] },
  especialidades: { title: "Especialidades", description: "Gerencie as especialidades disponíveis.", columns: ["Especialidade", "Código", "Profissionais", "Status"], fields: ["Especialidade", "Código", "Profissionais", "Status"] },
  salas: { title: "Salas e consultórios", description: "Gerencie a estrutura física de atendimento.", columns: ["Sala", "Setor", "Responsável", "Status"], fields: ["Sala", "Setor", "Responsável", "Status"] },
  televisores: { title: "Painéis de TV", description: "Gerencie os painéis de chamada.", columns: ["Painel", "Localização", "Fila", "Status"], fields: ["Painel", "Localização", "Fila", "Status"] },
  funcionarios: { title: "Usuários e acessos", description: "Visualize os perfis de acesso autorizados.", columns: ["Nome", "Perfil", "Setor", "Status"], fields: ["Nome", "Perfil", "Setor", "Status"] },
  sessoes: { title: "Sessões de atendimento", description: "Acompanhe sessões de filas e seus períodos.", columns: ["Sessão", "Data", "Setor", "Status"], fields: ["Sessão", "Data", "Setor", "Status"] },
  auditoria: { title: "Auditoria", description: "Consulte registros demonstrativos de atividades.", columns: ["Ação", "Responsável", "Horário", "Status"], fields: ["Ação", "Responsável", "Horário", "Status"] },
};
const seed = {
  atendimentos: [["C024", "Ana Martins", "Dra. Camila", "Aguardando"], ["CP008", "Maria Santos", "Dr. Rafael", "Em atendimento"], ["P016", "Carlos Oliveira", "Dra. Camila", "Finalizado"], ["PP003", "João Pereira", "Dr. Rafael", "Aguardando"]],
  filas: [["C024", "Ana Martins", "Clínica geral", "Aguardando"], ["CP008", "Maria Santos", "Cardiologia", "Chamado"], ["P016", "Carlos Oliveira", "Clínica geral", "Aguardando"]],
  pacientes: [["Ana Martins", "PAC001", "(00) 90000-0001", "Ativo"], ["Maria Santos", "PAC002", "(00) 90000-0002", "Ativo"], ["Carlos Oliveira", "PAC003", "(00) 90000-0003", "Ativo"]],
  profissionais: [["Dra. Camila", "Clínica geral", "Consultório 03", "Disponível"], ["Dr. Rafael", "Cardiologia", "Consultório 02", "Em atendimento"], ["Dra. Juliana", "Pediatria", "Consultório 04", "Disponível"]],
  especialidades: [["Clínica geral", "ESP001", "2", "Ativo"], ["Cardiologia", "ESP002", "1", "Ativo"], ["Pediatria", "ESP003", "1", "Ativo"]],
  salas: [["Consultório 01", "Recepção", "Equipe", "Disponível"], ["Consultório 02", "Cardiologia", "Dr. Rafael", "Ocupada"], ["Consultório 03", "Clínica geral", "Dra. Camila", "Disponível"]],
  televisores: [["TV Recepção", "Recepção principal", "Geral", "Online"], ["TV Consultórios", "Corredor A", "Consultas", "Online"]],
  funcionarios: [["Atendente Teste", "Atendente", "Recepção", "Ativo"], ["Médico Teste", "Médico", "Consultórios", "Ativo"], ["Administrador Teste", "Administrador", "Administração", "Ativo"]],
  sessoes: [["Manhã", "17/11/2026", "Recepção", "Aberta"], ["Consultas", "17/11/2026", "Clínica geral", "Aberta"], ["Tarde", "17/11/2026", "Recepção", "Programada"]],
  auditoria: [["Abertura de sessão", "Administrador", "08:00", "Concluído"], ["Chamada de senha", "Atendente", "09:12", "Concluído"], ["Confirmação de chegada", "Médico", "09:20", "Concluído"]],
};
export function getDemoRows(section) {
  return (seed[section] || []).map((values, i) => ({ id: section + "-" + i, values }));
}
