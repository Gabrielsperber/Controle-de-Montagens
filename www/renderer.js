let projetosCache = [];
let lojasCache = [];
let sortEstado = { campo: 'dataEmissao', direcao: 'desc' };
let anexoAtual = null;
let anexoParaRemoverAoSalvar = null;

// ---------- Helpers (duplicados do util.js do processo principal, versão browser) ----------
// Status de PAGAMENTO depende só do valor recebido ter sido informado —
// preencher apenas a data de pagamento não marca o registro como pago.
function calcularStatus(p) {
  const cobrado = Number(p.valorCobrado) || 0;
  const recebido = p.valorRecebido === '' || p.valorRecebido === null || p.valorRecebido === undefined
    ? null
    : Number(p.valorRecebido);
  if (recebido === null) return 'pendente';
  if (Math.abs(recebido - cobrado) < 0.01) return 'pago';
  return 'divergencia';
}

function diferenca(p) {
  const cobrado = Number(p.valorCobrado) || 0;
  const recebido = p.valorRecebido === '' || p.valorRecebido === null || p.valorRecebido === undefined
    ? null
    : Number(p.valorRecebido);
  if (recebido === null) return null;
  return recebido - cobrado;
}

function formatarMoeda(valor) {
  const n = Number(valor) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarDataHora(iso) {
  if (!iso) return '—';
  const [dataParte, horaParte] = String(iso).split('T');
  const [ano, mes, dia] = (dataParte || '').split('-');
  if (!ano || !mes || !dia) return iso;
  const dataFormatada = `${dia}/${mes}/${ano}`;
  if (!horaParte) return dataFormatada;
  return `${dataFormatada} ${horaParte}`;
}

const STATUS_LABEL = { pendente: 'Pendente', pago: 'Pago', divergencia: 'Divergência' };
const STATUS_MONTAGEM_LABEL = { andamento: 'Em andamento', finalizado: 'Finalizado' };

// ---------- Elementos ----------
const tbody = document.getElementById('tbody');
const vazio = document.getElementById('vazio');
const overlay = document.getElementById('overlay');
const form = document.getElementById('form');
const modalTitulo = document.getElementById('modalTitulo');
const btnExcluir = document.getElementById('btnExcluir');
const toast = document.getElementById('toast');

const filtroLoja = document.getElementById('filtroLoja');
const filtroStatus = document.getElementById('filtroStatus');
const filtroMontagem = document.getElementById('filtroMontagem');
const filtroDataInicio = document.getElementById('filtroDataInicio');
const filtroDataFim = document.getElementById('filtroDataFim');
const filtroBusca = document.getElementById('filtroBusca');

const overlayLoja = document.getElementById('overlayLoja');
const formLoja = document.getElementById('formLoja');
const fNovaLoja = document.getElementById('fNovaLoja');
const listaLojasGerenciar = document.getElementById('listaLojasGerenciar');

const anexoVazio = document.getElementById('anexoVazio');
const anexoPreenchido = document.getElementById('anexoPreenchido');
const anexoNomeEl = document.getElementById('anexoNome');

const btnConfig = document.getElementById('btnConfig');
const menuConfig = document.getElementById('menuConfig');

// ---------- Inicialização ----------
async function init() {
  await carregarLojas();
  await carregarResponsaveis();
  await carregarProjetos();

  document.getElementById('btnNovo').addEventListener('click', () => abrirModal());
  document.getElementById('btnFechar').addEventListener('click', fecharModal);
  document.getElementById('btnCancelar').addEventListener('click', fecharModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fecharModal(); });

  document.getElementById('btnNovaLoja').addEventListener('click', abrirModalLoja);
  document.getElementById('btnFecharLoja').addEventListener('click', fecharModalLoja);
  document.getElementById('btnFecharLoja2').addEventListener('click', fecharModalLoja);
  overlayLoja.addEventListener('click', (e) => { if (e.target === overlayLoja) fecharModalLoja(); });
  formLoja.addEventListener('submit', cadastrarNovaLoja);

  form.addEventListener('submit', salvarProjeto);
  btnExcluir.addEventListener('click', excluirProjeto);

  filtroLoja.addEventListener('change', renderizar);
  filtroStatus.addEventListener('change', renderizar);
  filtroMontagem.addEventListener('change', renderizar);
  filtroDataInicio.addEventListener('change', renderizar);
  filtroDataFim.addEventListener('change', renderizar);
  filtroBusca.addEventListener('input', renderizar);
  document.getElementById('btnLimparFiltros').addEventListener('click', limparFiltros);

  document.getElementById('btnExportExcel').addEventListener('click', () => exportar('excel'));
  document.getElementById('btnExportPdf').addEventListener('click', () => exportar('pdf'));

  btnConfig.addEventListener('click', (e) => {
    e.stopPropagation();
    menuConfig.hidden = !menuConfig.hidden;
  });
  document.addEventListener('click', (e) => {
    if (!menuConfig.hidden && !menuConfig.contains(e.target) && e.target !== btnConfig) {
      menuConfig.hidden = true;
    }
  });

  document.getElementById('btnBackup').addEventListener('click', () => { menuConfig.hidden = true; fazerBackup(); });
  document.getElementById('btnRestaurar').addEventListener('click', () => {
    menuConfig.hidden = true;
    const ok = confirm('Restaurar um backup vai SUBSTITUIR todos os dados e anexos atuais pelos do arquivo selecionado. Essa ação não pode ser desfeita. Deseja continuar?');
    if (ok) document.getElementById('fInputBackup').click();
  });
  document.getElementById('fInputBackup').addEventListener('change', restaurarBackup);

  document.getElementById('btnTirarFoto').addEventListener('click', tirarFoto);
  document.getElementById('btnEscolherGaleria').addEventListener('click', escolherDaGaleria);
  document.getElementById('btnEscolherPdf').addEventListener('click', () => document.getElementById('fInputPdf').click());
  document.getElementById('fInputPdf').addEventListener('change', escolherPdf);
  document.getElementById('btnAbrirAnexo').addEventListener('click', abrirAnexoAtual);
  document.getElementById('btnRemoverAnexo').addEventListener('click', removerAnexoAtual);
  document.getElementById('btnFecharLightbox').addEventListener('click', fecharLightbox);

  document.querySelectorAll('th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const campo = th.dataset.sort;
      if (sortEstado.campo === campo) {
        sortEstado.direcao = sortEstado.direcao === 'asc' ? 'desc' : 'asc';
      } else {
        sortEstado.campo = campo;
        sortEstado.direcao = 'asc';
      }
      renderizar();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!document.getElementById('lightbox').hidden) { fecharLightbox(); return; }
    if (!menuConfig.hidden) { menuConfig.hidden = true; return; }
    if (!overlayLoja.hidden) { fecharModalLoja(); return; }
    if (!overlay.hidden) fecharModal();
  });
}

