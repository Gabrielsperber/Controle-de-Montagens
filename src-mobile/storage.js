import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

const DATA_DIR = Directory.Data; // armazenamento privado do app, persiste entre sessões, funciona 100% offline
const DATA_FILE = 'projetos.json';
export const ANEXOS_PATH = 'anexos';

const DEFAULT_LOJAS = ['Valdir Móveis'];

function normalizar(str) {
  return String(str || '').trim().toLowerCase();
}

function formatarDataCurta(iso) {
  if (!iso) return 'data não informada';
  const [dataParte] = String(iso).split('T');
  const [ano, mes, dia] = (dataParte || '').split('-');
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

function gerarId() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

async function garantirPastaAnexos() {
  try {
    await Filesystem.mkdir({ path: ANEXOS_PATH, directory: DATA_DIR, recursive: true });
  } catch (_) {
    // já existe - ok
  }
}

function estadoPadrao() {
  return { version: 2, projetos: [], lojasExtras: [] };
}

async function lerEstado() {
  try {
    const res = await Filesystem.readFile({ path: DATA_FILE, directory: DATA_DIR, encoding: Encoding.UTF8 });
    const raw = typeof res.data === 'string' ? res.data : '';
    if (!raw.trim()) return estadoPadrao();
    const dados = JSON.parse(raw);
    if (Array.isArray(dados)) return { version: 2, projetos: dados, lojasExtras: [] };
    if (!dados.projetos) dados.projetos = [];
    if (!dados.lojasExtras) dados.lojasExtras = [];
    return dados;
  } catch (err) {
    return estadoPadrao();
  }
}

async function salvarEstado(estado) {
  await Filesystem.writeFile({
    path: DATA_FILE,
    directory: DATA_DIR,
    data: JSON.stringify(estado, null, 2),
    encoding: Encoding.UTF8,
  });
}

export async function listar() {
  const { projetos } = await lerEstado();
  return [...projetos].sort((a, b) => (b.dataEmissao || '').localeCompare(a.dataEmissao || ''));
}

export async function salvar(projeto) {
  await garantirPastaAnexos();
  const estado = await lerEstado();
  const agora = new Date().toISOString();

  if (!projeto.loja || !projeto.numeroNota || !projeto.descricaoMovel || !projeto.dataEmissao) {
    throw new Error('Preencha os campos obrigatórios: loja, número da nota, descrição do móvel e data de emissão.');
  }

  const duplicada = estado.projetos.find(
    (p) =>
      p.id !== projeto.id &&
      normalizar(p.loja) === normalizar(projeto.loja) &&
      normalizar(p.numeroNota) === normalizar(projeto.numeroNota)
  );
  if (duplicada) {
    throw new Error(
      `Já existe um registro com a nota nº "${projeto.numeroNota}" para a loja "${projeto.loja}" (cadastrado em ${formatarDataCurta(duplicada.dataEmissao)}). Confira antes de salvar novamente.`
    );
  }

  if (projeto.id) {
    const idx = estado.projetos.findIndex((p) => p.id === projeto.id);
    if (idx === -1) throw new Error('Projeto não encontrado.');
    estado.projetos[idx] = { ...estado.projetos[idx], ...projeto, updatedAt: agora };
  } else {
    projeto.id = gerarId();
    projeto.createdAt = agora;
    projeto.updatedAt = agora;
    estado.projetos.push(projeto);
  }

  if (projeto.loja && !estado.lojasExtras.some((l) => normalizar(l) === normalizar(projeto.loja))) {
    if (!DEFAULT_LOJAS.some((l) => normalizar(l) === normalizar(projeto.loja))) {
      estado.lojasExtras.push(projeto.loja);
    }
  }

  await salvarEstado(estado);
  return listar();
}

export async function excluir(id) {
  const estado = await lerEstado();
  const alvo = estado.projetos.find((p) => p.id === id);
  estado.projetos = estado.projetos.filter((p) => p.id !== id);
  await salvarEstado(estado);

  if (alvo && alvo.anexo) {
    try {
      await Filesystem.deleteFile({ path: `${ANEXOS_PATH}/${alvo.anexo}`, directory: DATA_DIR });
    } catch (_) {
      // arquivo já não existe - tudo bem
    }
  }

  return listar();
}

export async function listarLojas() {
  const estado = await lerEstado();
  const doProjetos = estado.projetos.map((p) => p.loja).filter(Boolean);
  const todas = new Set([...DEFAULT_LOJAS, ...estado.lojasExtras, ...doProjetos]);
  return Array.from(todas).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export async function listarLojasDetalhadas() {
  const estado = await lerEstado();
  const nomes = await listarLojas();
  return nomes.map((nome) => ({
    nome,
    padrao: DEFAULT_LOJAS.some((l) => normalizar(l) === normalizar(nome)),
    emUso: estado.projetos.some((p) => normalizar(p.loja) === normalizar(nome)),
  }));
}

export async function adicionarLoja(nome) {
  const limpo = String(nome || '').trim();
  if (!limpo) throw new Error('Informe um nome de loja válido.');

  const estado = await lerEstado();
  const jaExiste = [...DEFAULT_LOJAS, ...estado.lojasExtras].some((l) => normalizar(l) === normalizar(limpo));
  if (jaExiste) throw new Error('Essa loja já está cadastrada.');

  estado.lojasExtras.push(limpo);
  await salvarEstado(estado);
  return listarLojas();
}

export async function excluirLoja(nome) {
  const limpo = String(nome || '').trim();
  if (!limpo) throw new Error('Informe a loja a ser excluída.');

  if (DEFAULT_LOJAS.some((l) => normalizar(l) === normalizar(limpo))) {
    throw new Error(`"${limpo}" é uma loja padrão do sistema e não pode ser excluída.`);
  }

  const estado = await lerEstado();
  const emUso = estado.projetos.filter((p) => normalizar(p.loja) === normalizar(limpo));
  if (emUso.length > 0) {
    throw new Error(
      `Não é possível excluir "${limpo}": há ${emUso.length} registro(s) cadastrado(s) para essa loja. Edite ou exclua esses registros antes.`
    );
  }

  const idx = estado.lojasExtras.findIndex((l) => normalizar(l) === normalizar(limpo));
  if (idx === -1) throw new Error(`Loja "${limpo}" não encontrada.`);

  estado.lojasExtras.splice(idx, 1);
  await salvarEstado(estado);
  return listarLojas();
}

export async function listarResponsaveis() {
  const { projetos } = await lerEstado();
  const nomes = new Set(projetos.map((p) => p.responsavel).filter(Boolean));
  return Array.from(nomes).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export { DATA_DIR, DATA_FILE, garantirPastaAnexos };
