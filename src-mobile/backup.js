import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { ANEXOS_PATH, garantirPastaAnexos } from './storage.js';

function base64ParaUint8(base64) {
  const bin = window.atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function fazerBackup() {
  const JSZip = window.JSZip;
  if (!JSZip) throw new Error('Biblioteca de backup não carregou corretamente.');

  const zip = new JSZip();

  let projetosJson = '{"version":2,"projetos":[],"lojasExtras":[]}';
  try {
    const res = await Filesystem.readFile({ path: 'projetos.json', directory: Directory.Data, encoding: 'utf8' });
    projetosJson = res.data;
  } catch (_) {
    // ainda não existe nenhum dado - backup vazio, tudo bem
  }
  zip.file('projetos.json', projetosJson);

  try {
    const listagem = await Filesystem.readdir({ path: ANEXOS_PATH, directory: Directory.Data });
    const pastaAnexos = zip.folder('anexos');
    for (const item of listagem.files) {
      if (item.type !== 'file') continue;
      const arq = await Filesystem.readFile({ path: `${ANEXOS_PATH}/${item.name}`, directory: Directory.Data });
      pastaAnexos.file(item.name, arq.data, { base64: true });
    }
  } catch (_) {
    // sem pasta de anexos ainda - tudo bem
  }

  const base64Zip = await zip.generateAsync({ type: 'base64' });
  const nomeArquivo = `backup-controle-montagens-${new Date().toISOString().slice(0, 10)}.zip`;
  const { uri } = await Filesystem.writeFile({ path: nomeArquivo, directory: Directory.Cache, data: base64Zip });

  await Share.share({
    title: 'Backup - Controle de Montagens',
    text: 'Guarde este arquivo em um local seguro (Google Drive, e-mail, etc.)',
    url: uri,
    dialogTitle: 'Salvar ou enviar backup',
  });

  return { filePath: uri };
}

// Recebe um File (.zip) vindo de um <input type="file" accept=".zip">
export async function restaurarBackup(file) {
  const JSZip = window.JSZip;
  if (!JSZip) throw new Error('Biblioteca de backup não carregou corretamente.');

  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const jsonEntry = zip.file('projetos.json');
  if (!jsonEntry) {
    throw new Error('Esse arquivo não parece ser um backup válido (projetos.json não encontrado dentro do zip).');
  }
  const jsonTexto = await jsonEntry.async('text');

  await Filesystem.writeFile({ path: 'projetos.json', directory: Directory.Data, data: jsonTexto, encoding: 'utf8' });

  // Limpa e recria a pasta de anexos
  try {
    const listagemAtual = await Filesystem.readdir({ path: ANEXOS_PATH, directory: Directory.Data });
    for (const item of listagemAtual.files) {
      if (item.type === 'file') {
        await Filesystem.deleteFile({ path: `${ANEXOS_PATH}/${item.name}`, directory: Directory.Data });
      }
    }
  } catch (_) {
    // pasta não existia - tudo bem
  }
  await garantirPastaAnexos();

  const arquivosAnexo = Object.keys(zip.files).filter((nome) => nome.startsWith('anexos/') && !zip.files[nome].dir);
  for (const nome of arquivosAnexo) {
    const nomeArquivo = nome.replace('anexos/', '');
    if (!nomeArquivo) continue;
    const base64 = await zip.files[nome].async('base64');
    await Filesystem.writeFile({ path: `${ANEXOS_PATH}/${nomeArquivo}`, directory: Directory.Data, data: base64 });
  }

  return {};
}
