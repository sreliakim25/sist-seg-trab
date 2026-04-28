# VMC Liberações de Segurança
**Sistema de Permissões e Liberações de Segurança do Trabalho**
Viana & Moura Construções — Unidade de Dispositivos Especiais (UDE)

---

## Visão Geral

O VMC Liberações de Segurança é uma aplicação web progressiva (PWA) desenvolvida para digitalizar o fluxo de emissão, preenchimento e arquivamento das permissões de trabalho de segurança utilizadas nos canteiros de obras da UDE. O sistema opera completamente offline no dispositivo (tablet ou smartphone), sem necessidade de conexão com internet durante o preenchimento — e permite exportar o documento preenchido como PDF fiel ao layout original dos formulários Excel para posterior armazenamento em nuvem.

O sistema foi concebido para substituir o processo manual em papel, reduzir falhas humanas na verificação de itens de segurança e acelerar o fluxo de liberação no canteiro.

---

## Funcionalidades

**Gerenciamento de permissões**
- Cadastro e preenchimento de múltiplos tipos de formulário de segurança
- Fluxo guiado em etapas com validação de campos obrigatórios
- Tela de revisão completa antes de confirmar a liberação
- Histórico de todas as liberações registradas no dispositivo
- Busca e filtragem por obra, tipo de permissão ou responsável

**Formulários implementados**
- PTE — Permissão de Trabalho Especial (FORM 226 / REV 3.0), para serviços de escavação
- PT-Altura — Permissão para Trabalho em Altura (FORM 34 / REV 04), para uso de andaime, escada e outros meios

**Exportação em PDF**
- Geração de PDF diretamente no browser, sem servidor
- Layout de 2 páginas (Frente e Verso) idêntico ao formulário Excel original
- Coloração dos itens conforme marcação (verde para Conforme/Sim, vermelho para Não Conforme/Não, cinza para Não Aplicável)
- Checkboxes dos EPIs marcados conforme seleção
- Tabela de colaboradores e dados de Pressão Arterial (PT-Altura)

**Extensibilidade**
- Tela de gerenciamento de tipos de formulário: novos formulários podem ser adicionados ao sistema sem alterar o código
- Arquitetura modular que permite adicionar novos schemas de formulário seguindo o padrão existente

**PWA — Instalável como aplicativo**
- Funciona como aplicativo nativo em tablets Android e iOS
- Modo offline completo via Service Worker
- Dados persistidos localmente via LocalStorage

---

## Estrutura de Arquivos

```
vmc-safety/
├── index.html       → Estrutura HTML da aplicação (todas as telas)
├── style.css        → Estilos completos (design system, temas, responsivo)
├── app.js           → Lógica principal (navegação, formulários, dados, fluxo)
├── pdf_export.js    → Motor de geração de PDF (jsPDF, client-side)
├── pdf_gen.py       → Gerador alternativo em Python/ReportLab (server-side)
├── manifest.json    → Manifesto PWA (ícones, tema, nome do app)
├── sw.js            → Service Worker (cache offline)
└── README.md        → Esta documentação
```

---

## Telas do Sistema

### Login
Tela de autenticação com identidade visual da Viana & Moura (vermelho, dourado, creme). O sistema aceita qualquer usuário e senha no modo atual (offline-first), sem backend de autenticação — adequado para uso interno em dispositivos controlados.

### Home
Painel principal com três seções:
- Estatísticas rápidas: liberações de hoje, da semana e total acumulado
- Grade de tipos de permissão disponíveis (toque para iniciar preenchimento)
- Lista das últimas liberações registradas com status visual

### Formulário (etapas)
Preenchimento guiado com barra de progresso. Cada formulário é dividido em etapas lógicas:

**PTE — 3 etapas:**
1. Identificação: número da PTE, data/hora, requisitante, emitente, trabalho e área de execução, obra e telefone
2. Lista de Verificação: 26 itens organizados em 7 seções (Colaborador, Inspeção e Projetos, Área de Escavação e APR, Escoramento, Taludes, Terceirizada, Arquivamento) — cada item marcado como C, NC ou NA
3. EPIs e Colaboradores: seleção dos equipamentos de proteção, lista de até 14 colaboradores autorizados, observações e autorização final

**PT-Altura — 3 etapas:**
1. Identificação: número da PT, empresa, datas/horários de início e fim, serviço, local/setor, obra e meio de execução (andaime, escada, plataforma ou outros)
2. Verificações Técnicas: 4 itens gerais + 12 itens de andaime + 9 itens de escada + 2 itens de outros serviços — cada item marcado como Sim, Não ou NA
3. EPIs e Colaboradores: 13 EPIs/EPCs selecionáveis, tabela de trabalhadores com nome, função, matrícula/CPF e pressão arterial, seção de responsáveis pela autorização e observações

