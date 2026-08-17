import { Filesystem, Directory } from '@capacitor/filesystem';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { ANEXOS_PATH, garantirPastaAnexos } from './storage.js';

const DATA_DIR = Directory.Data;

function gerarNomeArquivo(ext) {
  const uuid = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  return `${uuid}${ext}`;
}

function extensaoImagem(formato) {
  const f = String(formato || 'jpeg').toLowerCase();
  return f === 'jpeg' ? '.jpg' : `.${f}`;
}

// Tira uma foto na hora (câmera) e salva na pasta de anexos do app
export async function tirarFoto() {
  await garantirPastaAnexos();
  const foto = await Camera.getPhoto({
    quality: 82,
    resultType: CameraResultType.Base64,
    source: CameraSource.Camera,
    saveToGallery: false,
  });
  return salvarFotoBase64(foto);
}

// Escolhe uma foto já existente na galeria do celular
export async function escolherDaGaleria() {
  await garantirPastaAnexos();
  const foto = await Camera.getPhoto({
    quality: 82,
    resultType: CameraResultType.Base64,
    source: CameraSource.Photos,
  });
  return salvarFotoBase64(foto);
}

async function salvarFotoBase64(foto) {
  const ext = extensaoImagem(foto.format);
  const nomeArquivo = gerarNomeArquivo(ext);
  await Filesystem.writeFile({
    path: `${ANEXOS_PATH}/${nomeArquivo}`,
    directory: DATA_DIR,
    data: foto.base64String,
  });
  return { nomeArquivo, nomeOriginal: nomeArquivo, tipo: 'imagem' };
}

// Recebe um File (vindo de um <input type="file" accept="application/pdf">) e copia para os anexos
export async function salvarArquivoPdf(file) {
  await garantirPastaAnexos();
  const base64 = await fileParaBase64(file);
  const nomeArquivo = gerarNomeArquivo('.pdf');
  await Filesystem.writeFile({
    path: `${ANEXOS_PATH}/${nomeArquivo}`,
    directory: DATA_DIR,
    data: base64,
  });
  return { nomeArquivo, nomeOriginal: file.name, tipo: 'pdf' };
}

function fileParaBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function removerAnexo(nomeArquivo) {
  if (!nomeArquivo) return;
  try {
    await Filesystem.deleteFile({ path: `${ANEXOS_PATH}/${nomeArquivo}`, directory: DATA_DIR });
  } catch (_) {
    // arquivo já não existe - tudo bem
  }
}

function ehImagem(nomeArquivo) {
  return /\.(jpe?g|png|webp|gif)$/i.test(nomeArquivo || '');
}

// Abre o anexo: imagens mostram em um visualizador dentro do próprio app (lightbox);
// PDFs abrem no navegador in-app (o Android normalmente já sabe exibir PDF nesse modo)
export async function abrirAnexo(nomeArquivo) {
  const res = await Filesystem.getUri({ path: `${ANEXOS_PATH}/${nomeArquivo}`, directory: DATA_DIR });
  const uriWeb = Capacitor.convertFileSrc(res.uri);

  if (ehImagem(nomeArquivo)) {
    return { tipo: 'imagem', url: uriWeb };
  }

  await Browser.open({ url: uriWeb });
  return { tipo: 'pdf', url: uriWeb };
}