function limparFiltros() {
  filtroLoja.value = '';
  filtroStatus.value = '';
  filtroMontagem.value = '';
  filtroDataInicio.value = '';
  filtroDataFim.value = '';
  filtroBusca.value = '';
  renderizar();
}

// ---------- Lojas ----------
async function carregarLojas() {
  const resultado = await window.api.listarLojas();
  lojasCache = resultado.ok ? resultado.lojas : [];
  preencherSelectLojas();
}

function preencherSelectLojas() {
  const atual = filtroLoja.value;
  filtroLoja.innerHTML = '<option value="">Todas</option>' +
    lojasCache.map((l) => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('');
  if (lojasCache.includes(atual)) filtroLoja.value = atual;
  document.getElementById('listaLojas').innerHTML =
    lojasCache.map((l) => `<option value="${escapeHtml(l)}"></option>`).join('');
}

function abrirModalLoja() {
  fNovaLoja.value = '';
  overlayLoja.hidden = false;
  fNovaLoja.focus();
  carregarListaLojasGerenciar();
}

function fecharModalLoja() {
  overlayLoja.hidden = true;
}

async function carregarListaLojasGerenciar() {
  listaLojasGerenciar.innerHTML = '<li class="lojas-lista-vazio">Carregando...</li>';
  const resultado = await window.api.listarLojasDetalhadas();
  if (!resultado.ok) {
    listaLojasGerenciar.innerHTML = `<li class="lojas-lista-vazio">${escapeHtml(resultado.message || 'Não foi possível carregar as lojas.')}</li>`;
    return;
  }
  renderizarListaLojasGerenciar(resultado.lojas);
}

function renderizarListaLojasGerenciar(lojas) {
  if (!lojas.length) {
    listaLojasGerenciar.innerHTML = '<li class="lojas-lista-vazio">Nenhuma loja cadastrada.</li>';
    return;
  }

  listaLojasGerenciar.innerHTML = lojas.map((l) => {
    const desabilitado = l.padrao || l.emUso;
    const motivo = l.padrao ? 'Padrão' : (l.emUso ? 'Em uso' : '');
    const titulo = l.padrao
      ? 'Loja padrão do sistema, não pode ser excluída'
      : (l.emUso ? 'Há registros usando essa loja — exclua ou edite-os antes' : 'Excluir loja');
    return `
      <li class="lojas-lista-item" data-loja="${escapeHtml(l.nome)}">
        <span>${escapeHtml(l.nome)}${motivo ? `<span class="loja-tag">${motivo}</span>` : ''}</span>
        <button type="button" class="btn-excluir-loja" title="${titulo}" ${desabilitado ? 'disabled' : ''}>✕</button>
      </li>
    `;
  }).join('');

  listaLojasGerenciar.querySelectorAll('.btn-excluir-loja:not(:disabled)').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const nome = e.target.closest('li').dataset.loja;
      excluirLojaHandler(nome);
    });
  });
}