### Revisão
Tela de conferência antes de salvar. Exibe alerta automático em laranja quando há itens marcados como NC ou Não. O técnico pode voltar para editar ou confirmar a liberação.

### Sucesso e Exportação
Tela de confirmação com número da permissão em destaque e dois botões: Exportar PDF e Voltar ao Início.

### Registros
Lista completa de todas as liberações com busca em tempo real por qualquer campo (número, obra, responsável, tipo, data).

### Formulários (Admin)
Tela de gerenciamento dos tipos de formulário cadastrados no sistema, com opção de adicionar novos tipos e remover existentes.

---

## Fluxo de Uso no Canteiro

```
1. Técnico pega o tablet e abre o app (instalado como PWA)
2. Faz login com suas credenciais
3. Na Home, toca no tipo de permissão desejado
4. Preenche as etapas do formulário (sem precisar de internet)
5. Revisa todos os dados na tela de revisão
6. Confirma — o serviço é registrado como LIBERADO
7. Toca em "Exportar PDF" para gerar o documento
8. Compartilha ou envia o PDF para armazenamento na nuvem
```

---

## Geração de PDF

O PDF é gerado inteiramente no browser, sem envio de dados para servidores externos, usando a biblioteca **jsPDF 2.5.1**.

O arquivo `pdf_export.js` contém o módulo `VMC_PDF` com as seguintes funções internas:

| Função | Descrição |
|---|---|
| `pte_p1(doc, d)` | Renderiza a Frente do FORM 226 (identificação + checklist + EPIs) |
| `pte_p2(doc, d)` | Renderiza o Verso do FORM 226 (recomendações + autorização + assinaturas) |
| `pta_p1(doc, d)` | Renderiza a Página 1 do FORM 34 (identificação + verificações técnicas) |
| `pta_p2(doc, d)` | Renderiza a Página 2 do FORM 34 (EPIs + liberação de trabalhadores + avisos) |
| `VMC_PDF.generate(permit)` | Função pública — recebe o objeto de permissão e dispara o download |

**Lógica de coloração dos itens do checklist:**

| Marcação | Cor de fundo | Cor do texto |
|---|---|---|
| C / SIM | Verde claro `#A5D6A7` | Preto |
| NC / NÃO | Vermelho claro `#EF9A9A` | Branco |
| NA | Cinza `#D9D9D9` | Preto |
| Não preenchido | Fundo da linha | Preto |

**Fidelidade ao layout Excel — o que foi replicado:**
- Proporções de colunas e altura de linhas proporcionais ao original
- Barra vermelha lateral no cabeçalho (PTE) e barra azul (PT-Altura)
- Seções com fundo escuro e texto branco
- Alternância de fundo cinza/branco nas linhas (zebra)
- Checkboxes com marcação X para EPIs selecionados
- Campos de autorização, cancelamento e fechamento no verso
- Tabela de assinaturas com 14 slots em 2 colunas (PTE)
- Tabela de trabalhadores com nome, função, matrícula e PA (PT-Altura)
- Avisos importantes ao rodapé (PT-Altura)
- Numeração do formulário no rodapé de cada página (`FORM 226/03`, `FORM. 34/04`)

**Gerador alternativo em Python (`pdf_gen.py`):**
Implementação idêntica usando ReportLab, para uso em cenário com backend. Recebe os dados via JSON pelo stdin e grava o PDF em disco. Útil para geração em lote ou integração futura com um servidor.

```bash
# Uso do pdf_gen.py
echo '{"formId":"PTE","dados":{...},"out":"/tmp/saida.pdf"}' | python3 pdf_gen.py
```

---

## Armazenamento de Dados

Todos os dados são persistidos no **LocalStorage** do browser com prefixo `vmc_`. Não há banco de dados externo nem envio automático para servidores.

| Chave | Conteúdo |
|---|---|
| `vmc_currentUser` | Objeto do usuário logado (`name`, `initials`) |
| `vmc_records` | Array com todas as permissões registradas |
| `vmc_formTypes` | Array com os tipos de formulário configurados |

**Estrutura de um registro salvo:**
```json
{
  "id": "VMC-1748350000000",
  "formId": "PTE",
  "numero": "PTE-2025-001",
  "status": "LIBERADO",
  "data": "2025-05-20",
  "obra": "Rede Emissária Lote 7",
  "criado": "2025-05-20T07:30:00.000Z",
  "usuario": "Eliakim",
  "dados": {
    "numeroPTE": "PTE-2025-001",
    "requisitante": "Carlos Silva",
    "emitente": "Eliakim Rocha",
    "chk1": "C",
    "chk2": "C",
    "chk9": "NC",
    "epi_auricular": true,
    "workers_pte": ["João da Silva", "Pedro Alves"],
    "trabalhoAutorizado": "SIM"
  }
}
```

