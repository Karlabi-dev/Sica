import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './KioskPage.css';

const OPTIONS = [
  { id: 'convenio', number: '01', title: 'Convênio', description: 'Atendimento pelo seu plano de saúde', prefix: 'C', demo: 'C024' },
  { id: 'convenio-prioridade', number: '02', title: 'Convênio Prioridade', description: 'Atendimento prioritário por convênio', prefix: 'CP', demo: 'CP008' },
  { id: 'particular', number: '03', title: 'Particular', description: 'Atendimento particular', prefix: 'P', demo: 'P016' },
  { id: 'particular-prioridade', number: '04', title: 'Particular Prioridade', description: 'Atendimento prioritário particular', prefix: 'PP', demo: 'PP003' },
];

function Brand() {
  return <div className="kiosk-brand" aria-label="SICA — Sistema Inteligente de Controle de Atendimento">
    <span className="kiosk-symbol" aria-hidden="true">S</span>
    <div><strong>SICA</strong><small>SISTEMA DE CONTROLE DE ATENDIMENTO</small></div>
  </div>;
}

function KioskHeader() {
  return <header className="kiosk-header"><Brand /><span className="kiosk-header-label">AUTOATENDIMENTO</span></header>;
}

export default function KioskPage() {
  const [step, setStep] = useState('choose');
  const [choice, setChoice] = useState(null);
  const trackingUrl = typeof window === 'undefined' ? '/acompanhar/demo' : new URL('/acompanhar/demo', window.location.origin).href;

  function selectOption(option) {
    setChoice(option);
    setStep('issued');
  }

  function printTicket() {
    setStep('printed');
    // A janela de impressão só é aberta por ação explícita do usuário.
    // A impressão automática via impressora térmica exigirá integração própria.
    window.setTimeout(() => window.print(), 100);
  }

  function reset() {
    setStep('choose');
    setChoice(null);
  }

  return <div className="kiosk-page">
    <div className="kiosk-screen">
      <KioskHeader />
      {step === 'choose' ? (
        <main className="kiosk-main kiosk-main--choose">
          <p className="kiosk-overline">BEM-VINDO(A) À CLÍNICA</p>
          <h1>Como será seu<br />atendimento?</h1>
          <p className="kiosk-intro">Toque em uma opção para retirar sua senha.</p>
          <div className="kiosk-options">
            {OPTIONS.map(option => <button type="button" className="kiosk-option" key={option.id} onClick={() => selectOption(option)}>
              <span className="kiosk-option-top"><span>{option.number}</span><span aria-hidden="true">↗</span></span>
              <strong>{option.title}</strong>
              <small>{option.description}</small>
            </button>)}
          </div>
          <aside className="kiosk-notice"><strong>Atendimento prioritário</strong><span>Selecione “Prioridade” se você tem direito ao atendimento preferencial.</span></aside>
        </main>
      ) : (
        <main className="kiosk-main kiosk-main--ticket">
          <p className="kiosk-overline">{step === 'issued' ? 'SENHA GERADA COM SUCESSO' : 'SENHA PRONTA'}</p>
          <h1>{step === 'issued' ? 'Sua senha foi emitida' : 'Tudo pronto para aguardar'}</h1>
          <p className="kiosk-intro">{step === 'issued' ? 'Guarde sua senha e acompanhe seu atendimento.' : 'Retire seu comprovante e aguarde sua chamada.'}</p>
          <section className="kiosk-ticket" aria-label="Comprovante de senha">
            <span className="kiosk-ticket-label">SENHA DE ATENDIMENTO</span>
            <strong className="kiosk-ticket-number">{choice.demo}</strong>
            <span className="kiosk-ticket-category">{choice.title}</span>
            <span className="kiosk-ticket-destination">Recepção</span>
            <div className="kiosk-qr"><QRCodeSVG value={trackingUrl} size={150} level="M" marginSize={1} title="QR Code de demonstração do acompanhamento" /></div>
            <strong className="kiosk-track-title">Acompanhe pelo celular</strong>
            <p className="kiosk-track-description">Aponte a câmera para o QR Code para visualizar sua fila.</p>
          </section>
          {step === 'issued' ? <button className="kiosk-primary" type="button" onClick={printTicket}>Imprimir comprovante</button> : <div className="kiosk-success" role="status">✓ Comprovante preparado para impressão</div>}
          <p className="kiosk-helper">Aguarde sua senha ser chamada na recepção.<br />Você também pode acompanhar pelo painel da clínica.</p>
          {step === 'printed' && <button type="button" className="kiosk-secondary" onClick={reset}>Novo atendimento</button>}
        </main>
      )}
      <footer className="kiosk-footer">SICA • Atendimento organizado para você <span>Protótipo demonstrativo — não emite senhas reais</span></footer>
    </div>
  </div>;
}
