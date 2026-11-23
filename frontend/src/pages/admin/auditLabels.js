const ACTIONS={
 "patient.history.viewed":["Consulta ao histórico do paciente","Pacientes"],
 "patient.returned_to_queue":["Paciente devolvido à fila","Atendimentos"],
 "attendance.administratively_closed":["Atendimento encerrado pela administração","Atendimentos"],
 "catalog.created":["Cadastro criado","Cadastros"],
 "catalog.updated":["Cadastro atualizado","Cadastros"],
 "catalog.deleted":["Cadastro excluído","Cadastros"],
 "specialties.seeded":["Especialidades padrão cadastradas","Especialidades"],
 "queue.configured":["Fila de atendimento cadastrada","Filas"],
 "queue.deleted":["Fila excluída","Filas"],
 "queue.status.changed":["Situação da fila alterada","Filas"],
 "doctor.created":["Profissional cadastrado","Profissionais"],
 "doctor.updated":["Cadastro do profissional atualizado","Profissionais"],
 "doctor.deleted":["Profissional removido do cadastro ativo","Profissionais"],
 "doctor.status.changed":["Situação do profissional alterada","Profissionais"],
 "patient.called":["Paciente chamado","Atendimentos"],
 "patient.arrived":["Chegada do paciente confirmada","Atendimentos"],
 "patient.transferred":["Paciente encaminhado","Atendimentos"]
};
const RESOURCES={patient_journey:"Jornada do paciente",queue_entry:"Atendimento na fila",queue_definition:"Fila de atendimento",queue:"Fila",doctor:"Profissional",staff_user:"Usuário da equipe",specialties:"Especialidades",specialty:"Especialidade",rooms:"Consultórios",room:"Consultório",patient:"Paciente",device:"Dispositivo",queue_session:"Sessão de atendimento"};
const ROLES={admin:"Administrador",doctor:"Médico",reception:"Recepção",kiosk:"Totem",staff:"Colaborador"};
const VERBS={created:"Cadastrado",updated:"Atualizado",deleted:"Excluído",activated:"Ativado",deactivated:"Desativado",viewed:"Consultado",configured:"Configurado",called:"Chamado",completed:"Concluído",cancelled:"Cancelado",returned:"Devolvido",linked:"Vinculado",unlinked:"Desvinculado",started:"Iniciado",finished:"Finalizado",closed:"Encerrado",opened:"Aberto",logged_in:"Acesso realizado",failed:"Tentativa não concluída",status:"Situação alterada"};
function pretty(text){return String(text??"").replace(/[_-]+/g," ").replace(/\b\w/g,s=>s.toUpperCase());}
export function describeAction(event){
 const key=event.action??"";
 if(ACTIONS[key]){let [title,category]=ACTIONS[key];if(key.startsWith("catalog.")){const target=resourceLabel(event.resource_type);title=title.replace("Cadastro",target);}return {title,category,known:true};}
 const parts=key.split(".");
 const noun=resourceLabel(event.resource_type);
 const verb=VERBS[parts.at(-1)];
 if(verb)return {title:noun+" — "+verb.toLowerCase(),category:categoryLabel(event.resource_type),known:false};
 return {title:"Ação registrada (sem descrição cadastrada)",category:categoryLabel(event.resource_type),known:false};
}
export function resourceLabel(value){return RESOURCES[value]??(value?pretty(value):"Não informado");}
export function categoryLabel(value){if(/doctor|professional/.test(value??""))return "Profissionais";if(/queue/.test(value??""))return "Filas";if(/patient|journey/.test(value??""))return "Pacientes";if(/room/.test(value??""))return "Consultórios";return "Outros registros";}
export function roleLabel(value){return ROLES[value]??(value?pretty(value):"Não informado");}
export function formatAuditDate(value){return value?new Date(value).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"medium"}):"Não informado";}
export function auditReason(event){return typeof event.metadata?.reason==="string"?event.metadata.reason:"";}