**Estratégia de backup recomendada:** após cada turno, o técnico exporta os PDFs gerados e os envia para a pasta compartilhada no Google Drive / SharePoint da UDE. Os dados brutos (JSON) também podem ser exportados manualmente via console do browser para importação futura em um banco de dados.

---

## PWA — Instalação e Uso Offline

O sistema é configurado como Progressive Web App com suporte completo a instalação e funcionamento offline.

**Como instalar no tablet:**
1. Acesse a URL do sistema no Chrome (Android) ou Safari (iOS)
2. Chrome Android: toque nos três pontos → "Adicionar à tela inicial"
3. Safari iOS: toque no botão de compartilhar → "Adicionar à Tela de Início"
4. O ícone do app aparecerá na tela inicial como um aplicativo nativo
5. A partir daí, o sistema funciona sem internet

**Como o Service Worker funciona (`sw.js`):**
- Na primeira visita, os arquivos `index.html`, `style.css`, `app.js` e `manifest.json` são salvos no cache do dispositivo
- Nas visitas seguintes, o sistema carrega do cache, sem necessidade de internet
- Ao atualizar o sistema (nova versão), o Service Worker limpa o cache antigo e baixa a versão nova automaticamente
- A estratégia é **Cache First**: sempre usa o cache local; só busca na rede se o arquivo não estiver em cache

**Manifesto (`manifest.json`):**
```json
{
  "name": "VMC — Liberações de Segurança",
  "short_name": "VMC Segurança",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#F5F0E8",
  "theme_color": "#8B1A1A"
}
```

---

## Design System

**Paleta de cores:**

| Nome | Hex | Uso |
|---|---|---|
| Vermelho VMC | `#8B1A1A` | Cabeçalhos, botões primários, PTE |
| Dourado | `#C9A96E` | Acentos, bordas decorativas |
| Creme | `#F5F0E8` | Fundo geral, campos de formulário |
| Creme escuro | `#EDE6D6` | Fundo de botões secundários |
| Branco | `#FFFFFF` | Cards, painéis |
| Azul | `#1565C0` | PT-Altura (diferenciação visual) |
| Verde | `#2E7D32` | Status liberado, itens Conforme |
| Vermelho perigo | `#C62828` | Status cancelado, itens NC |

**Tipografia:**
- Display / títulos: Playfair Display (serif) — elegância institucional
- Corpo / interface: Source Sans 3 (sans-serif) — legibilidade em tela

**Componentes principais:**
- Cards de permissão com barra dourada no topo e contador de registros
- Checklist com radio buttons estilizados (C/NC/NA e Sim/Não/NA)
- Toggle de EPIs com checkbox visual integrado
- Tabela inline de trabalhadores com edição direta
- Toast de notificação para feedback de ações
- Barra de progresso animada no fluxo de preenchimento
- Bottom navigation com três abas (Início, Registros, Formulários)

---

## Tecnologias Utilizadas

| Tecnologia | Versão | Função |
|---|---|---|
| HTML5 | — | Estrutura da aplicação |
| CSS3 | — | Estilização, animações, layout responsivo |
| JavaScript (Vanilla) | ES2020+ | Lógica da aplicação, sem frameworks |
| jsPDF | 2.5.1 | Geração de PDF no browser |
| Service Worker API | — | Cache offline e instalação PWA |
| LocalStorage API | — | Persistência de dados no dispositivo |
| Web App Manifest | — | Configuração PWA |
| Google Fonts | — | Playfair Display + Source Sans 3 |
| Python 3 + ReportLab | — | Gerador alternativo de PDF (server-side) |

---

## Adicionando Novos Formulários

O sistema suporta adição de novos tipos de permissão de duas formas:

**Forma 1 — Via interface (formulários genéricos):**
1. Acesse a aba "Formulários" na navegação inferior
2. Toque em "Adicionar Novo Formulário"
3. Informe o nome, código/sigla e descrição
4. O novo tipo aparece na Home para seleção
5. O formulário genérico coleta os dados em formato livre

**Forma 2 — Via código (formulários estruturados):**
Para adicionar um formulário com checklist próprio e PDF fiel, edite `app.js` e `pdf_export.js`:

**Em `app.js`**, adicione o tipo ao array `FORM_TYPES`:
```javascript
{
  id: 'PTQ',
  name: 'Permissão para Trabalho a Quente',
  code: 'FORM 310',
  desc: 'Soldagem, corte e geração de faíscas',
  icon: '🔥',
  color: '#E65100',
  bg: '#FFF3E0',
}
```

