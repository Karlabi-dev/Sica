import { Link } from "react-router-dom";
import { ADMIN_MENU } from "../../layouts/AdminLayout.jsx";
import "./AdminPage.css";

const bars = [30,45,38,64,51,77,59,84,66,91,74,62];
const activity = [
  ["09:20", "Senha CP008 chamada", "Consultório 02", "Em atendimento"],
  ["09:12", "Paciente Ana Martins", "Recepção", "Aguardando"],
  ["09:05", "Sessão de atendimento", "Clínica geral", "Aberta"],
  ["08:40", "Senha P016 concluída", "Consultório 03", "Finalizado"]
];

export default function AdminPage() {
  return <main className="admin-page">
    <div className="admin-page-heading"><div><p className="admin-eyebrow">VISÃO GERAL</p><h1>Dashboard</h1><p>Acompanhe os principais indicadores da clínica.</p></div><span className="admin-period">Hoje • Demonstração</span></div>
    <div className="admin-kpis"><div className="admin-kpi"><span>Atendimentos hoje</span><strong>128</strong><small>↑ 12% em relação ao período anterior</small></div><div className="admin-kpi"><span>Pacientes aguardando</span><strong>18</strong><small>Fila de atendimento</small></div><div className="admin-kpi"><span>Em atendimento</span><strong>07</strong><small>Consultas em andamento</small></div><div className="admin-kpi"><span>Tempo médio de espera</span><strong>24 <em>min</em></strong><small>Estimativa demonstrativa</small></div></div>
    <div className="admin-dashboard-grid"><section className="admin-panel"><div className="admin-panel-title"><div><h2>Visão geral dos atendimentos</h2><p>Volume por período</p></div><span>Últimos 12 períodos</span></div><div className="admin-chart" role="img" aria-label="Gráfico demonstrativo de atendimentos nos últimos doze períodos">{bars.map((height,i) => <div className="admin-chart-column" key={i}><div className="admin-chart-bar" style={{height:height+"%"}}/><small>{String(i+1).padStart(2,"0")}</small></div>)}</div></section><section className="admin-panel"><div className="admin-panel-title"><div><h2>Status das filas</h2><p>Distribuição de atendimentos</p></div></div><div className="admin-donut-area"><div className="admin-donut"><div><strong>128</strong><small>Total</small></div></div></div><div className="admin-legend"><span><i className="admin-dot teal"/>Finalizados <strong>76</strong></span><span><i className="admin-dot blue"/>Aguardando <strong>35</strong></span><span><i className="admin-dot light"/>Em andamento <strong>17</strong></span></div></section></div>
    <div className="admin-dashboard-grid"><section className="admin-panel"><div className="admin-panel-title"><div><h2>Atividade recente</h2><p>Últimas movimentações do atendimento</p></div><Link to="/admin/atendimentos">Ver todos</Link></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Horário</th><th>Atividade</th><th>Setor</th><th>Status</th></tr></thead><tbody>{activity.map(row => <tr key={row[0]}>{row.map((cell,i)=><td key={i}>{i===3?<span className="admin-tag">{cell}</span>:cell}</td>)}</tr>)}</tbody></table></div></section><section className="admin-panel"><div className="admin-panel-title"><div><h2>Acesso rápido</h2><p>Gerencie as áreas do sistema</p></div></div><div className="admin-shortcuts">{ADMIN_MENU.filter(x=>!x.end).slice(0,8).map(item=><Link key={item.to} to={item.to}><span>{item.icon}</span>{item.label}<b>›</b></Link>)}</div></section></div>
    <p className="admin-disclaimer">Dados ilustrativos do protótipo. Os indicadores ainda não são provenientes do Neon.</p>
  </main>;
}
