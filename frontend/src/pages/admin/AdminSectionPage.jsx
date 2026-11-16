import { useParams } from 'react-router-dom';
import PageShell from '../../components/PageShell.jsx';
const sections={filas:'Filas e sessões',pacientes:'Pacientes',funcionarios:'Funcionários e permissões',especialidades:'Especialidades',profissionais:'Profissionais e disponibilidade',salas:'Salas',televisores:'Painéis de TV',relatorios:'Relatórios e gráficos',auditoria:'Auditoria',configuracoes:'Configurações'};
export default function AdminSectionPage(){const {section}=useParams();return <PageShell title={sections[section]||'Seção não encontrada'} description="Página reservada para implementação fiel ao Figma e aos requisitos do SICA." links={[{to:'/admin',label:'Voltar ao dashboard'}]}/>;}
