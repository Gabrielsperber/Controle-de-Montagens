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

const STATUS_LABEL = { pendente: 'Pendente', pago: 'Pago', divergencia: 'Divergência' };
const STATUS_MONTAGEM_LABEL = { andamento: 'Em andamento', finalizado: 'Finalizado' };

function formatarDataHoraBR(iso) {
  const [dataParte, horaParte] = String(iso || '').split('T');
  const [ano, mes, dia] = (dataParte || '').split('-');
  if (!ano || !mes || !dia) return iso || '';
  const data = `${dia}/${mes}/${ano}`;
  return horaParte ? `${data} ${horaParte}` : data;
}

export async function exportarExcel(projetos) {
  const ExcelJS = window.ExcelJS;
  if (!ExcelJS) throw new Error('Biblioteca de Excel não carregou corretamente.');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Controle de Montagens';
  wb.created = new Date();

  const ws = wb.addWorksheet('Projetos', { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.columns = [
    { header: 'Loja', key: 'loja', width: 20 },
    { header: 'Cliente', key: 'cliente', width: 20 },
    { header: 'Endereço', key: 'endereco', width: 28 },
    { header: 'Nº da Nota', key: 'numeroNota', width: 12 },
    { header: 'Descrição do Móvel', key: 'descricaoMovel', width: 32 },
    { header: 'Responsável', key: 'responsavel', width: 16 },
    { header: 'Data/Hora Emissão', key: 'dataEmissao', width: 18 },
    { header: 'Data/Hora Pagamento', key: 'dataPagamento', width: 18 },
    { header: 'Valor Cobrado', key: 'valorCobrado', width: 14 },
    { header: 'Valor Recebido', key: 'valorRecebido', width: 14 },
    { header: 'Deslocamento', key: 'valorDeslocamento', width: 14 },
    { header: 'Diferença', key: 'diferenca', width: 13 },
    { header: 'Montagem', key: 'statusMontagem', width: 14 },
    { header: 'Pagamento', key: 'status', width: 14 },
    { header: 'Anexo', key: 'anexo', width: 10 },
    { header: 'Observações', key: 'observacoes', width: 30 },
  ];

  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B3A45' } };

  let totalCobrado = 0, totalRecebido = 0, totalDeslocamento = 0, totalDivergencias = 0;

  for (const p of projetos) {
    const status = calcularStatus(p);
    const diff = diferenca(p);
    totalCobrado += Number(p.valorCobrado) || 0;
    totalDeslocamento += Number(p.valorDeslocamento) || 0;
    if (p.valorRecebido !== '' && p.valorRecebido !== null && p.valorRecebido !== undefined) {
      totalRecebido += Number(p.valorRecebido) || 0;
    }
    if (status === 'divergencia') totalDivergencias += 1;

    const row = ws.addRow({
      loja: p.loja || '',
      cliente: p.cliente || '',
      endereco: p.endereco || '',
      numeroNota: p.numeroNota || '',
      descricaoMovel: p.descricaoMovel || '',
      responsavel: p.responsavel || '',
      dataEmissao: p.dataEmissao ? formatarDataHoraBR(p.dataEmissao) : '',
      dataPagamento: p.dataPagamento ? formatarDataHoraBR(p.dataPagamento) : '',
      valorCobrado: Number(p.valorCobrado) || 0,
      valorRecebido: p.valorRecebido === '' || p.valorRecebido == null ? null : Number(p.valorRecebido),
      valorDeslocamento: p.valorDeslocamento ? Number(p.valorDeslocamento) : null,
      diferenca: diff,
      statusMontagem: STATUS_MONTAGEM_LABEL[p.statusMontagem || 'andamento'],
      status: STATUS_LABEL[status],
      anexo: p.anexo ? 'Sim' : 'Não',
      observacoes: p.observacoes || '',
    });

    ['valorCobrado', 'valorRecebido', 'valorDeslocamento', 'diferenca'].forEach((k) => {
      row.getCell(k).numFmt = '"R$" #,##0.00';
    });
  }

  ws.addRow({});
  const totalRow = ws.addRow({
    descricaoMovel: 'TOTAIS',
    valorCobrado: totalCobrado,
    valorRecebido: totalRecebido,
    valorDeslocamento: totalDeslocamento,
    diferenca: totalRecebido - totalCobrado,
  });
  totalRow.font = { bold: true };
  ['valorCobrado', 'valorRecebido', 'valorDeslocamento', 'diferenca'].forEach((k) => {
    totalRow.getCell(k).numFmt = '"R$" #,##0.00';
  });
  ws.addRow({ descricaoMovel: `Projetos com divergência: ${totalDivergencias}` });

  const buffer = await wb.xlsx.writeBuffer();
  const base64 = arrayBufferParaBase64(buffer);

  const nomeArquivo = `relatorio-montagens-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const { uri } = await Filesystem.writeFile({
    path: nomeArquivo,
    directory: Directory.Cache,
    data: base64,
  });

  await Share.share({
    title: 'Relatório de Montagens',
    text: 'Relatório exportado do Controle de Montagens',
    url: uri,
    dialogTitle: 'Salvar ou enviar relatório Excel',
  });

  return { filePath: uri };
}

function arrayBufferParaBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return window.btoa(binary);
}
