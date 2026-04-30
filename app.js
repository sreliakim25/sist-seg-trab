/* ============================================================
   VMC SAFETY — App Logic
   Offline-first, LocalStorage persistence, PWA-ready
   ============================================================ */

// ── DATA STORE ───────────────────────────────────────────────
const DB = {
  get: (k, fallback = null) => { try { const v = localStorage.getItem('vmc_' + k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set: (k, v) => localStorage.setItem('vmc_' + k, JSON.stringify(v)),
};

// ── STATE ─────────────────────────────────────────────────────
let currentUser   = null;
let currentForm   = null;
let currentStep   = 0;

const VALID_USERS = {
  'eliakimrocha': { name: 'Eliakim Rocha', role: 'Técnico de Segurança', pass: '123' },
  'livyafarias':  { name: 'Livya Farias',  role: 'Técnico de Segurança', pass: '12345' }
};
let formData      = {};
let currentPermitId = null;
let lastSavedPermit = null;
let signaturePad    = null;
let currentSigningTarget = null;

// ── FORM DEFINITIONS ─────────────────────────────────────────
const FORM_TYPES = DB.get('formTypes', [
  {
    id: 'PTE',
    name: 'Permissão de Trabalho Especial',
    code: 'FORM 226',
    desc: 'Escavação e serviços especiais em vala',
    icon: '⛏️',
    color: '#8B4513',
    bg: '#FFF3E0',
  },
  {
    id: 'PTA',
    name: 'Permissão para Trabalho em Altura',
    code: 'FORM 34',
    desc: 'Andaime, escada e outros meios a mais de 2m',
    icon: '🪜',
    color: '#1565C0',
    bg: '#E3F2FD',
  },
]);

// ── FORM SCHEMAS ─────────────────────────────────────────────
const FORMS = {

  PTE: {
    steps: [
      {
        title: 'Identificação',
        desc: 'Dados gerais da permissão de trabalho especial',
        render: () => `
          <div class="form-step-section">
            <div class="step-title">Identificação da PTE</div>
            <div class="step-desc">Preencha os dados gerais desta permissão.</div>

            <div class="form-group full-span">
              <label>Nº da PTE <span class="required-star">*</span></label>
              <input type="text" data-field="numeroPTE" placeholder="Ex: PTE-2025-001" value="${v('numeroPTE')}">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Data de Emissão <span class="required-star">*</span></label>
                <input type="date" data-field="dataEmissao" value="${v('dataEmissao', today())}">
              </div>
              <div class="form-group">
                <label>Hora <span class="required-star">*</span></label>
                <input type="time" data-field="horaEmissao" value="${v('horaEmissao', nowTime())}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Requisitante <span class="required-star">*</span></label>
                <input type="text" data-field="requisitante" placeholder="Nome completo" value="${v('requisitante')}">
              </div>
              <div class="form-group">
                <label>Função do Requisitante</label>
                <input type="text" data-field="funcaoRequisitante" placeholder="Cargo" value="${v('funcaoRequisitante')}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Emitente <span class="required-star">*</span></label>
                <input type="text" data-field="emitente" placeholder="Nome completo" value="${v('emitente')}">
              </div>
              <div class="form-group">
                <label>Função do Emitente</label>
                <input type="text" data-field="funcaoEmitente" placeholder="Cargo" value="${v('funcaoEmitente')}">
              </div>
            </div>
            <div class="form-group">
              <label>Trabalho a Executar <span class="required-star">*</span></label>
              <textarea data-field="trabalhoExecutar" placeholder="Descreva o serviço a ser realizado…" rows="3">${v('trabalhoExecutar')}</textarea>
            </div>
            <div class="form-group">
              <label>Área de Execução <span class="required-star">*</span></label>
              <input type="text" data-field="areaExecucao" placeholder="Ex: Rua das Flores, nº 120 — Caruaru/PE" value="${v('areaExecucao')}">
            </div>
            <div class="form-group">
              <label>Obra / Projeto</label>
              <input type="text" data-field="obra" placeholder="Ex: Rede Emissária Lote 7" value="${v('obra')}">
            </div>
            <div class="form-group">
              <label>Tel. para Contato</label>
              <input type="tel" data-field="telefoneContato" placeholder="(81) 9 0000-0000" value="${v('telefoneContato')}">
            </div>
          </div>`,
        required: ['numeroPTE','dataEmissao','horaEmissao','requisitante','emitente','trabalhoExecutar','areaExecucao'],
      },
      {
        title: 'Lista de Verificação',
        desc: 'Checklist de segurança — marque cada item conforme a situação',
        render: () => `
          <div class="form-step-section">
            <div class="step-title">Lista de Verificação de Segurança</div>
            <div class="step-desc">Marque: <strong>C</strong> = Conforme, <strong>NC</strong> = Não Conforme, <strong>NA</strong> = Não Aplicável</div>
            <div class="info-box">⚠️ <strong>Atenção:</strong> A entrada em vala não pode ser permitida se qualquer item de verificação estiver marcado como <strong>NC</strong>.</div>

            ${checkSection('COLABORADOR', [
              {id:'chk1', txt:'Todos os colaboradores conhecem o POP da atividade.'},
              {id:'chk2', txt:'Os colaboradores estão utilizando os EPIs adequados e em bom estado de conservação.'},
              {id:'chk3', txt:'Todos os colaboradores receberam o treinamento admissional conforme NR-18.'},
            ])}

            ${checkSection('INSPEÇÃO E PROJETOS', [
              {id:'chk4', txt:'Foi feita a inspeção prévia da área a ser escavada e mantidos os registros.'},
              {id:'chk5', txt:'O projeto das escavações foi elaborado por profissional legalmente habilitado com ART emitida.'},
              {id:'chk6', txt:'O projeto executivo levou em conta as condições geológicas e parâmetros geotécnicos.'},
              {id:'chk7', txt:'Os desenhos dos projetos foram verificados e estão de acordo com o que será executado.'},
            ])}

            ${checkSection('ÁREA DE ESCAVAÇÃO E APR', [
              {id:'chk8',  txt:'A área da frente de trabalho está devidamente isolada e a sinalização é adequada e visível.'},
              {id:'chk9',  txt:'As orientações das concessionárias estão documentadas e sendo seguidas.'},
              {id:'chk10', txt:'As máquinas foram previamente inspecionadas e liberadas para a atividade.'},
              {id:'chk11', txt:'O material retirado foi depositado a uma distância > metade da profundidade da vala.'},
              {id:'chk12', txt:'A distância de circulação das máquinas em relação à escavação foi assegurada.'},
              {id:'chk13', txt:'A obra possui POP para serviços com escavações.'},
              {id:'chk14', txt:'Os serviços em escavações possuem Análise Preliminar de Risco (APR).'},
              {id:'chk15', txt:'A APR está assinada pelos colaboradores envolvidos.'},
            ])}

            ${checkSection('ESCORAMENTO E SAÍDA DE EMERGÊNCIA', [
              {id:'chk16', txt:'É necessário escoramento.'},
              {id:'chk17', txt:'Se necessário, o escoramento está de acordo com o projeto.'},
              {id:'chk18', txt:'Foi disponibilizada escada ou rampa para saída emergencial da cava.'},
            ])}

            ${checkSection('TALUDES', [
              {id:'chk19', txt:'Os taludes estão escavados nos ângulos adequados (< 45° solos não coesivos, < 60° coesivos rígidos).'},
              {id:'chk20', txt:'Os taludes não apresentam fraturas, fissuras e/ou erosões.'},
              {id:'chk21', txt:'Os taludes não apresentam infiltrações e/ou umidade no solo.'},
              {id:'chk22', txt:'Presença de água com sistema de drenagem instalado.'},
              {id:'chk23', txt:'Os taludes não apresentam deslocamento de solo.'},
              {id:'chk24', txt:'Os taludes não apresentam instabilidade.'},
            ])}

            ${checkSection('TERCEIRIZADA', [
              {id:'chk25', txt:'As empresas contratadas possuem registro no CREA e apresentaram ART para escavações.'},
            ])}

            ${checkSection('ARQUIVAMENTO', [
              {id:'chk26', txt:'As Permissões de Trabalho anteriores foram arquivadas de modo que permite rastreamento.'},
            ])}
          </div>`,
      },
      {
        title: 'EPIs e Colaboradores',
        desc: 'Equipamentos de proteção e lista de autorizados',
        render: () => `
          <div class="form-step-section">
            <div class="step-title">EPIs e Colaboradores</div>
            <div class="step-desc">Selecione os EPIs obrigatórios e informe os colaboradores autorizados.</div>

            <div class="checklist-section">
              <div class="checklist-title">Equipamentos de Proteção Individual (EPI)</div>
              <div class="epi-grid">
                ${epiItem('epi_auricular', 'Protetor Auricular')}
                ${epiItem('epi_capacete', 'Capacete com Jugular')}
                ${epiItem('epi_mascara', 'Máscara de Segurança')}
                ${epiItem('epi_oculos', 'Óculos de Proteção')}
                ${epiItem('epi_bota', 'Bota de Segurança')}
                ${epiItem('epi_luva', 'Luva de Segurança')}
              </div>
              <div class="form-group" style="margin-top:12px">
                <label>Outros EPIs</label>
                <input type="text" data-field="epi_outros" placeholder="Ex: Protetor facial, respirador PFF2…" value="${v('epi_outros')}">
              </div>
            </div>

            <div class="checklist-section">
              <div class="checklist-title">Colaboradores Autorizados</div>
              <div class="workers-section" id="workers-pte">${renderWorkers('workers_pte', 14)}</div>
            </div>

            <div class="form-group">
              <label>Recomendações Adicionais / Observações</label>
              <textarea data-field="recomendacoes" placeholder="Observações gerais de segurança…" rows="3">${v('recomendacoes')}</textarea>
            </div>

            <div class="checklist-section">
              <div class="checklist-title">Autorização Final</div>
              <div class="form-row">
                <div class="form-group">
                  <label>Trabalho Autorizado? <span class="required-star">*</span></label>
                  <select data-field="trabalhoAutorizado">
                    <option value="" ${!v('trabalhoAutorizado') ? 'selected':''}>Selecione…</option>
                    <option value="SIM" ${v('trabalhoAutorizado')==='SIM'?'selected':''}>SIM</option>
                    <option value="NAO" ${v('trabalhoAutorizado')==='NAO'?'selected':''}>NÃO</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Status</label>
                  <select data-field="statusPTE">
                    <option value="ABERTA" ${v('statusPTE','ABERTA')==='ABERTA'?'selected':''}>Aberta</option>
                    <option value="CANCELADA" ${v('statusPTE')==='CANCELADA'?'selected':''}>Cancelada</option>
                    <option value="FECHADA" ${v('statusPTE')==='FECHADA'?'selected':''}>Fechada</option>
                  </select>
                </div>
              </div>
            </div>
          </div>`,
        required: ['trabalhoAutorizado'],
      },
    ],
  },

  PTA: {
    steps: [
      {
        title: 'Identificação',
        desc: 'Dados gerais da permissão para trabalho em altura',
        render: () => `
          <div class="form-step-section">
            <div class="step-title">Identificação da PT-Altura</div>
            <div class="step-desc">Preencha os dados desta permissão conforme NR-18 e NR-35.</div>

            <div class="form-row">
              <div class="form-group">
                <label>Nº da PT <span class="required-star">*</span></label>
                <input type="text" data-field="numeroPTA" placeholder="Ex: PTA-2025-001" value="${v('numeroPTA')}">
              </div>
              <div class="form-group">
                <label>Empresa</label>
                <input type="text" data-field="empresa" placeholder="Viana e Moura Construções" value="${v('empresa', 'Viana e Moura Construções')}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Data de Início <span class="required-star">*</span></label>
                <input type="date" data-field="dataInicio" value="${v('dataInicio', today())}">
              </div>
              <div class="form-group">
                <label>Hora de Início</label>
                <input type="time" data-field="horaInicio" value="${v('horaInicio', nowTime())}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Data de Fim</label>
                <input type="date" data-field="dataFim" value="${v('dataFim')}">
              </div>
              <div class="form-group">
                <label>Hora de Fim</label>
                <input type="time" data-field="horaFim" value="${v('horaFim')}">
              </div>
            </div>
            <div class="form-group">
              <label>Serviço a Executar <span class="required-star">*</span></label>
              <textarea data-field="servicoExecutar" placeholder="Descreva detalhadamente o serviço…" rows="3">${v('servicoExecutar')}</textarea>
            </div>
            <div class="form-group">
              <label>Local / Setor <span class="required-star">*</span></label>
              <input type="text" data-field="localSetor" placeholder="Ex: Bloco A — 3º Pavimento" value="${v('localSetor')}">
            </div>
            <div class="form-group">
              <label>Obra / Projeto</label>
              <input type="text" data-field="obra" placeholder="Ex: Cerejeiras — Torre Norte" value="${v('obra')}">
            </div>

            <div class="checklist-section" style="margin-top:20px">
              <div class="checklist-title">Meio de Execução</div>
              <div class="epi-grid">
                ${epiItem('meio_andaime', '🏗️ Andaime')}
                ${epiItem('meio_escada', '🪜 Escada')}
                ${epiItem('meio_plataforma', '🔲 Plataforma')}
                ${epiItem('meio_outros', '➕ Outros')}
              </div>
              <div class="form-group" style="margin-top:10px">
                <label>Especificar (se Outros)</label>
                <input type="text" data-field="meioOutros" placeholder="Descreva o meio utilizado" value="${v('meioOutros')}">
              </div>
            </div>
          </div>`,
        required: ['numeroPTA','dataInicio','servicoExecutar','localSetor'],
      },
      {
        title: 'Verificações Técnicas',
        desc: 'Cheklist de conformidade — andaime, escada e APR',
        render: () => `
          <div class="form-step-section">
            <div class="step-title">Verificações Técnicas</div>
            <div class="step-desc">Responda Sim / Não / NA para cada item. Legenda: <strong>NA = Não Aplica</strong>.</div>
            <div class="info-box">⚠️ <strong>Atenção:</strong> O trabalho em altura não pode ser iniciado se qualquer campo não for preenchido ou estiver como <strong>NÃO</strong>.</div>

            ${yesNoSection('VERIFICAÇÕES GERAIS', [
              {id:'g1', txt:'Foi elaborada a APR — Análise Preliminar de Risco para esta atividade?'},
              {id:'g2', txt:'A equipe de trabalho está apta? (ASO, Treinamento NR-35, Aferição de Pressão Arterial)'},
              {id:'g3', txt:'Os EPIs estão em condições de uso?'},
              {id:'g4', txt:'Foram atendidos os pré-requisitos estabelecidos pela Análise de Risco?'},
            ])}

            ${yesNoSection('USO DE ANDAIME', [
              {id:'a1',  txt:'O andaime está conforme NR-18 e montado de acordo com o POP 02 — Montagem e Desmontagem?'},
              {id:'a2',  txt:'A torre está devidamente travada com barras nas diagonais a cada três peças?'},
              {id:'a3',  txt:'O içamento de materiais é feito através de dispositivo próprio e sem risco de queda?'},
              {id:'a4',  txt:'Tem escada para andaime acoplada?'},
              {id:'a5',  txt:'Está assentado sobre piso regular e possui sapatas?'},
              {id:'a6',  txt:'Tem guarda-corpo e rodapé instalado?'},
              {id:'a7',  txt:'Os pisos metálicos estão em boas condições de uso e bem travados?'},
              {id:'a8',  txt:'Piso nivelado, não escorregadio e que suporte o peso para o trabalho?'},
              {id:'a9',  txt:'A altura do andaime é menor que quatro vezes a menor dimensão de sua base?'},
              {id:'a10', txt:'Antes de instalar sistema de içamento, foi escolhido o ponto de aplicação adequado?'},
              {id:'a11', txt:'O andaime está devidamente estaiado em estrutura fixa e estável?'},
              {id:'a12', txt:'Foi instalado trava-quedas para subir e descer do andaime em linha independente?'},
            ])}

            ${yesNoSection('USO DE ESCADA', [
              {id:'e1', txt:'Está em boas condições de uso, sem degraus quebrados e isenta de óleo/graxa?'},
              {id:'e2', txt:'A amarração segue as orientações do POP — Trabalho em altura com escada extensível?'},
              {id:'e3', txt:'Possui sapatas antiderrapantes?'},
              {id:'e4', txt:'É mantida a distância de ¼ do comprimento total entre base e topo?'},
              {id:'e5', txt:'É de material não condutor quando usada próxima de linhas elétricas energizadas?'},
              {id:'e6', txt:'As escadas não se encontram em áreas de abertura de portas?'},
              {id:'e7', txt:'A atividade é realizada pelo executante e um acompanhante?'},
              {id:'e8', txt:'Escada extensível tem dispositivo limitador de curso e sobreposição de 1m no mínimo?'},
              {id:'e9', txt:'As escadas extensíveis respeitam o limite de 1m do piso de apoio superior?'},
            ])}

            ${yesNoSection('OUTROS SERVIÇOS', [
              {id:'o1', txt:'Possuem linhas de vida e pontos de ancoragem? Permitem acesso a todos os pontos de trabalho?'},
              {id:'o2', txt:'As linhas elétricas próximas encontram-se desenergizadas?'},
            ])}
          </div>`,
      },
      {
        title: 'EPIs e Colaboradores',
        desc: 'EPIs obrigatórios e liberação dos trabalhadores',
        render: () => `
          <div class="form-step-section">
            <div class="step-title">EPIs, EPC e Colaboradores</div>
            <div class="step-desc">Selecione os equipamentos e cadastre os trabalhadores autorizados.</div>

            <div class="checklist-section">
              <div class="checklist-title">EPI e EPC Utilizados</div>
              <div class="epi-grid">
                ${epiItem('epi_bota', 'Bota de Segurança')}
                ${epiItem('epi_travaquedas', 'Trava-quedas')}
                ${epiItem('epi_sinalizacao', 'Placas de Sinalização')}
                ${epiItem('epi_cinto', 'Cinto + Talabarte')}
                ${epiItem('epi_auricular', 'Protetor Auditivo')}
                ${epiItem('epi_linhavida', 'Linha de Vida')}
                ${epiItem('epi_luva', 'Luva de Segurança')}
                ${epiItem('epi_cone', 'Cone')}
                ${epiItem('epi_mosquetao', 'Mosquetão')}
                ${epiItem('epi_respiratorio', 'Proteção Respiratória')}
                ${epiItem('epi_capacete', 'Capacete de Segurança')}
                ${epiItem('epi_fitazebrada', 'Fita Zebrada / Cerquite')}
                ${epiItem('epi_oculos', 'Óculos de Proteção')}
              </div>
              <div class="form-group" style="margin-top:12px">
                <label>Outros EPIs</label>
                <input type="text" data-field="epi_outros_pta" placeholder="Especificar…" value="${v('epi_outros_pta')}">
              </div>
            </div>

            <div class="checklist-section">
              <div class="checklist-title">Controle de Liberação de Trabalhadores</div>
              <p style="font-size:13px;color:var(--text-lt);margin-bottom:10px">Informe nome, função e pressão arterial de cada colaborador. PA máxima: 130x80 mmHg.</p>
              <div id="workers-pta-list">${renderWorkersPA('workers_pta', 7)}</div>
              <button class="btn-add-form" style="margin-top:8px" onclick="addWorkerPA()">
                <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
                Adicionar Colaborador
              </button>
            </div>

            <div class="checklist-section">
              <div class="checklist-title">Responsáveis pela Autorização</div>
              ${renderAuthRow('auth_resp', 3)}
            </div>

            <div class="form-group">
              <label>Observações Gerais</label>
              <textarea data-field="observacoesPTA" placeholder="Observações adicionais…" rows="3">${v('observacoesPTA')}</textarea>
            </div>
          </div>`,
        required: [],
      },
    ],
  },
};

// ── HELPERS ───────────────────────────────────────────────────
const CHECKLIST_TEXTS = {};
const today = () => new Date().toISOString().split('T')[0];
const nowTime = () => new Date().toTimeString().slice(0,5);
const v = (field, def = '') => formData[field] !== undefined ? formData[field] : def;
const fmt = d => d ? new Date(d + 'T12:00').toLocaleDateString('pt-BR') : '—';
const fmtDT = () => new Date().toLocaleDateString('pt-BR', {weekday:'long',day:'2-digit',month:'long',year:'numeric'});

function checkSection(title, items) {
  items.forEach(i => CHECKLIST_TEXTS[i.id] = i.txt);
  return `<div class="checklist-section">
    <div class="checklist-title">${title}</div>
    ${items.map(i => `
      <div class="checklist-item">
        <span class="checklist-text">${i.txt}</span>
        <div class="radio-group">
          <span class="radio-opt opt-c ${formData[i.id]==='C'?'selected':''}" onclick="selectOpt(this,'${i.id}','C')">C</span>
          <span class="radio-opt opt-nc ${formData[i.id]==='NC'?'selected':''}" onclick="selectOpt(this,'${i.id}','NC')">NC</span>
          <span class="radio-opt opt-na ${formData[i.id]==='NA'?'selected':''}" onclick="selectOpt(this,'${i.id}','NA')">NA</span>
        </div>
      </div>`).join('')}
  </div>`;
}

function yesNoSection(title, items) {
  items.forEach(i => CHECKLIST_TEXTS[i.id] = i.txt);
  return `<div class="checklist-section">
    <div class="checklist-title">${title}</div>
    ${items.map(i => `
      <div class="checklist-item">
        <span class="checklist-text">${i.txt}</span>
        <div class="radio-group">
          <span class="radio-opt opt-sim ${formData[i.id]==='SIM'?'selected':''}" onclick="selectOpt(this,'${i.id}','SIM')">Sim</span>
          <span class="radio-opt opt-nao ${formData[i.id]==='NAO'?'selected':''}" onclick="selectOpt(this,'${i.id}','NAO')">Não</span>
          <span class="radio-opt opt-na ${formData[i.id]==='NA'?'selected':''}" onclick="selectOpt(this,'${i.id}','NA')">NA</span>
        </div>
      </div>`).join('')}
  </div>`;
}

function epiItem(id, label) {
  const sel = formData[id] ? 'selected' : '';
  return `<div class="epi-item ${sel}" onclick="toggleEpi(this,'${id}')">
    <div class="epi-check"></div>
    <span>${label}</span>
  </div>`;
}

function renderWorkers(field, max) {
  const workers = formData[field] || Array(4).fill('');
  return workers.map((w, i) => `
    <div class="worker-row">
      <span class="worker-num">${i + 1}.</span>
      <input type="text" placeholder="Nome do colaborador" value="${w}"
        oninput="updateWorker('${field}', ${i}, this.value)">
      ${sigBtn(`${field}_${i}`)}
    </div>`).join('') + `
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn-add-form" style="flex:1;margin:0" onclick="addWorker('${field}')">
        <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
        Adicionar
      </button>
      ${workers.length > 1 ? `<button class="btn-add-form" style="flex:1;margin:0;color:var(--danger);border-color:var(--danger)" onclick="removeWorker('${field}')">Remover último</button>` : ''}
    </div>`;
}

function renderWorkersPA(field, min) {
  const workers = formData[field] || Array(min).fill({nome:'',funcao:'',pa:'',matricula:''});
  return `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="background:var(--cream-dk)">
      <th style="padding:8px;text-align:left;border-bottom:1.5px solid var(--border)">Nome</th>
      <th style="padding:8px;text-align:left;border-bottom:1.5px solid var(--border)">Função</th>
      <th style="padding:8px;text-align:center;border-bottom:1.5px solid var(--border)">PA (mmHg)</th>
      <th style="padding:8px;text-align:left;border-bottom:1.5px solid var(--border)">Matrícula/CPF</th>
      <th style="padding:8px;text-align:center;border-bottom:1.5px solid var(--border)">Assinatura</th>
    </tr></thead>
    <tbody id="workers-pta-tbody">
    ${workers.map((w, i) => workerPARow(i, w)).join('')}
    </tbody>
  </table></div>`;
}

function sigBtn(id) {
  const signed = formData.signatures && formData.signatures[id];
  return `<button class="btn-sig ${signed?'signed':''}" onclick="openSignatureModal('${id}')">
    <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
    ${signed?'✓':'Assinar'}
  </button>`;
}

function workerPARow(i, w = {}) {
  return `<tr id="wpa-row-${i}" style="border-bottom:1px solid var(--cream-dk)">
    <td style="padding:6px"><input type="text" style="width:100%;border:none;background:none;font-size:13px;font-family:var(--font-body)" placeholder="Nome completo" value="${w.nome||''}" oninput="updateWorkerPA(${i},'nome',this.value)"></td>
    <td style="padding:6px"><input type="text" style="width:100%;border:none;background:none;font-size:13px;font-family:var(--font-body)" placeholder="Função" value="${w.funcao||''}" oninput="updateWorkerPA(${i},'funcao',this.value)"></td>
    <td style="padding:6px;text-align:center"><input type="text" style="width:80px;border:none;background:none;font-size:13px;text-align:center;font-family:var(--font-body)" placeholder="120x80" value="${w.pa||''}" oninput="updateWorkerPA(${i},'pa',this.value)"></td>
    <td style="padding:6px"><input type="text" style="width:100%;border:none;background:none;font-size:13px;font-family:var(--font-body)" placeholder="CPF ou RG" value="${w.matricula||''}" oninput="updateWorkerPA(${i},'matricula',this.value)"></td>
    <td style="padding:6px;text-align:center">${sigBtn(`workers_pta_${i}`)}</td>
  </tr>`;
}

function renderAuthRow(field, count) {
  const auths = formData[field] || Array(count).fill({nome:''});
  return `<div style="display:flex;flex-direction:column;gap:8px">
    ${auths.map((a,i) => `
      <div class="worker-row">
        <span class="worker-num">${i+1}.</span>
        <input type="text" placeholder="Nome do responsável" value="${a.nome||''}"
          oninput="updateAuth('${field}',${i},this.value)">
        ${sigBtn(`${field}_${i}`)}
      </div>`).join('')}
  </div>`;
}

// ── DOM EVENTS HELPERS ────────────────────────────────────────
function selectOpt(el, field, val) {
  const group = el.closest('.radio-group');
  group.querySelectorAll('.radio-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  formData[field] = val;
}

function toggleEpi(el, id) {
  el.classList.toggle('selected');
  formData[id] = el.classList.contains('selected');
}

function updateWorker(field, idx, val) {
  if (!formData[field]) formData[field] = [];
  formData[field][idx] = val;
}

function addWorker(field) {
  if (!formData[field]) formData[field] = [];
  formData[field].push('');
  reRenderStep();
}

function removeWorker(field) {
  if (formData[field] && formData[field].length > 1) formData[field].pop();
  reRenderStep();
}

function updateWorkerPA(idx, key, val) {
  if (!formData['workers_pta']) formData['workers_pta'] = [];
  if (!formData['workers_pta'][idx]) formData['workers_pta'][idx] = {};
  formData['workers_pta'][idx][key] = val;
}

function addWorkerPA() {
  if (!formData['workers_pta']) formData['workers_pta'] = [];
  const idx = formData['workers_pta'].length;
  formData['workers_pta'].push({});
  const tbody = document.getElementById('workers-pta-tbody');
  if (tbody) tbody.insertAdjacentHTML('beforeend', workerPARow(idx));
}

function updateAuth(field, idx, val) {
  if (!formData[field]) formData[field] = [];
  if (!formData[field][idx]) formData[field][idx] = {};
  formData[field][idx].nome = val;
}

// ── NAVIGATION ────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

function navTo(dest) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (dest === 'home') {
    refreshHome();
    showScreen('home');
    document.querySelector('.nav-btn').classList.add('active');
  } else if (dest === 'records') {
    renderRecords();
    showScreen('records');
    document.querySelectorAll('.nav-btn')[1].classList.add('active');
  } else if (dest === 'admin') {
    renderAdmin();
    showScreen('admin');
    document.querySelectorAll('.nav-btn')[2].classList.add('active');
  }
}

function goHome() { navTo('home'); }

// ── LOGIN ─────────────────────────────────────────────────────
function doLogin() {
  const userInput = document.getElementById('login-user').value.trim().toLowerCase();
  const passInput = document.getElementById('login-pass').value;
  
  if (!userInput || !passInput) { toast('Preencha usuário e senha.'); return; }
  
  const userMatch = VALID_USERS[userInput];
  
  if (userMatch && userMatch.pass === passInput) {
    currentUser = { 
      name: userMatch.name, 
      role: userMatch.role,
      initials: userMatch.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) 
    };
    DB.set('currentUser', currentUser);
    
    document.getElementById('user-name').textContent = currentUser.name;
    document.getElementById('user-initials').textContent = currentUser.initials;
    if (document.getElementById('user-role')) {
      document.getElementById('user-role').textContent = '(' + currentUser.role + ')';
    }
    
    refreshHome();
    showScreen('home');
  } else {
    toast('Usuário ou senha incorretos.');
  }
}

function togglePass() {
  const inp = document.getElementById('login-pass');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function showProfile() {
  if (confirm('Olá, ' + currentUser.name + '! Deseja sair do sistema?')) {
    DB.set('currentUser', null);
    currentUser = null;
    document.getElementById('login-pass').value = '';
    showScreen('login');
  }
}

// ── HOME ──────────────────────────────────────────────────────
function refreshHome() {
  document.getElementById('today-date').textContent = fmtDT();
  renderPermitGrid();
  renderRecentList();
  updateStats();
}

function renderPermitGrid() {
  const grid = document.getElementById('permit-grid');
  const formTypes = DB.get('formTypes', FORM_TYPES);
  const records = DB.get('records', []);
  grid.innerHTML = formTypes.map(ft => {
    const count = records.filter(r => r.formId === ft.id).length;
    return `<div class="permit-card" onclick="openForm('${ft.id}')">
      <div class="permit-icon" style="background:${ft.bg}">${ft.icon}</div>
      <div class="permit-name">${ft.name}</div>
      <div class="permit-code">${ft.code}</div>
      ${count > 0 ? `<div class="permit-count-badge">${count}</div>` : ''}
    </div>`;
  }).join('');
}

function renderRecentList() {
  const container = document.getElementById('recent-list');
  const records = DB.get('records', []).slice(-5).reverse();
  const formTypes = DB.get('formTypes', FORM_TYPES);
  if (!records.length) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 60 60" fill="none"><circle cx="30" cy="30" r="28" stroke="#C9A96E" stroke-width="2" stroke-dasharray="4 4"/><path d="M20 30h20M30 20v20" stroke="#C9A96E" stroke-width="2" stroke-linecap="round"/></svg>
      <p>Nenhuma liberação registrada ainda.</p>
      <span>Selecione um tipo de permissão acima para começar.</span>
    </div>`;
    return;
  }
  container.innerHTML = records.map(r => {
    const ft = formTypes.find(f => f.id === r.formId) || { icon:'📄', bg:'#F5F5F5', name: r.formId };
    const statusClass = r.status === 'LIBERADO' ? 'status-ok' : r.status === 'CANCELADO' ? 'status-canc' : 'status-pend';
    return `<div class="record-card" onclick="viewRecord('${r.id}')">
      <div class="record-icon-wrap" style="background:${ft.bg}">${ft.icon}</div>
      <div class="record-info">
        <div class="record-title">${r.numero || r.id}</div>
        <div class="record-meta">
          <span>${ft.name}</span>
          <span>•</span>
          <span>${r.obra || 'Sem obra'}</span>
          <span>•</span>
          <span>${fmt(r.data)}</span>
        </div>
      </div>
      <span class="record-status ${statusClass}">${r.status}</span>
    </div>`;
  }).join('');
}

function updateStats() {
  const records = DB.get('records', []);
  const today_str = today();
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  document.getElementById('stat-today').textContent = records.filter(r => r.data === today_str).length;
  document.getElementById('stat-week').textContent  = records.filter(r => new Date(r.data) >= weekAgo).length;
  document.getElementById('stat-total').textContent = records.length;
}

// ── FORM FLOW ─────────────────────────────────────────────────
function openForm(formId) {
  currentForm = formId;
  currentStep = 0;
  formData = {};
  // pre-fill obra if last record had one
  const last = DB.get('records', []).slice(-1)[0];
  if (last && last.obra) formData.obra = last.obra;
  const ft = DB.get('formTypes', FORM_TYPES).find(f => f.id === formId);
  document.getElementById('form-header-title').textContent = ft.name;
  renderStep();
  showScreen('form');
}

function renderStep() {
  const steps = FORMS[currentForm].steps;
  const step  = steps[currentStep];
  const total = steps.length;

  document.getElementById('step-badge').textContent = `${currentStep+1}/${total + 1}`;
  document.getElementById('progress-bar').style.width = `${((currentStep + 1) / (total + 1)) * 100}%`;
  document.getElementById('form-header-sub').textContent = step.desc;

  document.getElementById('form-main').innerHTML = step.render();
  document.getElementById('btn-prev').style.display = currentStep > 0 ? 'flex' : 'none';
  const btnNext = document.getElementById('btn-next');
  btnNext.innerHTML = currentStep === total - 1
    ? 'Revisar <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"/></svg>'
    : 'Próximo <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"/></svg>';
}

function reRenderStep() {
  collectFields();
  renderStep();
}

function collectFields() {
  document.querySelectorAll('#form-main [data-field]').forEach(el => {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
      formData[el.dataset.field] = el.value;
    }
  });
}

function validateStep() {
  collectFields();
  const step = FORMS[currentForm].steps[currentStep];
  if (!step.required) return true;
  const missing = step.required.filter(f => !formData[f] || formData[f].toString().trim() === '');
  if (missing.length) { toast('Preencha os campos obrigatórios (*)'); return false; }
  return true;
}

function nextStep() {
  if (!validateStep()) return;
  collectFields();
  const total = FORMS[currentForm].steps.length;
  if (currentStep < total - 1) {
    currentStep++;
    renderStep();
    document.getElementById('form-main').scrollTop = 0;
  } else {
    showReview();
  }
}

function prevStep() {
  collectFields();
  if (currentStep > 0) { currentStep--; renderStep(); }
}

function backFromForm() {
  collectFields();
  navTo('home');
}

function backToForm() { showScreen('form'); }

// ── REVIEW ────────────────────────────────────────────────────
function generateReviewHTML() {
  const ft = DB.get('formTypes', FORM_TYPES).find(f => f.id === currentForm);
  const ncItems = Object.entries(formData).filter(([k,v]) => v === 'NC' || v === 'NAO').map(([k]) => k);

  let html = '';

  if (ncItems.length) {
    html += `<div class="review-warnings">
      <div class="review-warn-title">⚠️ Itens Não Conformes / Não (${ncItems.length})</div>
      ${ncItems.map(k => `<div class="review-warn-item">• ${CHECKLIST_TEXTS[k] || k}</div>`).join('')}
    </div>`;
  }

  html += `<div class="review-section">
    <div class="review-section-title">Identificação</div>`;
  const mainFields = {
    numeroPTE:'Nº PTE', numeroPTA:'Nº PT-Altura',
    dataEmissao:'Data Emissão', dataInicio:'Data Início',
    horaEmissao:'Hora', horaInicio:'Hora Início',
    requisitante:'Requisitante', emitente:'Emitente',
    empresa:'Empresa', trabalhoExecutar:'Serviço', servicoExecutar:'Serviço',
    areaExecucao:'Área', localSetor:'Local/Setor', obra:'Obra',
    trabalhoAutorizado:'Trabalho Autorizado', statusPTE:'Status',
  };
  Object.entries(mainFields).forEach(([k,lbl]) => {
    if (formData[k]) {
      html += `<div class="review-row">
        <span class="review-label">${lbl}</span>
        <span class="review-value">${formData[k]}</span>
      </div>`;
    }
  });
  html += '</div>';

  // Checklist summary
  const checkKeys = Object.entries(formData).filter(([k]) => /^(chk|g|a|e|o)\d+$/.test(k));
  if (checkKeys.length) {
    const cItems  = checkKeys.filter(([,v]) => v === 'C'   || v === 'SIM');
    const ncItemsList = checkKeys.filter(([,v]) => v === 'NC'  || v === 'NAO');
    const naItems = checkKeys.filter(([,v]) => v === 'NA');

    const buildAcc = (title, items, color, symbol, id) => {
      const cnt = items.length;
      if (cnt === 0) return `<div class="review-row"><span class="review-label">${title}</span><span class="review-value" style="color:${color};font-weight:700">${symbol} 0</span></div>`;
      return `<div class="review-row" onclick="toggleAcc('${id}')" style="cursor:pointer; border-radius:4px; padding:4px 8px; margin:0 -8px; transition:background 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.03)'" onmouseout="this.style.background='transparent'">
        <span class="review-label" style="display:flex;align-items:center;gap:6px;">
          ${title}
          <svg id="icn-${id}" viewBox="0 0 20 20" fill="currentColor" style="width:16px;height:16px;transition:0.2s"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
        </span>
        <span class="review-value" style="color:${color};font-weight:700">${symbol} ${cnt}</span>
      </div>
      <div id="${id}" style="display:none; padding:8px 12px; margin-bottom:8px; background:rgba(0,0,0,0.03); border-left:3px solid ${color}; border-radius:0 4px 4px 0; font-size:13px; color:var(--text-md);">
        ${items.map(([k]) => `<div style="padding:4px 0; line-height:1.4;">• ${CHECKLIST_TEXTS[k] || k}</div>`).join('')}
      </div>`;
    };

    html += `<div class="review-section">
      <div class="review-section-title">Resumo da Lista de Verificação</div>
      ${buildAcc('Conformes', cItems, '#2E7D32', '✓', 'acc-c')}
      ${buildAcc('Não Conformes', ncItemsList, '#C62828', '✗', 'acc-nc')}
      ${buildAcc('Não Aplicáveis', naItems, '#757575', '—', 'acc-na')}
      <div class="review-row" style="margin-top:8px; border-top:1px dashed #E0D5C1; padding-top:8px;"><span class="review-label">Total Verificado</span><span class="review-value" style="font-weight:700">${checkKeys.length}</span></div>
    </div>`;
  }

  // EPIs
  const epis = Object.entries(formData).filter(([k,val]) => k.startsWith('epi_') && val === true).map(([k]) => k.replace('epi_',''));
  if (epis.length) {
    html += `<div class="review-section">
      <div class="review-section-title">EPIs Selecionados</div>
      <div class="review-row"><span class="review-label">Equipamentos</span><span class="review-value">${epis.join(', ')}</span></div>
    </div>`;
  }

  // Workers PTE
  const wPte = formData['workers_pte']?.filter(w => w);
  if (wPte && wPte.length) {
    html += `<div class="review-section">
      <div class="review-section-title">Colaboradores Autorizados</div>
      ${wPte.map((w,i) => `
      <div class="review-row">
        <span class="review-label">${i+1}. ${w}</span>
        <span class="review-value">${renderReviewSig(`workers_pte_${i}`)}</span>
      </div>`).join('')}
    </div>`;
  }

  // Workers PTA
  const wPta = formData['workers_pta']?.filter(w => w && w.nome);
  if (wPta && wPta.length) {
    html += `<div class="review-section">
      <div class="review-section-title">Controle de Trabalhadores em Altura</div>
      ${wPta.map((w,i) => `
      <div class="review-row">
        <span class="review-label">${w.nome} (${w.funcao||''})</span>
        <span class="review-value">${renderReviewSig(`workers_pta_${i}`)}</span>
      </div>`).join('')}
    </div>`;
  }

  if (formData['recomendacoes'] || formData['observacoesPTA']) {
    html += `<div class="review-section">
      <div class="review-section-title">Observações</div>
      <p style="font-size:13px;color:var(--text-md);line-height:1.5">${formData['recomendacoes'] || formData['observacoesPTA']}</p>
    </div>`;
  }

  // Avisos e Recomendações Permanentes (Visualização)
  if (currentForm === 'PTE') {
    html += `<div class="review-section" style="background:#fffaf0; border:1px solid #ffeebc; padding:12px; margin-top:16px;">
      <div class="review-section-title" style="color:#856404; margin-bottom:8px;">Recomendações Permanentes</div>
      <ul style="font-size:12px; color:#856404; padding-left:16px; line-height:1.4;">
        <li>Uso do EPI específico;</li>
        <li>Não fumar;</li>
        <li>Manter a área limpa e prevenida contra poluição ambiental;</li>
        <li>Paralisar e comunicar ao emitente em caso de situações de risco;</li>
        <li>Paralisar o serviço em situações de emergência;</li>
        <li>A PTE perde a validade se as recomendações não forem atendidas;</li>
        <li>A entrada na vala não é permitida se houver item Não Conforme.</li>
      </ul>
    </div>`;
  } else if (currentForm === 'PTA') {
    html += `<div class="review-section" style="background:#f0f7ff; border:1px solid #cfe2ff; padding:12px; margin-top:16px;">
      <div class="review-section-title" style="color:#084298; margin-bottom:8px;">Avisos Importantes (NR-35)</div>
      <ul style="font-size:12px; color:#084298; padding-left:16px; line-height:1.4;">
        <li>A PT-Altura só é válida para o local descrito no cabeçalho;</li>
        <li>Deve ficar exposta no local de trabalho até o término;</li>
        <li>Analisar atentamente o local antes de iniciar;</li>
        <li>Nunca andar sobre materiais frágeis (telhas, ripas, etc);</li>
        <li>Proibido arremessar qualquer tipo de material;</li>
        <li>Proibido trabalhar sob chuva ou ventos fortes;</li>
        <li>O colaborador NÃO é autorizado se a PA for superior a 130x80 mmHg.</li>
      </ul>
    </div>`;
  }

  return html;
}

function showReview() {
  collectFields();
  document.getElementById('step-badge').textContent = '✓';
  document.getElementById('progress-bar').style.width = '100%';

  document.querySelector('#screen-review .header-title').textContent = 'Revisão';
  document.querySelector('#screen-review .header-sub').textContent = 'Confirme os dados antes de salvar';
  document.querySelector('#screen-review .back-btn').setAttribute('onclick', "backToForm()");
  
  document.querySelector('#screen-review .review-footer').innerHTML = `
    <button class="btn-secondary" onclick="backToForm()">Editar</button>
    <button class="btn-success" onclick="savePermit()">
      <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
      Salvar e Liberar
    </button>
  `;

  document.getElementById('review-main').innerHTML = generateReviewHTML();
  showScreen('review');
}

function viewPermitDetails() {
  if (!lastSavedPermit) return;
  currentForm = lastSavedPermit.formId;
  formData = lastSavedPermit.dados || {};

  document.getElementById('step-badge').textContent = '👁️';
  document.getElementById('progress-bar').style.width = '100%';

  document.querySelector('#screen-review .header-title').textContent = 'Visualização';
  document.querySelector('#screen-review .header-sub').textContent = 'Detalhes da liberação';
  document.querySelector('#screen-review .back-btn').setAttribute('onclick', "showScreen('success')");
  
  document.querySelector('#screen-review .review-footer').innerHTML = `
    <button class="btn-outline" onclick="exportPermit()">
      <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"/></svg>
      Exportar PDF
    </button>
    <button class="btn-primary" onclick="showScreen('success')">Voltar</button>
  `;

  document.getElementById('review-main').innerHTML = generateReviewHTML();
  showScreen('review');
}

// ── SAVE ──────────────────────────────────────────────────────
function savePermit() {
  const records = DB.get('records', []);
  const ft = DB.get('formTypes', FORM_TYPES).find(f => f.id === currentForm);
  const numero = formData['numeroPTE'] || formData['numeroPTA'] || (ft.code + '-' + String(records.length + 1).padStart(3,'0'));
  const id = 'VMC-' + Date.now();
  const record = {
    id, formId: currentForm, numero,
    status: 'LIBERADO',
    data: today(),
    obra: formData.obra || formData.localSetor || '',
    criado: new Date().toISOString(),
    dados: { ...formData },
    usuario: currentUser?.name || 'Sistema',
  };
  records.push(record);
  DB.set('records', records);
  lastSavedPermit = record;
  currentPermitId = id;

  document.getElementById('success-permit-id').textContent = numero;
  document.getElementById('success-desc').textContent = `${ft.name} registrada com sucesso em ${new Date().toLocaleString('pt-BR')}.`;
  showScreen('success');
}

// ── EXPORT ────────────────────────────────────────────────────
function exportPermit() {
  if (!lastSavedPermit) { toast('Nenhuma permissão para exportar.'); return; }
  const fid = lastSavedPermit.formId;
  if (!['PTE','PTA'].includes(fid)) {
    toast('Exportação PDF disponível para PTE e PT-Altura.'); return;
  }
  try {
    toast('Gerando PDF…');
    setTimeout(() => {
      VMC_PDF.generate(lastSavedPermit);
      toast('PDF exportado com sucesso!');
    }, 300);
  } catch(e) {
    console.error(e);
    toast('Erro ao gerar PDF. Verifique o console.');
  }
}

// ── RECORDS SCREEN ────────────────────────────────────────────
function renderRecords(filter = '') {
  const records = DB.get('records', []).reverse();
  const formTypes = DB.get('formTypes', FORM_TYPES);
  const container = document.getElementById('records-list');
  const filtered = filter
    ? records.filter(r => JSON.stringify(r).toLowerCase().includes(filter.toLowerCase()))
    : records;

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state"><p>${filter ? 'Nenhum resultado.' : 'Nenhuma liberação ainda.'}</p></div>`;
    return;
  }
  container.innerHTML = filtered.map(r => {
    const ft = formTypes.find(f => f.id === r.formId) || { icon:'📄', bg:'#F5F5F5', name: r.formId };
    const statusClass = r.status === 'LIBERADO' ? 'status-ok' : r.status === 'CANCELADO' ? 'status-canc' : 'status-pend';
    return `<div class="record-card" style="margin-bottom:10px" onclick="viewRecord('${r.id}')">
      <div class="record-icon-wrap" style="background:${ft.bg}">${ft.icon}</div>
      <div class="record-info">
        <div class="record-title">${r.numero || r.id}</div>
        <div class="record-meta">
          <span>${ft.name}</span>
          <span>•</span>
          <span>${r.obra || 'Sem obra'}</span>
          <span>•</span>
          <span>${fmt(r.data)}</span>
        </div>
        <div style="font-size:12px;color:var(--text-lt);margin-top:2px">Por: ${r.usuario}</div>
      </div>
      <span class="record-status ${statusClass}">${r.status}</span>
    </div>`;
  }).join('');
}

function filterRecords() {
  renderRecords(document.getElementById('search-input').value);
}

function viewRecord(id) {
  const r = DB.get('records', []).find(rec => rec.id === id);
  if (!r) return;
  lastSavedPermit = r;
  formData = r.dados || {};
  currentPermitId = id;
  const ft = DB.get('formTypes', FORM_TYPES).find(f => f.id === r.formId);
  document.getElementById('success-permit-id').textContent = r.numero;
  document.getElementById('success-desc').textContent = `${ft?.name} — ${fmt(r.data)} — ${r.obra || ''}`;
  showScreen('success');
}

// ── ADMIN ─────────────────────────────────────────────────────
function renderAdmin() {
  const formTypes = DB.get('formTypes', FORM_TYPES);
  document.getElementById('admin-list').innerHTML = formTypes.map((ft, i) => `
    <div class="admin-item" onclick="previewFormTemplate('${ft.id}')" style="cursor:pointer" title="Clique para visualizar modelo">
      <div class="admin-item-icon">${ft.icon}</div>
      <div class="admin-item-info">
        <div class="admin-item-name">${ft.name}</div>
        <div class="admin-item-meta">${ft.code} • ${ft.desc}</div>
      </div>
    </div>`).join('');
}

function showAddForm() {
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

function previewFormTemplate(formId) {
  const form = FORMS[formId];
  if (!form) {
    toast('Modelo não disponível para este formulário.');
    return;
  }

  const ft = DB.get('formTypes', FORM_TYPES).find(f => f.id === formId);
  document.getElementById('preview-header-sub').textContent = ft.name + ' (' + ft.code + ')';
  
  // Salva estado atual para não perder preenchimento se houver
  const tempFormData = {...formData};
  const tempCurrentForm = currentForm;
  
  // Limpa temporariamente para renderizar modelo limpo
  formData = {};
  currentForm = formId;
  
  let html = `<div class="review-section">
    <div class="review-section-title" style="color:var(--red)">Estrutura do Formulário</div>
    <p style="font-size:13px; color:var(--text-lt); margin-bottom:12px;">Abaixo você confere todas as perguntas e seções que compõem este formulário.</p>
  </div>`;

  form.steps.forEach(step => {
    html += `<div class="review-section" style="border-top:1px solid var(--border); padding-top:16px; margin-top:16px;">
      <div class="review-section-title">${step.title}</div>
      <div style="opacity:0.8; pointer-events:none;">${step.render()}</div>
    </div>`;
  });

  document.getElementById('preview-main').innerHTML = html;
  showScreen('preview');
  
  // Restaura estado
  formData = tempFormData;
  currentForm = tempCurrentForm;
}

function showInfoModal() {
  document.getElementById('modal-info-overlay').classList.add('open');
}

function closeInfoModal() {
  document.getElementById('modal-info-overlay').classList.remove('open');
}

function addFormType() {
  const name = document.getElementById('new-form-name').value.trim();
  const code = document.getElementById('new-form-code').value.trim();
  const desc = document.getElementById('new-form-desc').value.trim();
  if (!name || !code) { toast('Nome e código são obrigatórios.'); return; }
  const formTypes = DB.get('formTypes', FORM_TYPES);
  const icons = ['📋','🔧','⚡','🔥','💧','🛡️','🪖','🦺'];
  formTypes.push({ id: code, name, code, desc, icon: icons[formTypes.length % icons.length], color:'#555', bg:'#F5F5F5' });
  DB.set('formTypes', formTypes);
  closeModal();
  renderAdmin();
  toast('Formulário adicionado com sucesso!');
}

function deleteFormType(idx) {
  const formTypes = DB.get('formTypes', FORM_TYPES);
  if (!confirm(`Remover "${formTypes[idx].name}"?`)) return;
  formTypes.splice(idx, 1);
  DB.set('formTypes', formTypes);
  renderAdmin();
  toast('Removido.');
}

function renderReviewSig(id) {
  const sig = formData.signatures && formData.signatures[id];
  if (!sig) return '<span style="color:var(--danger);font-size:10px">Sem ass.</span>';
  return `<img src="${sig}" style="max-height:24px; vertical-align:middle; mix-blend-mode:multiply">`;
}

// ── SIGNATURE PAD ─────────────────────────────────────────────
function openSignatureModal(targetId) {
  currentSigningTarget = targetId;
  document.getElementById('modal-signature-overlay').classList.add('open');
  const canvas = document.getElementById('signature-canvas');
  
  if (!signaturePad) {
    signaturePad = new SignaturePad(canvas, {
      backgroundColor: 'rgba(255, 255, 255, 0)',
      penColor: 'rgb(20, 20, 20)'
    });
  }
  
  // Resize canvas
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  canvas.width = canvas.offsetWidth * ratio;
  canvas.height = canvas.offsetHeight * ratio;
  canvas.getContext("2d").scale(ratio, ratio);
  signaturePad.clear();
}

function closeSignatureModal() {
  document.getElementById('modal-signature-overlay').classList.remove('open');
}

function clearSignature() {
  if (signaturePad) signaturePad.clear();
}

function saveSignature() {
  if (signaturePad.isEmpty()) { toast('Por favor, assine antes de confirmar.'); return; }
  
  const data = signaturePad.toDataURL('image/png');
  if (!formData.signatures) formData.signatures = {};
  formData.signatures[currentSigningTarget] = data;
  
  closeSignatureModal();
  reRenderStep();
  toast('Assinatura salva com sucesso!');
}

// ── TOAST ─────────────────────────────────────────────────────
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── ACCORDION ─────────────────────────────────────────────────
function toggleAcc(id) {
  const el = document.getElementById(id);
  const icon = document.getElementById('icn-' + id);
  if (el.style.display === 'none') {
    el.style.display = 'block';
    icon.style.transform = 'rotate(180deg)';
  } else {
    el.style.display = 'none';
    icon.style.transform = 'rotate(0deg)';
  }
}

// ── INIT ──────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Preload checklist texts
  try { Object.values(FORMS).forEach(f => f.steps.forEach(s => { if(s.render) s.render(); })); } catch(e) {}

  // Restore session
  const stored = DB.get('currentUser');
  if (stored) {
    currentUser = stored;
    document.getElementById('user-name').textContent = currentUser.name;
    document.getElementById('user-initials').textContent = currentUser.initials;
    if (document.getElementById('user-role')) {
      document.getElementById('user-role').textContent = '(' + (currentUser.role || '') + ')';
    }
    refreshHome();
    showScreen('home');
  } else {
    showScreen('login');
  }

  // Save formTypes if not saved yet
  if (!DB.get('formTypes')) DB.set('formTypes', FORM_TYPES);
});

// PWA install event
let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => { deferredPrompt = e; });
