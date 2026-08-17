import * as storage from './storage.js';
import * as anexos from './anexos.js';
import { exportarExcel } from './export-excel.js';
import { exportarPdf } from './export-pdf.js';
import { fazerBackup, restaurarBackup } from './backup.js';

// Envelope padrão { ok, message? } igual ao usado no app desktop,
// para o renderer.js poder ser reaproveitado quase sem alterações.
function envolver(fn) {
  return async (...args) => {
    try {
      const resultado = await fn(...args);
      return { ok: true, ...resultado };
    } catch (err) {
      console.error(err);
      return { ok: false, message: (err && err.message) || 'Ocorreu um erro inesperado.' };
    }
  };
}

window.api = {
  listarProjetos: envolver(async () => ({ projetos: await storage.listar() })),
  salvarProjeto: envolver(async (projeto) => ({ projetos: await storage.salvar(projeto) })),
  excluirProjeto: envolver(async (id) => ({ projetos: await storage.excluir(id) })),

  listarLojas: envolver(async () => ({ lojas: await storage.listarLojas() })),
  listarLojasDetalhadas: envolver(async () => ({ lojas: await storage.listarLojasDetalhadas() })),
  adicionarLoja: envolver(async (nome) => ({ lojas: await storage.adicionarLoja(nome) })),
  excluirLoja: envolver(async (nome) => ({ lojas: await storage.excluirLoja(nome) })),

  listarResponsaveis: envolver(async () => ({ responsaveis: await storage.listarResponsaveis() })),

  // Específico do mobile: escolha explícita da origem do anexo
  tirarFoto: envolver(async () => anexos.tirarFoto()),
  escolherDaGaleria: envolver(async () => anexos.escolherDaGaleria()),
  salvarArquivoPdf: envolver(async (file) => anexos.salvarArquivoPdf(file)),
  abrirAnexo: envolver(async (nomeArquivo) => anexos.abrirAnexo(nomeArquivo)),
  removerAnexo: envolver(async (nomeArquivo) => { await anexos.removerAnexo(nomeArquivo); return {}; }),

  exportarExcel: envolver(async ({ projetos }) => exportarExcel(projetos)),
  exportarPdf: envolver(async ({ projetos }) => exportarPdf(projetos)),

  backupExportar: envolver(async () => fazerBackup()),
  backupImportar: envolver(async (file) => restaurarBackup(file)),
};

window.dispatchEvent(new Event('api-pronta'));