async function excluirLojaHandler(nome) {
  const ok = confirm(`Excluir a loja "${nome}"? Essa ação não pode ser desfeita.`);
  if (!ok) return;

  const resultado = await window.api.excluirLoja(nome);
  if (!resultado.ok) {
    mostrarToast(resultado.message || 'Não foi possível excluir a loja.');
    return;
  }

  lojasCache = resultado.lojas;
  preencherSelectLojas();
  await carregarListaLojasGerenciar();
  mostrarToast(`Loja "${nome}" excluída.`);
}

async function cadastrarNovaLoja(e) {
  e.preventDefault();
  const limpo = fNovaLoja.value.trim();
  if (!limpo) return;

  const resultado = await window.api.adicionarLoja(limpo);
  if (!resultado.ok) {
    mostrarToast(resultado.message || 'Não foi possível cadastrar a loja.');
    return;
  }
  lojasCache = resultado.lojas;
  preencherSelectLojas();
  document.getElementById('fLoja').value = limpo;
  fNovaLoja.value = '';
  await carregarListaLojasGerenciar();
  mostrarToast(`Loja "${limpo}" cadastrada.`);
}

// ---------- Responsáveis ----------
async function carregarResponsaveis() {
  const resultado = await window.api.listarResponsaveis();
  const responsaveis = resultado.ok ? resultado.responsaveis : [];
  document.getElementById('listaResponsaveis').innerHTML =
    responsaveis.map((r) => `<option value="${escapeHtml(r)}"></option>`).join('');
}

// ---------- Projetos ----------
async function carregarProjetos() {
  const resultado = await window.api.listarProjetos();
  projetosCache = resultado.ok ? resultado.projetos : [];
  if (!resultado.ok) mostrarToast(resultado.message || 'Não foi possível carregar os registros.');
  renderizar();
}

// ---------- Filtro + render ----------
function projetosFiltrados() {
  const loja = filtroLoja.value;
  const status = filtroStatus.value;
  const montagem = filtroMontagem.value;
  const dataInicio = filtroDataInicio.value;
  const dataFim = filtroDataFim.value;
  const busca = filtroBusca.value.trim().toLowerCase();

  return projetosCache.filter((p) => {
    if (loja && p.loja !== loja) return false;
    if (status && calcularStatus(p) !== status) return false;
    if (montagem && (p.statusMontagem || 'andamento') !== montagem) return false;
    // Comparação de string funciona pois datetime-local já vem no formato ISO "YYYY-MM-DDTHH:MM"
    if (dataInicio && (p.dataEmissao || '') < dataInicio) return false;
    if (dataFim && (p.dataEmissao || '') > dataFim) return false;
    if (busca) {
      const alvo = `${p.numeroNota || ''} ${p.cliente || ''} ${p.endereco || ''} ${p.descricaoMovel || ''} ${p.responsavel || ''} ${p.observacoes || ''}`.toLowerCase();
      if (!alvo.includes(busca)) return false;
    }
    return true;
  });
}

function ordenarLista(lista) {
  const { campo, direcao } = sortEstado;
  const mult = direcao === 'asc' ? 1 : -1;

  return [...lista].sort((a, b) => {
    let va, vb;
    switch (campo) {
      case 'valorCobrado':
      case 'valorRecebido':
      case 'valorDeslocamento':
        va = Number(a[campo]) || 0;
        vb = Number(b[campo]) || 0;
        break;
      case 'diferenca':
        va = diferenca(a);
        vb = diferenca(b);
        va = va === null ? -Infinity : va;
        vb = vb === null ? -Infinity : vb;
        break;
      case 'status':
        va = calcularStatus(a);
        vb = calcularStatus(b);
        break;
      case 'statusMontagem':
        va = a.statusMontagem || 'andamento';
        vb = b.statusMontagem || 'andamento';
        break;
      case 'dataEmissao':
      case 'dataPagamento':
        va = a[campo] || '';
        vb = b[campo] || '';
        break;
      default:
        va = String(a[campo] || '').toLowerCase();
        vb = String(b[campo] || '').toLowerCase();
    }
    if (va < vb) return -1 * mult;
    if (va > vb) return 1 * mult;
    return 0;
  });
}

