/* ============================================================
   VMC Safety — PDF Export (jsPDF)
   Replica fielmente o layout dos formulários Excel.
   Página 1 = FRENTE, Página 2 = VERSO.
   ============================================================ */

const VMC_PDF = (() => {

  // ── Paleta ────────────────────────────────────────────────
  const RED   = [184, 41, 47];
  const WHITE = [255, 255, 255];
  const BLACK = [0, 0, 0];
  const LGRAY = [242, 242, 242];
  const MGRAY = [217, 217, 217];
  const DGRAY = [26, 26, 26];
  const GREEN_OK  = [165, 214, 167];
  const RED_NC    = [239, 154, 154];
  const BLUE      = [21, 101, 192];
  const GOLD      = [201, 169, 110];
  const YELLOW    = [255, 192, 0];

  const W = 210, H = 297; // A4 mm
  const ML = 7, MR = 7, MT = 7;
  const PW = W - ML - MR;

  // ── Helpers ───────────────────────────────────────────────
  function setFill(doc, rgb) { doc.setFillColor(...rgb); }
  function setDraw(doc, rgb) { doc.setDrawColor(...rgb); }
  function setTxt(doc, rgb)  { doc.setTextColor(...rgb); }
  function setFont(doc, sz, bold=false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(sz);
  }

  function filledRect(doc, x, y, w, h, fill, stroke=true, lw=0.3) {
    doc.setLineWidth(lw);
    if (fill) { setFill(doc, fill); } else { doc.setFillColor(255,255,255); }
    if (stroke) { setDraw(doc, BLACK); } else { setDraw(doc, fill||WHITE); }
    doc.rect(x, y, w, h, fill ? (stroke ? 'FD' : 'F') : 'S');
  }

  function txt(doc, x, y, s, sz=8, bold=false, color=BLACK, align='left') {
    setFont(doc, sz, bold);
    setTxt(doc, color);
    doc.text(String(s||''), x, y, {align});
  }

  function mtext(doc, x, y, maxW, maxH, s, sz=7.5, bold=false, color=BLACK, align='left', valign='top') {
    if (!s) return;
    setFont(doc, sz, bold);
    setTxt(doc, color);
    const lines = doc.splitTextToSize(String(s), maxW - 2);
    const lh = sz * 0.4;
    const totalH = lines.length * lh;
    let startY = y + lh;
    if (valign === 'middle') startY = y + (maxH - totalH) / 2 + lh;
    else if (valign === 'bottom') startY = y + maxH - totalH + lh;
    lines.forEach((line, i) => {
      if (startY + i * lh > y + maxH) return;
      const tx = align === 'center' ? x + maxW/2 : align === 'right' ? x + maxW - 1 : x + 1;
      doc.text(line, tx, startY + i * lh, {align});
    });
  }

  function checkbox(doc, x, y, size=3.5, checked=false) {
    setDraw(doc, BLACK); doc.setLineWidth(0.3);
    doc.rect(x, y, size, size, 'S');
    if (checked) {
      setFont(doc, size * 2.2, true); setTxt(doc, RED);
      doc.text('X', x + size/2, y + size - 0.5, {align:'center'});
    }
  }

  function optionTag(doc, x, y, label, selected, color_yes=GREEN_OK, color_no=WHITE, w=null, h=4) {
    const sw = w || (doc.getStringUnitWidth(label) * 7 / doc.internal.scaleFactor + 4);
    const bg = selected ? color_yes : WHITE;
    const tc = selected && color_yes === RED_NC ? WHITE : BLACK;
    setDraw(doc, selected ? (color_yes === RED_NC ? [200,0,0] : [46,125,50]) : MGRAY);
    doc.setLineWidth(0.25);
    filledRect(doc, x, y, sw, h, bg, true, 0.25);
    setFont(doc, 6.5, selected); setTxt(doc, tc);
    doc.text(label, x + sw/2, y + h - 1.2, {align:'center'});
    return sw;
  }

  function sectionHeader(doc, x, y, w, h, label, color=DGRAY) {
    filledRect(doc, x, y, w, h, color, false);
    setFont(doc, 7.5, true); setTxt(doc, WHITE);
    doc.text(label, x + w/2, y + h - 1.2, {align:'center'});
  }

  function drawSig(doc, x, y, w, h, sigData) {
    if (!sigData) return;
    try {
      doc.addImage(sigData, 'PNG', x, y, w, h, undefined, 'FAST');
    } catch (e) {
      console.error('Erro ao adicionar assinatura ao PDF', e);
    }
  }

  // ── CHECK ITEMS PTE ───────────────────────────────────────
  const CHK_PTE = [
    {id:'chk1',  sec:'COLABORADOR', txt:'1. Todos os colaboradores conhecem o POP da atividade.'},
    {id:'chk2',  sec:'COLABORADOR', txt:'2. Os colaboradores estão utilizando os EPIs adequados e em bom estado de conservação.'},
    {id:'chk3',  sec:'COLABORADOR', txt:'3. Todos os colaboradores receberam o treinamento admissional conforme NR-18.'},
    {id:'chk4',  sec:'INSPECAO',    txt:'4. Foi feita a inspeção prévia da área a ser escavada e mantidos os registros.'},
    {id:'chk5',  sec:'INSPECAO',    txt:'5. O projeto das escavações foi elaborado por profissional legalmente habilitado com ART emitida.'},
    {id:'chk6',  sec:'INSPECAO',    txt:'6. O projeto executivo levou em conta as condições geológicas e parâmetros geotécnicos.'},
    {id:'chk7',  sec:'INSPECAO',    txt:'7. Os desenhos dos projetos foram verificados e estão de acordo com o executado.'},
    {id:'chk8',  sec:'AREA',        txt:'8. A área de trabalho está isolada e a sinalização de segurança é adequada e visível.'},
    {id:'chk9',  sec:'AREA',        txt:'9. As orientações recomendadas pelas concessionárias estão documentadas e sendo seguidas.'},
    {id:'chk10', sec:'AREA',        txt:'10. As máquinas foram previamente inspecionadas e liberadas para a atividade.'},
    {id:'chk11', sec:'AREA',        txt:'11. O material retirado foi depositado a distância > metade da profundidade da vala.'},
    {id:'chk12', sec:'AREA',        txt:'12. A distância de circulação das máquinas em relação à escavação foi assegurada.'},
    {id:'chk13', sec:'AREA',        txt:'13. A obra possui POP de trabalho para serviços com escavações.'},
    {id:'chk14', sec:'AREA',        txt:'14. Os serviços em escavações possuem Análise Preliminar de Risco (APR).'},
    {id:'chk15', sec:'AREA',        txt:'15. A APR está assinada pelos colaboradores envolvidos na atividade de escavação.'},
    {id:'chk16', sec:'ESCORAMENTO', txt:'16. É necessário escoramento.'},
    {id:'chk17', sec:'ESCORAMENTO', txt:'17. Se necessário, o escoramento está de acordo com o projeto.'},
    {id:'chk18', sec:'ESCORAMENTO', txt:'18. Foi disponibilizado escada ou rampa para saída emergencial da cava.'},
    {id:'chk19', sec:'TALUDES',     txt:'19. Os taludes estão escavados nos ângulos adequados (< 45° solos não coesivos, < 60° coesivos rígidos).'},
    {id:'chk20', sec:'TALUDES',     txt:'20. Os taludes não apresentam fraturas, fissuras e/ou erosões.'},
    {id:'chk21', sec:'TALUDES',     txt:'21. Os taludes não apresentam infiltrações e/ou umidade no solo.'},
    {id:'chk22', sec:'TALUDES',     txt:'22. Presença de água com sistema de drenagem instalado.'},
    {id:'chk23', sec:'TALUDES',     txt:'23. Os taludes não apresentam deslocamento de solo.'},
    {id:'chk24', sec:'TALUDES',     txt:'24. Os taludes não apresentam instabilidade.'},
    {id:'chk25', sec:'TERCEIRIZADA',txt:'25. As empresas contratadas possuem registro no CREA e ART para escavações.'},
    {id:'chk26', sec:'ARQUIVAMENTO',txt:'26. As PTE anteriores foram arquivadas de modo que permita o seu rastreamento.'},
  ];

  const SEC_LABELS = {
    COLABORADOR:'COLABORADOR', INSPECAO:'INSPEÇÃO E PROJETOS',
    AREA:'ÁREA DE ESCAVAÇÃO E ANÁLISE PRELIMINAR DE RISCOS (APR.)',
    ESCORAMENTO:'ESCORAMENTO E SAÍDA DE EMERGÊNCIA', TALUDES:'TALUDES',
    TERCEIRIZADA:'TERCEIRIZADA', ARQUIVAMENTO:'ARQUIVAMENTO',
  };

  const EPIS_PTE = [
    {id:'epi_auricular',txt:'Protetor Auricular'},{id:'epi_capacete',txt:'Capacete c/ jugular'},
    {id:'epi_mascara',  txt:'Máscara de seg.'  },{id:'epi_bota',    txt:'Bota de segurança'},
    {id:'epi_oculos',   txt:'Óculos de proteção'},{id:'epi_luva',   txt:'Luva de segurança'},
  ];

  // ── CHECK ITEMS PTA ───────────────────────────────────────
  const CHK_ANDAIME = [
    {id:'a1', txt:'O andaime está conforme NR-18 e montado de acordo com o POP 02?'},
    {id:'a2', txt:'A torre está devidamente travada com barras nas diagonais a cada três peças?'},
    {id:'a3', txt:'O içamento de materiais é feito através de dispositivo próprio e sem risco de queda?'},
    {id:'a4', txt:'Tem escada para andaime acoplada?'},
    {id:'a5', txt:'Está assentado sobre piso regular e possui sapatas?'},
    {id:'a6', txt:'Tem guarda-corpo e rodapé instalado?'},
    {id:'a7', txt:'Os pisos metálicos estão em boas condições de uso e bem travados?'},
    {id:'a8', txt:'Piso nivelado, não escorregadio e que suporte o peso para o trabalho?'},
    {id:'a9', txt:'A altura do andaime é menor que quatro vezes a menor dimensão de sua base?'},
    {id:'a10',txt:'Antes de instalar sistema de içamento, foi escolhido o ponto de aplicação adequado?'},
    {id:'a11',txt:'O andaime está devidamente estaiado em uma estrutura fixa e estável?'},
    {id:'a12',txt:'Foi instalado trava-quedas em linha independente para subir e descer do andaime?'},
  ];
  const CHK_ESCADA = [
    {id:'e1', txt:'Está em boas condições, sem degraus quebrados e isenta de óleo/graxa?'},
    {id:'e2', txt:'A amarração segue as orientações do POP — Trabalho em altura com escada extensível?'},
    {id:'e3', txt:'Possui sapatas antiderrapantes?'},
    {id:'e4', txt:'É mantida a distância de 1/4 do comprimento total entre base e topo?'},
    {id:'e5', txt:'É de material não condutor quando usada próxima de linhas elétricas energizadas?'},
    {id:'e6', txt:'As escadas não se encontram em áreas de abertura de portas?'},
    {id:'e7', txt:'A atividade é realizada pelo executante e um acompanhante?'},
    {id:'e8', txt:'Escada extensível tem dispositivo limitador de curso e sobreposição de 1m no mínimo?'},
    {id:'e9', txt:'As escadas extensíveis respeitam o limite de 1m do piso de apoio superior?'},
  ];
  const CHK_OUTROS_PTA = [
    {id:'o1', txt:'Possuem linhas de vida e pontos de ancoragem? Permitem acesso a todos os pontos?'},
    {id:'o2', txt:'As linhas elétricas próximas encontram-se desenergizadas?'},
  ];

  const EPIS_PTA = [
    {id:'epi_bota',       txt:'Bota de Segurança'},
    {id:'epi_travaquedas',txt:'Trava-quedas'},
    {id:'epi_sinalizacao',txt:'Placas de Sinalização'},
    {id:'epi_cinto',      txt:'Cinto + Talabarte'},
    {id:'epi_auricular',  txt:'Protetor Auditivo'},
    {id:'epi_linhavida',  txt:'Linha de Vida'},
    {id:'epi_luva',       txt:'Luva de Segurança'},
    {id:'epi_cone',       txt:'Cone'},
    {id:'epi_mosquetao',  txt:'Mosquetão'},
    {id:'epi_respiratorio',txt:'Proteção Respiratória'},
    {id:'epi_capacete',   txt:'Capacete de Segurança'},
    {id:'epi_fitazebrada',txt:'Fita Zebrada / Cerquite'},
    {id:'epi_oculos',     txt:'Óculos de Proteção'},
  ];

  // ── PTE P1: FRENTE ────────────────────────────────────────
  function pte_p1(doc, d) {
    let y = MT;

    // TÍTULO
    filledRect(doc, ML, y, PW, 12, WHITE, true, 0.8);
    filledRect(doc, ML, y, 4, 12, RED, false);
    txt(doc, ML+5.5, y+7, 'PERMISSÃO DE TRABALHO ESPECIAL — PTE', 11, true, RED);
    txt(doc, ML+5.5, y+10.5, 'VIANA E MOURA CONSTRUÇÕES  |  FORM 226 / REV 3.0', 6.5, false, [100,100,100]);
    const nw = 42;
    filledRect(doc, ML+PW-nw, y, nw, 12, LGRAY, true, 0.4);
    txt(doc, ML+PW-nw+2, y+5, 'Nº DA PTE:', 6.5, true, BLACK);
    txt(doc, ML+PW-nw+2, y+9.5, d.numeroPTE||'', 9, true, RED);
    y += 12;

    // CAMPOS IDENTIFICAÇÃO
    const fields = [
      {l:'EMISSÃO', v:`Data: ${d.dataEmissao||'__/__/____'}   Hora: ${d.horaEmissao||'__:__'}`, rl:'', rv:'', h:9},
      {l:'REQUISITANTE', v:d.requisitante||'', rl:'FUNÇÃO:', rv:d.funcaoRequisitante||'', h:9},
      {l:'EMITENTE', v:d.emitente||'', rl:'FUNÇÃO:', rv:d.funcaoEmitente||'', h:9},
      {l:'TRABALHO A EXECUTAR', v:d.trabalhoExecutar||'', rl:'ÁREA DE EXECUÇÃO:', rv:d.areaExecucao||'', h:11},
    ];
    const lw = PW * 0.56, rw = PW - lw;
    fields.forEach(f => {
      filledRect(doc, ML, y, lw, f.h, WHITE, true, 0.3);
      txt(doc, ML+1.5, y+3, f.l, 6, true, BLACK);
      mtext(doc, ML+1.5, y+3.5, lw-3, f.h-4, f.v, 7.5, false, BLACK, 'left', 'top');
      filledRect(doc, ML+lw, y, rw, f.h, WHITE, true, 0.3);
      if (f.rl) txt(doc, ML+lw+1.5, y+3, f.rl, 6, true, BLACK);
      if (f.rv) mtext(doc, ML+lw+1.5, y+3.5, rw-3, f.h-4, f.rv, 7.5, false, BLACK, 'left', 'top');
      y += f.h;
    });

    // OBRA / TEL
    const ow = PW * 0.56, sw = PW - ow;
    filledRect(doc, ML, y, ow, 7.5, WHITE, true, 0.3);
    txt(doc, ML+1.5, y+3, 'OBRA / PROJETO:', 6, true);
    mtext(doc, ML+1.5, y+3.5, ow-3, 5.5, d.obra||'', 7.5, false, BLACK, 'left', 'top');
    filledRect(doc, ML+ow, y, sw, 7.5, WHITE, true, 0.3);
    txt(doc, ML+ow+1.5, y+3, 'TEL. CONTATO:', 6, true);
    mtext(doc, ML+ow+1.5, y+3.5, sw-3, 5.5, d.telefoneContato||'', 7.5, false, BLACK, 'left', 'top');
    y += 7.5;

    // CABEÇALHO CHECKLIST
    filledRect(doc, ML, y, PW, 5.5, RED, false);
    txt(doc, ML+PW/2, y+3.8, 'LISTA DE VERIFICAÇÃO DE SEGURANÇA', 8.5, true, WHITE, 'center');
    y += 5.5;

    // LEGENDA
    filledRect(doc, ML, y, PW, 4, LGRAY, true, 0.2);
    txt(doc, ML+PW*0.45, y+2.8, 'Legenda:', 6.5, true);
    let lx = ML + PW*0.45 + 14;
    for (const [code, label, bg] of [['C','CONFORME',GREEN_OK],['NC','NÃO CONF.',RED_NC],['NA','N.APLIC.',MGRAY]]) {
      const bw = 5;
      filledRect(doc, lx, y+0.5, bw, 3, bg, true, 0.2);
      setFont(doc, 5.5, true); setTxt(doc, BLACK);
      doc.text(code, lx+bw/2, y+3, {align:'center'});
      lx += bw + 0.5;
      txt(doc, lx, y+2.8, label, 6);
      lx += doc.getStringUnitWidth(label) * 6 / doc.internal.scaleFactor + 2.5;
    }
    y += 4;

    // CHECKLIST ITEMS
    const tw = PW * 0.71, cw = PW - tw, ow3 = cw / 3;
    let prevSec = null;
    CHK_PTE.forEach((item, idx) => {
      if (item.sec !== prevSec) {
        filledRect(doc, ML, y, PW, 4.5, DGRAY, false);
        txt(doc, ML+PW/2, y+3.2, SEC_LABELS[item.sec], 7, true, WHITE, 'center');
        y += 4.5;
        prevSec = item.sec;
      }
      const ih = 5.2;
      const bg = idx % 2 === 0 ? LGRAY : WHITE;
      filledRect(doc, ML, y, tw, ih, bg, true, 0.15);
      mtext(doc, ML+1.5, y+1, tw-3, ih, item.txt, 6.5, false, BLACK, 'left', 'middle');
      const val = d[item.id]||'';
      for (const [i, [code, label, cbg, tcol]] of [['C','C',GREEN_OK,BLACK],['NC','NC',RED_NC,WHITE],['NA','NA',MGRAY,BLACK]].entries()) {
        const cx = ML + tw + i * ow3;
        const isSel = val === code;
        filledRect(doc, cx, y, ow3, ih, isSel ? cbg : bg, true, 0.15);
        setFont(doc, 6.5, isSel); setTxt(doc, isSel && code==='NC' ? WHITE : BLACK);
        doc.text(label, cx + ow3/2, y + ih - 1.5, {align:'center'});
      }
      y += ih;
    });

    // SEÇÃO EPI
    filledRect(doc, ML, y, PW, 5, RED, false);
    txt(doc, ML+PW/2, y+3.5, 'EQUIPAMENTO DE PROTEÇÃO INDIVIDUAL — EPI', 8, true, WHITE, 'center');
    y += 5;

    const epi_rh = 5.2, ecols = 3, ecw = PW / ecols;
    EPIS_PTE.forEach((epi, i) => {
      const col = i % ecols;
      if (col === 0 && i > 0) y += epi_rh;
      const ex = ML + col * ecw;
      const bg = Math.floor(i/ecols) % 2 === 0 ? LGRAY : WHITE;
      filledRect(doc, ex, y, ecw, epi_rh, bg, true, 0.15);
      checkbox(doc, ex+1.5, y+1, 3.2, !!d[epi.id]);
      txt(doc, ex+5.5, y+epi_rh-1.5, epi.txt, 7);
    });
    y += epi_rh;

    filledRect(doc, ML, y, PW, 5, LGRAY, true, 0.2);
    txt(doc, ML+1.5, y+3.5, 'Outros EPIs:', 6.5, true);
    txt(doc, ML+18, y+3.5, d.epi_outros||'', 7.5);
    y += 5;

    // rodapé
    setFont(doc, 6); setTxt(doc, [150,150,150]);
    doc.text('FORM 226/03', ML+PW, H-4, {align:'right'});
  }

  // ── PTE P2: VERSO ─────────────────────────────────────────
  function pte_p2(doc, d) {
    let y = MT;

    filledRect(doc, ML, y, PW, 5, RED, false);
    txt(doc, ML+PW/2, y+3.5, 'RECOMENDAÇÕES PERMANENTES DE SEGURANÇA', 8.5, true, WHITE, 'center');
    y += 5;

    const perms = [
      'Uso do EPI específico;',
      'Não fumar;',
      'Manter a área limpa e prevenida contra poluição ambiental antes, durante e após a execução do serviço;',
      'Paralisar e comunicar ao emitente em caso de situações de risco;',
      'Paralisar o serviço em situações de emergência. Neste caso a PTE perde a validade;',
      'A PTE perde a validade quando: a) as recomendações nela contidas não estiverem sendo atendidas; b) as condições de risco se agravarem;',
      'A entrada de integrantes na vala/escavação não poderá ser permitida se algum campo for marcado como NC (Não Conforme);',
      'Esta PTE deverá ficar exposta no local do trabalho até o término do serviço;',
      'Se algum colaborador se ausentar do local de trabalho para outra atividade, no retorno deve ser verificado se está apto para continuar;',
      'A PTE é exclusiva para a realização da atividade para qual foi emitida.',
    ];
    perms.forEach((p, i) => {
      const ph = 6;
      filledRect(doc, ML, y, PW, ph, i%2===0 ? LGRAY : WHITE, true, 0.15);
      mtext(doc, ML+1.5, y+1, PW-3, ph, `• ${p}`, 6.8, false, BLACK, 'left', 'middle');
      y += ph;
    });

    // OBS
    filledRect(doc, ML, y, PW, 5, RED, false);
    txt(doc, ML+PW/2, y+3.5, 'RECOMENDAÇÕES ADICIONAIS DE SEGURANÇA / OBSERVAÇÕES GERAIS', 7.5, true, WHITE, 'center');
    y += 5;
    const oh = 22;
    filledRect(doc, ML, y, PW, oh, WHITE, true, 0.4);
    mtext(doc, ML+1.5, y+1.5, PW-3, oh-2, d.recomendacoes||'', 7.5);
    y += oh;

    // EMITENTE / DECLARAÇÃO
    const half = PW/2;
    const eminfoH = 20;
    filledRect(doc, ML, y, half, eminfoH, WHITE, true, 0.4);
    const emBox = `EMITENTE: ${d.emitente||''}\n\nTEL. CONTATO: ${d.telefoneContato||''}\n\nTRABALHO AUTORIZADO: ( ${d.trabalhoAutorizado==='SIM'?'X':' '} ) SIM   ( ${d.trabalhoAutorizado==='NAO'?'X':' '} ) NÃO`;
    mtext(doc, ML+1.5, y+1.5, half-3, eminfoH-2, emBox, 7.5);
    filledRect(doc, ML+half, y, half, eminfoH, LGRAY, true, 0.4);
    mtext(doc, ML+half+1.5, y+1.5, half-3, eminfoH-2,
      'DECLARO QUE ESTOU CIENTE DAS CONDIÇÕES DE SEGURANÇA DO TRABALHO A SER EXECUTADO.', 8, true, BLACK, 'center', 'middle');
    y += eminfoH;

    // CANCELAMENTO/FECHAMENTO
    filledRect(doc, ML, y, PW, 5, RED, false);
    txt(doc, ML+PW/2, y+3.5, 'CANCELAMENTO OU FECHAMENTO', 8, true, WHITE, 'center');
    y += 5;
    filledRect(doc, ML, y, half, 4.5, MGRAY, true, 0.3);
    txt(doc, ML+1.5, y+3.2, 'CANCELAMENTO', 7.5, true);
    filledRect(doc, ML+half, y, half, 4.5, MGRAY, true, 0.3);
    txt(doc, ML+half+1.5, y+3.2, 'FECHAMENTO', 7.5, true);
    y += 4.5;

    for (const label of ['REQUISITANTE:', 'EMITENTE:', 'DATA / HORA:']) {
      const rh = 8;
      filledRect(doc, ML, y, half, rh, WHITE, true, 0.3);
      txt(doc, ML+1.5, y+3, label, 6.5, true);
      filledRect(doc, ML+half, y, half, rh, WHITE, true, 0.3);
      txt(doc, ML+half+1.5, y+3, label, 6.5, true);
      y += rh;
    }

    filledRect(doc, ML, y, half, 4.5, WHITE, true, 0.3);
    txt(doc, ML+1.5, y+3.2, 'MOTIVO DO CANCELAMENTO:', 6.5, true);
    filledRect(doc, ML+half, y, half, 4.5, WHITE, true, 0.3);
    txt(doc, ML+half+1.5, y+3.2, 'TRABALHO FINALIZADO: ( ) SIM   ( ) NÃO', 6.5);
    y += 4.5;

    const mh = 13;
    filledRect(doc, ML, y, half, mh, WHITE, true, 0.3);
    filledRect(doc, ML+half, y, half, mh, WHITE, true, 0.3);
    txt(doc, ML+half+1.5, y+3, 'MOTIVO DO NÃO FECHAMENTO:', 6.5, true);
    y += mh;

    // ASSINATURAS
    filledRect(doc, ML, y, PW, 5, RED, false);
    txt(doc, ML+PW/2, y+3.5, 'ASSINATURA DOS COLABORADORES AUTORIZADOS A EXECUTAR A ATIVIDADE', 7.5, true, WHITE, 'center');
    y += 5;

    const workers = (d.workers_pte||[]).filter(w=>w);
    const sigh = 6.5;
    for (let i = 0; i < 14; i++) {
      const col = i % 2, row = Math.floor(i/2);
      const wx = ML + col * half, wy = y + row * sigh;
      filledRect(doc, wx, wy, half, sigh, (Math.floor(i/2))%2===0 ? LGRAY : WHITE, true, 0.15);
      txt(doc, wx+1.5, wy+4, `${i+1}. ${workers[i]||''}`, 7.5);
      
      const sigData = d.signatures && d.signatures[`workers_pte_${i}`];
      if (sigData && workers[i]) {
        drawSig(doc, wx + half - 18, wy + 0.5, 16, 5.5, sigData);
      }
    }
    y += 7 * sigh;

    setFont(doc, 6); setTxt(doc, [150,150,150]);
    doc.text('FORM 226/03', ML+PW, H-4, {align:'right'});
  }

  // ── PTA P1 ────────────────────────────────────────────────
  function chkRowPTA(doc, x, y, w, h, label, val, idx) {
    const tw = w * 0.72, ow = w - tw, optw = ow / 3;
    const bg = idx % 2 === 0 ? LGRAY : WHITE;
    filledRect(doc, x, y, tw, h, bg, true, 0.15);
    mtext(doc, x+1.5, y+1, tw-3, h, label, 6.5, false, BLACK, 'left', 'middle');
    for (const [i, [code, lbl, cbg]] of [['SIM','Sim',GREEN_OK],['NAO','Não',RED_NC],['NA','NA',MGRAY]].entries()) {
      const cx = x + tw + i * optw;
      const isSel = val === code;
      filledRect(doc, cx, y, optw, h, isSel ? cbg : bg, true, 0.15);
      setFont(doc, 6.5, isSel); setTxt(doc, isSel && code==='NAO' ? WHITE : BLACK);
      doc.text(lbl, cx + optw/2, y + h - 1.5, {align:'center'});
    }
  }

  function pta_p1(doc, d) {
    let y = MT;

    // TÍTULO
    filledRect(doc, ML, y, PW, 12, WHITE, true, 0.8);
    filledRect(doc, ML, y, 4, 12, BLUE, false);
    txt(doc, ML+5.5, y+7, 'PT — PERMISSÃO PARA TRABALHO EM ALTURA', 11, true, BLUE);
    txt(doc, ML+5.5, y+10.5, 'VIANA E MOURA CONSTRUÇÕES  |  FORM 34 / REV 04', 6.5, false, [100,100,100]);
    const nw = 42;
    filledRect(doc, ML+PW-nw, y, nw, 12, LGRAY, true, 0.4);
    txt(doc, ML+PW-nw+2, y+5, 'Nº DA PT:', 6.5, true);
    txt(doc, ML+PW-nw+2, y+9.5, d.numeroPTA||'', 9, true, BLUE);
    y += 12;

    // CAMPOS
    const rh = 9, half = PW/2;
    filledRect(doc, ML, y, PW, rh, WHITE, true, 0.3);
    txt(doc, ML+1.5, y+3, 'NOME DA EMPRESA:', 6, true);
    mtext(doc, ML+32, y+0.5, PW-34, rh, d.empresa||'Viana e Moura Construções', 8, false, BLACK, 'left', 'middle');
    y += rh;

    for (const [llab, lval, rlab, rval] of [
      ['INÍCIO DA ATIVIDADE:', `Data: ${d.dataInicio||''}  |  Hora: ${d.horaInicio||''}`, 'FIM DA ATIVIDADE:', `Data: ${d.dataFim||''}  |  Hora: ${d.horaFim||''}`],
      ['SERVIÇO A EXECUTAR:', d.servicoExecutar||'', 'LOCAL / SETOR:', d.localSetor||''],
    ]) {
      filledRect(doc, ML, y, half, rh, WHITE, true, 0.3);
      txt(doc, ML+1.5, y+3, llab, 6, true);
      mtext(doc, ML+1.5, y+3.5, half-3, rh-4, lval, 7.5, false, BLACK);
      filledRect(doc, ML+half, y, half, rh, WHITE, true, 0.3);
      txt(doc, ML+half+1.5, y+3, rlab, 6, true);
      mtext(doc, ML+half+1.5, y+3.5, half-3, rh-4, rval, 7.5, false, BLACK);
      y += rh;
    }

    // MEIO + OBRA
    filledRect(doc, ML, y, half, rh, WHITE, true, 0.3);
    txt(doc, ML+1.5, y+3, 'MEIO DE EXECUÇÃO:', 6, true);
    const meios = [];
    if (d.meio_andaime) meios.push('Andaime');
    if (d.meio_escada) meios.push('Escada');
    if (d.meio_plataforma) meios.push('Plataforma');
    if (d.meioOutros) meios.push(`Outros: ${d.meioOutros}`);
    mtext(doc, ML+1.5, y+3.5, half-3, rh-4, meios.join(', ')||'—', 7.5, false, BLACK);
    filledRect(doc, ML+half, y, half, rh, WHITE, true, 0.3);
    txt(doc, ML+half+1.5, y+3, 'OBRA / PROJETO:', 6, true);
    mtext(doc, ML+half+1.5, y+3.5, half-3, rh-4, d.obra||'', 7.5, false, BLACK);
    y += rh;

    // NR ref
    filledRect(doc, ML, y, PW, 5, LGRAY, true, 0.2);
    mtext(doc, ML+1.5, y+1, PW-3, 5, 'Documento em atendimento à NR-18, NR-35 e Recomendação Técnica de Procedimentos (Fundacentro)', 6.5, true, BLACK, 'left', 'middle');
    y += 5;

    // Legenda
    filledRect(doc, ML, y, PW, 4, BLUE, false);
    txt(doc, ML+PW/2, y+2.9, 'Legenda: NA = Não Aplica  |  SIM = CONFORME  |  NÃO = INCONFORME', 6.5, true, WHITE, 'center');
    y += 4;

    // VERIFICAÇÕES GERAIS
    sectionHeader(doc, ML, y, PW, 4.5, 'VERIFICAÇÕES GERAIS');
    y += 4.5;
    const genItems = [
      ['g1','Foi elaborada a APR — Análise Preliminar de Risco, para a realização desta atividade?'],
      ['g3','Os EPIs estão em condições de uso?'],
      ['g2','A Equipe de Trabalho está apta? (ASO, Treinamento NR-35, Aferição Pressão Arterial)'],
      ['g4','Foram atendidos os pré-requisitos estabelecidos pela Análise de Risco?'],
    ];
    for (let i = 0; i < genItems.length; i += 2) {
      const h = 7;
      for (let j = 0; j < 2 && i+j < genItems.length; j++) {
        const [fid, ftxt] = genItems[i+j];
        chkRowPTA(doc, ML + j*half, y, half, h, ftxt, d[fid]||'', i+j);
      }
      y += h;
    }

    // ANDAIME
    const aSimNao = d.meio_andaime ? 'SIM (X)' : 'SIM ( )';
    sectionHeader(doc, ML, y, PW, 4.5, `USO DE ANDAIME  —  ${aSimNao}`);
    y += 4.5;
    const ih = 5.8;
    CHK_ANDAIME.forEach((item, idx) => { chkRowPTA(doc, ML, y, PW, ih, item.txt, d[item.id]||'', idx); y += ih; });

    // ESCADA
    const eSimNao = d.meio_escada ? 'SIM (X)' : 'SIM ( )';
    sectionHeader(doc, ML, y, PW, 4.5, `USO DE ESCADA  —  ${eSimNao}`);
    y += 4.5;
    CHK_ESCADA.forEach((item, idx) => { chkRowPTA(doc, ML, y, PW, ih, item.txt, d[item.id]||'', idx); y += ih; });

    // OUTROS
    sectionHeader(doc, ML, y, PW, 4.5, 'OUTROS SERVIÇOS');
    y += 4.5;
    CHK_OUTROS_PTA.forEach((item, idx) => { chkRowPTA(doc, ML, y, PW, ih, item.txt, d[item.id]||'', idx); y += ih; });

    setFont(doc, 6); setTxt(doc, [150,150,150]);
    doc.text('FORM. 34 / 04', ML+PW, H-4, {align:'right'});
  }

  // ── PTA P2 ────────────────────────────────────────────────
  function pta_p2(doc, d) {
    let y = MT;

    // EPI
    filledRect(doc, ML, y, PW, 5, BLUE, false);
    txt(doc, ML+PW/2, y+3.5, 'EPI e EPC — Equipamentos de Proteção Individual e Coletiva', 8, true, WHITE, 'center');
    y += 5;
    const erh = 5.2, ecols = 3, ecw = PW/ecols;
    EPIS_PTA.forEach((epi, i) => {
      const col = i % ecols;
      if (col === 0 && i > 0) y += erh;
      const ex = ML + col * ecw;
      const bg = Math.floor(i/ecols) % 2 === 0 ? LGRAY : WHITE;
      filledRect(doc, ex, y, ecw, erh, bg, true, 0.15);
      checkbox(doc, ex+1.5, y+1, 3.2, !!d[epi.id]);
      txt(doc, ex+5.5, y+erh-1.5, epi.txt, 7);
    });
    y += erh;
    filledRect(doc, ML, y, PW, 4.5, LGRAY, true, 0.2);
    txt(doc, ML+1.5, y+3, 'Outros EPIs:', 6.5, true);
    txt(doc, ML+20, y+3, d.epi_outros_pta||'', 7.5);
    y += 4.5;

    // LIBERAÇÃO
    filledRect(doc, ML, y, PW, 5, BLUE, false);
    txt(doc, ML+PW/2, y+3.5, 'LIBERAÇÃO PARA TRABALHO EM ALTURA', 8, true, WHITE, 'center');
    y += 5;

    const acols = [PW*0.26, PW*0.26, PW*0.17, PW*0.17, PW*0.14];
    const aheads = ['Nome', 'Assinatura', 'Hora de Início', 'Hora de Término', 'Rubrica'];
    filledRect(doc, ML, y, PW, 4.5, MGRAY, true, 0.3);
    txt(doc, ML+1.5, y+3.2, 'RESPONSÁVEIS POR AUTORIZAR', 7, true);
    y += 4.5;
    let ahx = ML;
    aheads.forEach((h, i) => {
      filledRect(doc, ahx, y, acols[i], 5, MGRAY, true, 0.3);
      setFont(doc, 6.5, true); setTxt(doc, BLACK);
      doc.text(h, ahx + acols[i]/2, y+3.5, {align:'center'});
      ahx += acols[i];
    });
    y += 5;
    const auths = d.auth_resp || [];
    for (let i = 0; i < 3; i++) {
      const a = auths[i] || {};
      const arh = 7;
      let axc = ML;
      filledRect(doc, axc, y, acols[0], arh, i%2===0?LGRAY:WHITE, true, 0.2);
      txt(doc, axc+1.5, y+arh-2.5, typeof a === 'object' ? (a.nome||'') : a, 7.5);
      
      // Assinatura (col 1) e Rubrica (col 4)
      const sigData = d.signatures && d.signatures[`auth_resp_${i}`];
      
      for (let j = 1; j < 5; j++) { 
        axc += acols[j-1]; 
        filledRect(doc, axc, y, acols[j], arh, i%2===0?LGRAY:WHITE, true, 0.2);
        if ((j === 1 || j === 4) && sigData && (a.nome || (typeof a === 'string' && a))) {
          drawSig(doc, axc + 2, y + 0.5, acols[j] - 4, arh - 1, sigData);
        }
      }
      y += arh;
    }

    // TRABALHADORES
    filledRect(doc, ML, y, PW, 5, BLUE, false);
    txt(doc, ML+PW/2, y+3.5, 'CONTROLE PARA LIBERAÇÃO DE COLABORADORES PARA TRABALHO EM ALTURA', 7, true, WHITE, 'center');
    y += 5;
    const wcols = [PW*0.30, PW*0.18, PW*0.18, PW*0.16, PW*0.18];
    const wheads = ['Nome do Trabalhador', 'Função', 'Matrícula/CPF', 'Pressão Arterial', 'Assinatura/Rubrica'];
    let whx = ML;
    wheads.forEach((h, i) => {
      filledRect(doc, whx, y, wcols[i], 5, MGRAY, true, 0.3);
      setFont(doc, 6.5, true); setTxt(doc, BLACK);
      doc.text(h, whx + wcols[i]/2, y+3.5, {align:'center'});
      whx += wcols[i];
    });
    y += 5;
    const workers = (d.workers_pta || []).filter(w => w && (typeof w === 'object' ? w.nome : w));
    for (let i = 0; i < 6; i++) {
      const wr = workers[i] || {};
      const wrh = 6.5;
      const bg = i%2===0 ? LGRAY : WHITE;
      const vals = [wr.nome||'', wr.funcao||'', wr.matricula||'', wr.pa||''];
      let wrhx = ML;
      vals.forEach((v, j) => {
        filledRect(doc, wrhx, y, wcols[j], wrh, bg, true, 0.15);
        txt(doc, wrhx+1.5, y+wrh-2, v, 7.5);
        wrhx += wcols[j];
      });
      // Assinatura/Rubrica (última col)
      filledRect(doc, wrhx, y, wcols[4], wrh, bg, true, 0.15);
      const sigData = d.signatures && d.signatures[`workers_pta_${i}`];
      if (sigData && wr.nome) {
        drawSig(doc, wrhx + 2, y + 0.5, wcols[4] - 4, wrh - 1, sigData);
      }
      y += wrh;
    }

    // OBSERVAÇÕES
    filledRect(doc, ML, y, PW, 5, YELLOW, false);
    txt(doc, ML+PW/2, y+3.5, 'OBSERVAÇÕES:', 9, true, BLACK, 'center');
    y += 5;
    const obsh = 18;
    filledRect(doc, ML, y, PW, obsh, WHITE, true, 0.5);
    mtext(doc, ML+1.5, y+1.5, PW-3, obsh-2, d.observacoesPTA||'', 7.5);
    y += obsh;

    // AVISOS
    filledRect(doc, ML, y, PW, 5, DGRAY, false);
    txt(doc, ML+PW/2, y+3.5, 'AVISOS IMPORTANTES', 9, true, WHITE, 'center');
    y += 5;
    const avisos = [
      '1. O Trabalho em altura não pode ser permitido se algum campo não for preenchido e inspecionado ou contiver a marca na coluna NÃO.',
      '2. Esta permissão de Trabalho em Altura só terá validade para o local descrito acima no cabeçalho.',
      '3. Esta permissão de Trabalho em Altura deverá ficar exposta no local de trabalho até o seu término.',
      '4. Para solicitação do serviço do Bombeiro Militar ligar para o telefone: 193.',
      '5. Analisar atentamente o local de trabalho, antes de iniciar o serviço.',
      '6. Nunca andar diretamente sobre materiais frágeis (telhas, ripas, etc.) — andar somente em locais resistentes.',
      '7. Sempre que for usado o cinto de segurança com dois talabartes ele deve ser ancorado em local adequado e fixo.',
      '8. É proibido arremessar qualquer tipo de material.',
      '9. Fica proibido trabalhar com chuva/garoa ou ventos fortes.',
      '10. Trabalhos em altura sempre acompanhado, no mínimo duas pessoas.',
      '11. O colaborador "NÃO" é autorizado a realizar trabalho em altura quando sua Pressão Arterial for superior a 130x80 mmHg.',
    ];
    avisos.forEach((av, i) => {
      const avh = 6;
      filledRect(doc, ML, y, PW, avh, i%2===0?LGRAY:WHITE, true, 0.15);
      mtext(doc, ML+1.5, y+1, PW-3, avh, av, 6.5, false, BLACK, 'left', 'middle');
      y += avh;
    });

    setFont(doc, 6); setTxt(doc, [150,150,150]);
    doc.text('FORM. 34 / 04', ML+PW, H-4, {align:'right'});
  }

  // ── PUBLIC API ────────────────────────────────────────────
  return {
    generate(permit) {
      // Requires jsPDF loaded globally
      if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
        alert('jsPDF não carregado.'); return;
      }
      const jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
      const doc = new jsPDF({ unit:'mm', format:'a4', orientation:'portrait' });
      const d   = permit.dados || {};
      const fid = permit.formId;

      if (fid === 'PTE') {
        pte_p1(doc, d);
        doc.addPage();
        pte_p2(doc, d);
      } else if (fid === 'PTA') {
        pta_p1(doc, d);
        doc.addPage();
        pta_p2(doc, d);
      }

      const num = (permit.numero || fid).replace(/\//g,'-').replace(/\s/g,'_');
      doc.save(`${num}.pdf`);
    }
  };
})();
