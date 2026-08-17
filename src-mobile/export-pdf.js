import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

function calcularStatus(p) {
  const cobrado = Number(p.valorCobrado) || 0;
  const recebido = p.valorRecebido === '' || p.valorRecebido === null || p.valorRecebido === undefined ? null : Number(p.valorRecebido);
  if (recebido === null) return 'pendente';
  if (Math.abs(recebido - cobrado) < 0.01) return 'pago';
  return 'divergencia';
}
function diferenca(p) {
  const cobrado = Number(p.valorCobrado) || 0;
  const recebido = p.valorRecebido === '' || p.valorRecebido === null || p.valorRecebido === undefined ? null : Number(p.valorRecebido);
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
  return horaParte ? `${dataFormatada} ${horaParte}` : dataFormatada;
}
const STATUS_LABEL = { pendente: 'Pendente', pago: 'Pago', divergencia: 'Divergência' };
const STATUS_MONTAGEM_LABEL = { andamento: 'Em andamento', finalizado: 'Finalizado' };
const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function hex(c) {
  const n = parseInt(c.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const COLS = [
  { key: 'dataEmissao', label: 'Emissão', width: 70 },
  { key: 'numeroNota', label: 'Nota', width: 40 },
  { key: 'cliente', label: 'Cliente', width: 80 },
  { key: 'descricaoMovel', label: 'Descrição', width: 140 },
  { key: 'responsavel', label: 'Responsável', width: 65 },
  { key: 'valorCobrado', label: 'Cobrado', width: 60 },
  { key: 'valorRecebido', label: 'Recebido', width: 60 },
  { key: 'valorDeslocamento', label: 'Deslocam.', width: 60 },
  { key: 'diferenca', label: 'Diferença', width: 55 },
  { key: 'statusMontagem', label: 'Montagem', width: 65 },
  { key: 'status', label: 'Pagamento', width: 65 },
];
const MARGIN = 40;
const STATUS_COLOR = { pendente: '#8A6D00', pago: '#1E7A4C', divergencia: '#B3261E' };
const MONTAGEM_COLOR = { andamento: '#2B5F8A', finalizado: '#1E7A4C' };

export async function exportarPdf(projetos) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) throw new Error('Biblioteca de PDF não carregou corretamente.');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  let y = MARGIN;

  function checkPageBreak(needed) {
    if (y + needed > pageH - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  }

  function setFill(c) { doc.setFillColor(...hex(c)); }
  function setText(c) { doc.setTextColor(...hex(c)); }
  function setDraw(c) { doc.setDrawColor(...hex(c)); }

  // ---- Cabeçalho ----
  setText('#1c2128');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text('Relatório de Montagens e Notas', MARGIN, y);
  y += 18;
  setText('#555555');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} • ${projetos.length} projeto(s)`, MARGIN, y);
  y += 22;

  // ---- Totais ----
  let totalCobrado = 0, totalRecebido = 0, totalDeslocamento = 0, pendentes = 0, divergencias = 0, andamento = 0;
  for (const p of projetos) {
    const status = calcularStatus(p);
    totalCobrado += Number(p.valorCobrado) || 0;
    totalDeslocamento += Number(p.valorDeslocamento) || 0;
    if (p.valorRecebido !== '' && p.valorRecebido !== null && p.valorRecebido !== undefined) totalRecebido += Number(p.valorRecebido) || 0;
    if (status === 'divergencia') divergencias += 1;
    if (status === 'pendente') pendentes += 1;
    if ((p.statusMontagem || 'andamento') === 'andamento') andamento += 1;
  }

  const cardW = 95;
  const cards = [
    { label: 'Cobrado', value: formatarMoeda(totalCobrado), color: '#1c2128' },
    { label: 'Recebido', value: formatarMoeda(totalRecebido), color: '#1c2128' },
    { label: 'Diferença', value: formatarMoeda(totalRecebido - totalCobrado), color: totalRecebido - totalCobrado < 0 ? '#B3261E' : '#1E7A4C' },
    { label: 'Deslocamento', value: formatarMoeda(totalDeslocamento), color: '#1c2128' },
    { label: 'Total geral', value: formatarMoeda(totalCobrado + totalDeslocamento), color: '#1c2128' },
    { label: 'Pendentes', value: String(pendentes), color: '#8A6D00' },
    { label: 'Divergências', value: String(divergencias), color: '#B3261E' },
    { label: 'Em andamento', value: String(andamento), color: '#2B5F8A' },
  ];

  cards.forEach((c, i) => {
    const x = MARGIN + i * cardW;
    setFill('#F4F2ED'); setDraw('#DDD8CC');
    doc.roundedRect(x, y, cardW - 8, 50, 4, 4, 'FD');
    setText('#8a8375'); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.text(c.label.toUpperCase(), x + 8, y + 15, { maxWidth: cardW - 20 });
    setText(c.color); doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5);
    doc.text(c.value, x + 8, y + 33, { maxWidth: cardW - 20 });
  });
  y += 66;

  // ---- Gráfico mensal: Cobrado x Recebido ----
  y = drawMonthlyChart(doc, projetos, y, pageW, { setFill, setText, setDraw, checkPageBreak });

  // ---- Tabela agrupada por loja ----
  const porLoja = agruparPorLoja(projetos);
  for (const [loja, itens] of porLoja) {
    checkPageBreak(26);
    setText('#1c2128'); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(loja, MARGIN, y + 8);
    y += 20;
    y = drawTableHeader(doc, y, { setFill, setText });

    itens.forEach((p, idx) => {
      checkPageBreak(20);
      if (y === MARGIN) y = drawTableHeader(doc, y, { setFill, setText });
      y = drawRow(doc, p, idx, y, { setFill, setText });
    });
  }

  const pdfBlob = doc.output('blob');
  const base64 = await blobParaBase64(pdfBlob);

  const nomeArquivo = `relatorio-montagens-${new Date().toISOString().slice(0, 10)}.pdf`;
  const { uri } = await Filesystem.writeFile({ path: nomeArquivo, directory: Directory.Cache, data: base64 });

  await Share.share({
    title: 'Relatório de Montagens',
    text: 'Relatório exportado do Controle de Montagens',
    url: uri,
    dialogTitle: 'Salvar ou enviar relatório PDF',
  });

  return { filePath: uri };
}

function agruparPorLoja(projetos) {
  const map = new Map();
  for (const p of projetos) {
    const loja = p.loja || 'Sem loja definida';
    if (!map.has(loja)) map.set(loja, []);
    map.get(loja).push(p);
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
}

function agruparPorMes(projetos) {
  const map = new Map();
  for (const p of projetos) {
    if (!p.dataEmissao) continue;
    const mes = String(p.dataEmissao).slice(0, 7);
    if (!map.has(mes)) map.set(mes, { cobrado: 0, recebido: 0 });
    const agg = map.get(mes);
    agg.cobrado += Number(p.valorCobrado) || 0;
    if (p.valorRecebido !== '' && p.valorRecebido !== null && p.valorRecebido !== undefined) agg.recebido += Number(p.valorRecebido) || 0;
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

function formatarMesLabel(mesStr) {
  const [ano, mes] = mesStr.split('-');
  const idx = parseInt(mes, 10) - 1;
  return `${MESES_ABREV[idx] || mes}/${ano.slice(2)}`;
}

function drawMonthlyChart(doc, projetos, startY, pageW, ctx) {
  const width = COLS.reduce((s, c) => s + c.width, 0);
  const dados = agruparPorMes(projetos);
  const chartH = 130;
  ctx.checkPageBreak(34 + chartH + 24 + 10);

  const x0 = MARGIN;
  ctx.setText('#1c2128'); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('Evolução mensal — Cobrado x Recebido', x0, startY);

  ctx.setFill('#2B3A45'); doc.rect(x0 + width - 190, startY - 8, 9, 9, 'F');
  ctx.setText('#2b2b2b'); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.text('Cobrado', x0 + width - 176, startY);
  ctx.setFill('#B5651D'); doc.rect(x0 + width - 100, startY - 8, 9, 9, 'F');
  doc.text('Recebido', x0 + width - 86, startY);

  const chartY0 = startY + 24;
  const baseY = chartY0 + chartH;

  if (dados.length === 0) {
    ctx.setText('#8a8375'); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text('Sem dados suficientes para exibir o gráfico com os filtros atuais.', x0, chartY0 + chartH / 2);
    return baseY + 24;
  }

  const maxVal = Math.max(1, ...dados.flatMap(([, v]) => [v.cobrado, v.recebido]));
  const groupW = width / dados.length;
  const barW = Math.max(6, Math.min(22, groupW * 0.32));
  const gap = 3;

  doc.setDrawColor(...hex('#DDD8CC')); doc.setLineWidth(1);
  doc.line(x0, baseY, x0 + width, baseY);

  dados.forEach(([mes, v], i) => {
    const groupCenterX = x0 + i * groupW + groupW / 2;
    const hCobrado = (v.cobrado / maxVal) * (chartH - 8);
    const hRecebido = (v.recebido / maxVal) * (chartH - 8);
    const xCobrado = groupCenterX - barW - gap / 2;
    const xRecebido = groupCenterX + gap / 2;

    if (hCobrado > 0.5) { ctx.setFill('#2B3A45'); doc.rect(xCobrado, baseY - hCobrado, barW, hCobrado, 'F'); }
    if (hRecebido > 0.5) { ctx.setFill('#B5651D'); doc.rect(xRecebido, baseY - hRecebido, barW, hRecebido, 'F'); }

    ctx.setText('#6b6558'); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
    doc.text(formatarMesLabel(mes), groupCenterX, baseY + 12, { align: 'center' });
  });

  return baseY + 20;
}

function drawTableHeader(doc, y, ctx) {
  let x = MARGIN;
  const width = COLS.reduce((s, c) => s + c.width, 0);
  ctx.setFill('#2B3A45');
  doc.rect(MARGIN, y, width, 18, 'F');
  ctx.setText('#FFFFFF'); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
  COLS.forEach((c) => {
    doc.text(c.label, x + 4, y + 12);
    x += c.width;
  });
  return y + 18;
}

function drawRow(doc, p, idx, y, ctx) {
  const status = calcularStatus(p);
  const montagem = p.statusMontagem || 'andamento';
  const diff = diferenca(p);
  const rowH = 18;
  let x = MARGIN;
  const width = COLS.reduce((s, c) => s + c.width, 0);

  if (idx % 2 === 0) { ctx.setFill('#F7F5F1'); doc.rect(MARGIN, y, width, rowH, 'F'); }

  const values = {
    dataEmissao: formatarDataHora(p.dataEmissao),
    numeroNota: p.numeroNota || '—',
    cliente: p.cliente || '—',
    descricaoMovel: p.descricaoMovel || '—',
    responsavel: p.responsavel || '—',
    valorCobrado: formatarMoeda(p.valorCobrado),
    valorRecebido: p.valorRecebido === '' || p.valorRecebido == null ? '—' : formatarMoeda(p.valorRecebido),
    valorDeslocamento: p.valorDeslocamento ? formatarMoeda(p.valorDeslocamento) : '—',
    diferenca: diff === null ? '—' : formatarMoeda(diff),
    statusMontagem: STATUS_MONTAGEM_LABEL[montagem],
    status: STATUS_LABEL[status],
  };

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  COLS.forEach((c) => {
    let color = '#2b2b2b';
    if (c.key === 'status') color = STATUS_COLOR[status];
    if (c.key === 'statusMontagem') color = MONTAGEM_COLOR[montagem];
    ctx.setText(color);
    const texto = String(values[c.key]);
    doc.text(doc.splitTextToSize(texto, c.width - 8)[0] || '', x + 4, y + 12);
    x += c.width;
  });

  return y + rowH;
}

function blobParaBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