function atualizarIndicadoresOrdenacao() {
  document.querySelectorAll('th[data-sort]').forEach((th) => {
    th.classList.remove('th-sort-asc', 'th-sort-desc');
    if (th.dataset.sort === sortEstado.campo) {
      th.classList.add(sortEstado.direcao === 'asc' ? 'th-sort-asc' : 'th-sort-desc');
    }
  });
}

function renderizar() {
  const lista = projetosFiltrados();
  const listaOrdenada = ordenarLista(lista);
  atualizarIndicadoresOrdenacao();

  // cards resumo
  let totalCobrado = 0, totalRecebido = 0, totalDeslocamento = 0, pendentes = 0, divergencias = 0, andamento = 0;
  for (const p of lista) {
    const st = calcularStatus(p);
    totalCobrado += Number(p.valorCobrado) || 0;
    totalDeslocamento += Number(p.valorDeslocamento) || 0;
    if (p.valorRecebido !== '' && p.valorRecebido !== null && p.valorRecebido !== undefined) {
      totalRecebido += Number(p.valorRecebido) || 0;
    }
    if (st === 'pendente') pendentes++;
    if (st === 'divergencia') divergencias++;
    if ((p.statusMontagem || 'andamento') === 'andamento') andamento++;
  }
  document.getElementById('cardCobrado').textContent = formatarMoeda(totalCobrado);
  document.getElementById('cardRecebido').textContent = formatarMoeda(totalRecebido);
  document.getElementById('cardDiferenca').textContent = formatarMoeda(totalRecebido - totalCobrado);
  document.getElementById('cardPendentes').textContent = String(pendentes);
  document.getElementById('cardDivergencias').textContent = String(divergencias);
  document.getElementById('cardAndamento').textContent = String(andamento);
  document.getElementById('cardDeslocamento').textContent = formatarMoeda(totalDeslocamento);
  document.getElementById('cardTotalGeral').textContent = formatarMoeda(totalCobrado + totalDeslocamento);

  // tabela
  if (listaOrdenada.length === 0) {
    tbody.innerHTML = '';
    vazio.hidden = false;
    return;
  }
  vazio.hidden = true;

  tbody.innerHTML = listaOrdenada.map((p) => {
    const st = calcularStatus(p);
    const stMontagem = p.statusMontagem || 'andamento';
    const diff = diferenca(p);
    return `
      <tr data-id="${p.id}">
        <td>${escapeHtml(p.loja || '—')}</td>
        <td>${escapeHtml(p.cliente || '—')}</td>
        <td class="desc-cell">${escapeHtml(p.endereco || '—')}</td>
        <td>${escapeHtml(p.numeroNota || '—')}</td>
        <td class="desc-cell">${escapeHtml(p.descricaoMovel || '—')}${p.observacoes ? `<span class="obs">${escapeHtml(p.observacoes)}</span>` : ''}</td>
        <td>${escapeHtml(p.responsavel || '—')}</td>
        <td>${formatarDataHora(p.dataEmissao)}</td>
        <td>${formatarDataHora(p.dataPagamento)}</td>
        <td class="num">${formatarMoeda(p.valorCobrado)}</td>
        <td class="num">${p.valorRecebido === '' || p.valorRecebido == null ? '—' : formatarMoeda(p.valorRecebido)}</td>
        <td class="num">${p.valorDeslocamento ? formatarMoeda(p.valorDeslocamento) : '—'}</td>
        <td class="num">${diff === null ? '—' : formatarMoeda(diff)}</td>
        <td><span class="stamp stamp-${stMontagem}">${STATUS_MONTAGEM_LABEL[stMontagem]}</span></td>
        <td><span class="stamp stamp-${st}">${STATUS_LABEL[st]}</span></td>
        <td class="anexo-cell">${p.anexo ? `<button type="button" class="anexo-badge" data-anexo="${escapeHtml(p.anexo)}" title="Abrir comprovante/nota anexado">📎</button>` : '—'}</td>
        <td>
          <div class="row-actions">
            <button data-action="editar">Editar</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('button[data-action="editar"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.target.closest('tr').dataset.id;
      const projeto = projetosCache.find((p) => p.id === id);
      abrirModal(projeto);
    });
  });

  tbody.querySelectorAll('.anexo-badge').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const nomeArquivo = e.currentTarget.dataset.anexo;
      const resultado = await window.api.abrirAnexo(nomeArquivo);
      if (!resultado.ok) { mostrarToast(resultado.message || 'Não foi possível abrir o anexo.'); return; }
      if (resultado.tipo === 'imagem') abrirLightbox(resultado.url);
    });
  });
}

// ---------- Modal de projeto ----------
function abrirModal(projeto = null) {
  form.reset();
  document.getElementById('fId').value = '';
  btnExcluir.hidden = true;
  anexoParaRemoverAoSalvar = null;

  if (projeto) {
    modalTitulo.textContent = 'Editar registro';
    document.getElementById('fId').value = projeto.id;
    document.getElementById('fLoja').value = projeto.loja || '';
    document.getElementById('fCliente').value = projeto.cliente || '';
    document.getElementById('fEndereco').value = projeto.endereco || '';
    document.getElementById('fNumeroNota').value = projeto.numeroNota || '';
    document.getElementById('fResponsavel').value = projeto.responsavel || '';
    document.getElementById('fDescricao').value = projeto.descricaoMovel || '';
    document.getElementById('fStatusMontagem').value = projeto.statusMontagem || 'andamento';
    document.getElementById('fDataEmissao').value = projeto.dataEmissao || '';
    document.getElementById('fDataPagamento').value = projeto.dataPagamento || '';
    document.getElementById('fValorCobrado').value = projeto.valorCobrado ?? '';
    document.getElementById('fValorRecebido').value = projeto.valorRecebido ?? '';
    document.getElementById('fValorDeslocamento').value = projeto.valorDeslocamento ?? '';
    document.getElementById('fObservacoes').value = projeto.observacoes || '';
    anexoAtual = projeto.anexo || null;
    btnExcluir.hidden = false;
  } else {
    modalTitulo.textContent = 'Novo registro';
    document.getElementById('fStatusMontagem').value = 'andamento';
    anexoAtual = null;
  }

  atualizarUIAnexo();
  overlay.hidden = false;
  document.getElementById('fLoja').focus();
}

function fecharModal() {
  overlay.hidden = true;
}

// ---------- Anexo (comprovante / nota fiscal) ----------
function atualizarUIAnexo() {
  if (anexoAtual) {
    anexoVazio.hidden = true;
    anexoPreenchido.hidden = false;
    anexoNomeEl.textContent = `📎 ${anexoAtual}`;
  } else {
    anexoVazio.hidden = false;
    anexoPreenchido.hidden = true;
  }
}

function aplicarNovoAnexo(resultado) {
  if (anexoAtual && anexoAtual !== resultado.nomeArquivo) {
    anexoParaRemoverAoSalvar = anexoAtual;
  }
  anexoAtual = resultado.nomeArquivo;
  atualizarUIAnexo();
  mostrarToast('Arquivo anexado. Salve o registro para confirmar.');
}

async function tirarFoto() {
  const resultado = await window.api.tirarFoto();
  if (!resultado.ok) {
    if (!resultado.message || !resultado.message.toLowerCase().includes('cancel')) {
      mostrarToast(resultado.message || 'Não foi possível tirar a foto.');
    }
    return;
  }
  aplicarNovoAnexo(resultado);
}

async function escolherDaGaleria() {
  const resultado = await window.api.escolherDaGaleria();
  if (!resultado.ok) {
    if (!resultado.message || !resultado.message.toLowerCase().includes('cancel')) {
      mostrarToast(resultado.message || 'Não foi possível selecionar a foto.');
    }
    return;
  }
  aplicarNovoAnexo(resultado);
}

async function escolherPdf(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const resultado = await window.api.salvarArquivoPdf(file);
  if (!resultado.ok) {
    mostrarToast(resultado.message || 'Não foi possível anexar o PDF.');
    return;
  }
  aplicarNovoAnexo(resultado);
}

async function abrirAnexoAtual() {
  if (!anexoAtual) return;
  const resultado = await window.api.abrirAnexo(anexoAtual);
  if (!resultado.ok) { mostrarToast(resultado.message || 'Não foi possível abrir o anexo.'); return; }
  if (resultado.tipo === 'imagem') abrirLightbox(resultado.url);
}

function removerAnexoAtual() {
  if (!anexoAtual) return;
  anexoParaRemoverAoSalvar = anexoAtual;
  anexoAtual = null;
  atualizarUIAnexo();
}

function abrirLightbox(url) {
  document.getElementById('lightboxImg').src = url;
  document.getElementById('lightbox').hidden = false;
}

function fecharLightbox() {
  document.getElementById('lightbox').hidden = true;
  document.getElementById('lightboxImg').src = '';
}

async function salvarProjeto(e) {
  e.preventDefault();
  const projeto = {
    id: document.getElementById('fId').value || undefined,
    loja: document.getElementById('fLoja').value.trim(),
    cliente: document.getElementById('fCliente').value.trim(),
    endereco: document.getElementById('fEndereco').value.trim(),
    numeroNota: document.getElementById('fNumeroNota').value.trim(),
    responsavel: document.getElementById('fResponsavel').value.trim(),
    descricaoMovel: document.getElementById('fDescricao').value.trim(),
    statusMontagem: document.getElementById('fStatusMontagem').value,
    dataEmissao: document.getElementById('fDataEmissao').value,
    dataPagamento: document.getElementById('fDataPagamento').value || null,
    valorCobrado: parseFloat(document.getElementById('fValorCobrado').value) || 0,
    valorRecebido: document.getElementById('fValorRecebido').value === ''
      ? null
      : parseFloat(document.getElementById('fValorRecebido').value),
    valorDeslocamento: document.getElementById('fValorDeslocamento').value === ''
      ? null
      : parseFloat(document.getElementById('fValorDeslocamento').value),
    observacoes: document.getElementById('fObservacoes').value.trim(),
    anexo: anexoAtual,
  };

  const resultado = await window.api.salvarProjeto(projeto);
  if (!resultado.ok) {
    mostrarToast(resultado.message || 'Não foi possível salvar o registro.');
    return;
  }

  // Só agora que o registro foi salvo com sucesso é seguro apagar o arquivo antigo do disco
  if (anexoParaRemoverAoSalvar) {
    await window.api.removerAnexo(anexoParaRemoverAoSalvar);
    anexoParaRemoverAoSalvar = null;
  }

  projetosCache = resultado.projetos;
  await carregarLojas();
  await carregarResponsaveis();
  fecharModal();
  renderizar();
  mostrarToast('Registro salvo com sucesso.');
}

async function excluirProjeto() {
  const id = document.getElementById('fId').value;
  if (!id) return;
  const ok = confirm('Tem certeza que deseja excluir este registro? Essa ação não pode ser desfeita.');
  if (!ok) return;

  const resultado = await window.api.excluirProjeto(id);
  if (!resultado.ok) {
    mostrarToast(resultado.message || 'Não foi possível excluir o registro.');
    return;
  }

  projetosCache = resultado.projetos;
  fecharModal();
  renderizar();
  mostrarToast('Registro excluído.');
}

// ---------- Exportação ----------
async function exportar(tipo) {
  const lista = projetosFiltrados();
  if (lista.length === 0) {
    mostrarToast('Não há registros para exportar com os filtros atuais.');
    return;
  }

  mostrarToast('Gerando relatório...');
  const resultado = tipo === 'excel'
    ? await window.api.exportarExcel({ projetos: lista })
    : await window.api.exportarPdf({ projetos: lista });

  if (!resultado.ok) {
    mostrarToast(resultado.message || 'Não foi possível gerar o relatório.');
    return;
  }

  mostrarToast('Relatório pronto — escolha onde salvar ou enviar.');
}

// ---------- Backup / Restauração ----------
async function fazerBackup() {
  mostrarToast('Gerando backup...');
  const resultado = await window.api.backupExportar();
  if (!resultado.ok) {
    mostrarToast(resultado.message || 'Não foi possível gerar o backup.');
    return;
  }
  mostrarToast('Backup pronto — escolha onde salvar ou enviar.');
}

async function restaurarBackup(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;

  const resultado = await window.api.backupImportar(file);
  if (!resultado.ok) {
    mostrarToast(resultado.message || 'Não foi possível restaurar o backup.');
    return;
  }

  await carregarProjetos();
  await carregarLojas();
  await carregarResponsaveis();
  mostrarToast('Backup restaurado com sucesso.');
}

// ---------- Utilitários de UI ----------
let toastTimer = null;
function mostrarToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3800);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

init();