Em seguida, adicione o schema de etapas dentro do objeto `FORMS`:
```javascript
FORMS.PTQ = {
  steps: [
    {
      title: 'Identificação',
      desc: 'Dados da Permissão de Trabalho a Quente',
      render: () => `...`, // HTML da etapa
      required: ['numeroPTQ', 'dataEmissao', 'responsavel'],
    },
    // ... demais etapas
  ]
};
```

**Em `pdf_export.js`**, adicione as funções de renderização:
```javascript
function ptq_p1(doc, d) { /* Página 1 */ }
function ptq_p2(doc, d) { /* Página 2 */ }
```

E registre no método `generate`:
```javascript
} else if (fid === 'PTQ') {
  ptq_p1(doc, d);
  doc.addPage();
  ptq_p2(doc, d);
}
```

---

## Deploy e Hospedagem

O sistema é composto por arquivos estáticos e pode ser hospedado em qualquer serviço de hosting estático, sem necessidade de servidor backend.

**Opções recomendadas:**

**Vercel (recomendado — gratuito):**
```bash
# Instalar Vercel CLI
npm install -g vercel

# Dentro da pasta do projeto
vercel

# Em deployments futuros
vercel --prod
```

**GitHub Pages (gratuito):**
1. Crie um repositório no GitHub
2. Faça upload dos arquivos
3. Em Settings → Pages, selecione a branch `main` como source
4. A URL será: `https://seuusuario.github.io/vmc-safety`

**Netlify (gratuito):**
1. Acesse netlify.com e faça login
2. Arraste a pasta do projeto para a área de deploy
3. A URL é gerada automaticamente

**Servidor interno (NGINX):**
```nginx
server {
    listen 80;
    server_name safety.vmconstrucoes.com.br;
    root /var/www/vmc-safety;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

> **Importante para o Service Worker:** o sistema precisa ser servido via HTTPS para que a instalação PWA e o cache offline funcionem corretamente. Vercel, GitHub Pages e Netlify fornecem HTTPS automaticamente.

---

## Atualizar o Sistema nos Tablets

Quando uma nova versão for publicada, os tablets receberão a atualização automaticamente na próxima vez que o app for aberto com internet disponível. O Service Worker detecta a nova versão, limpa o cache antigo e instala os novos arquivos em segundo plano.

Para forçar atualização imediata: feche o app completamente e reabra, ou acesse o navegador e limpe o cache do site manualmente.

Para atualizar a versão do cache, edite `sw.js` e incremente o número:
```javascript
const CACHE = 'vmc-safety-v2'; // era v1
```

---

## Roadmap — Próximas Evoluções

**Curto prazo**
- Assinatura digital por toque na tela (canvas touch) no verso do formulário
- Exportação direta para Google Drive via API
- Ícones PNG reais (192×192 e 512×512) para instalação PWA compliant

**Médio prazo**
- Backend leve (Node.js + PostgreSQL ou Supabase) para centralizar os registros
- Sincronização automática quando o dispositivo reconectar à internet (sync offline-first)
- Painel web de gestão para o gestor da UDE visualizar todas as liberações em tempo real
- Integração com o Painel de Gargalos da UDE

**Longo prazo**
- Módulo de relatórios mensais com indicadores de conformidade por obra
- Notificações push para o gestor quando uma NC for registrada
- Autenticação por matrícula de colaborador com biometria
- Integração com o App VM Terceiros para validação automática de documentação

---

## Formulários de Referência

| Formulário | Arquivo Original | Revisão | Normas |
|---|---|---|---|
| PTE — Permissão de Trabalho Especial | `FORM_226_-_REV_3_0_-_PERMISSÃO_DE_TRABALHO_ESPECIAL.xlsx` | REV 3.0 | NR-18 |
| PT-Altura — Permissão para Trabalho em Altura | `FORM_34_-_Permissão_para_Trabalho_em_altura_04.xlsx` | REV 04 | NR-18, NR-35 |

---

## Autoria e Contexto

Sistema desenvolvido para uso interno da **Unidade de Dispositivos Especiais (UDE)** da **Viana & Moura Construções**, operando nos municípios do Agreste Pernambucano. Faz parte da iniciativa de digitalização e gestão por dados da UDE, alinhada ao projeto estratégico "Da UDE Para o Cliente".

Desenvolvimento: **RochaDev** — Tecnologia para Construção e Infraestrutura
Contato e portfólio: [rochadev.com.br](https://rochadev.com.br)

---

*VMC Liberações de Segurança — v1.1.0*
*Última atualização: Abril de 2026*
