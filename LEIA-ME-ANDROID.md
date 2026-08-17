# Controle de Montagens — Android

Este é o projeto completo do app Android, construído com **Capacitor** (reaproveita a mesma interface do app desktop, mas roda 100% offline no celular, com câmera, arquivos e compartilhamento nativos do Android).

## O que já está pronto
- Cadastro completo (mesmos campos do desktop: loja, cliente, endereço, nota, responsável, valores, deslocamento, status de montagem)
- Filtros, busca e ordenação por coluna
- Gerenciar lojas (adicionar/excluir)
- Anexo de comprovante/nota: **tirar foto na hora**, **escolher da galeria**, ou **escolher um PDF**
- Visualizar anexo (fotos abrem numa tela cheia dentro do app; PDFs abrem no navegador interno)
- Exportar Excel e PDF (com o mesmo gráfico mensal do desktop) — no celular, em vez de "salvar arquivo", abre o menu de **compartilhar** do Android (você escolhe: salvar no Drive, mandar por WhatsApp, e-mail, etc.)
- Backup (gera um `.zip` com todos os dados + anexos, compartilhável) e Restauração (escolhe um `.zip` e substitui os dados atuais)
- Tudo funciona **sem internet** — os dados ficam salvos só no celular

## O que eu não consegui testar diretamente
Não tenho acesso a um celular Android real nem ao SDK do Android aqui no meu ambiente de trabalho, então não rodei o app dentro de um Android de verdade. Testei toda a lógica (cadastro, duplicidade, exportação, backup) rodando o mesmo código dentro de um navegador Chromium, que é a mesma engine que roda dentro do Android — e tudo funcionou. As únicas partes que só existem em hardware real (câmera, escolher foto da galeria, o menu de compartilhamento do Android) eu não pude clicar de verdade, mas o código que aciona cada uma delas usa os plugins oficiais do Capacitor exatamente como a documentação deles indica.

Recomendo, depois de instalar o app, testar com calma: cadastrar um registro de teste, tirar uma foto, exportar um PDF e ver se abre a tela de compartilhar. Se algo não funcionar exatamente como esperado, me manda o que aconteceu que eu ajusto.

## Pré-requisitos
1. Baixar e instalar o **Android Studio** (gratuito): https://developer.android.com/studio
2. Ter o **Node.js** instalado no computador onde você vai compilar (https://nodejs.org) — qualquer versão recente serve

## Passo a passo para gerar o APK

### 1. Extrair o projeto
Descompacte o zip em qualquer pasta do seu computador.

### 2. Instalar as dependências
Abra um terminal dentro da pasta do projeto e rode:
```
npm install
```

### 3. Abrir no Android Studio
```
npx cap open android
```
Isso abre o Android Studio direto na pasta `android/` do projeto. **Na primeira vez**, o Android Studio vai baixar automaticamente o Gradle e o SDK do Android — isso demora alguns minutos e precisa de internet (só nessa primeira vez).

### 4. Esperar o "Gradle Sync"
Um aviso vai aparecer na parte de baixo da tela ("Gradle sync"). Espera terminar (pode levar alguns minutos na primeira vez).

### 5a. Testar direto no celular (mais fácil pra conferir se está tudo certo)
1. No celular: Configurações → Sobre o telefone → toque 7 vezes em "Número da versão" (ativa o modo desenvolvedor)
2. Configurações → Opções do desenvolvedor → ativar "Depuração USB"
3. Conectar o celular no computador via cabo USB
4. No Android Studio, o nome do celular vai aparecer no topo, do lado do botão verde de "play" (▶). Clica nele.
5. O app instala e abre sozinho no celular.

### 5b. Gerar o APK final (para instalar sem cabo, ou mandar pra outro celular)
1. No menu do Android Studio: **Build → Generate Signed Bundle / APK**
2. Escolha **APK** → Next
3. Clique em **Create new...** para criar uma chave de assinatura (só precisa fazer isso uma vez — guarde o arquivo `.jks` gerado e a senha em local seguro, você vai precisar dele se um dia quiser atualizar o app mantendo os dados/permissões)
4. Preencha os dados solicitados (podem ser fictícios, tipo "Gabriel Sperber" / "Controle de Montagens")
5. Escolha a variante **release**
6. Clique em **Finish** e espere compilar
7. O Android Studio mostra uma notificação "APK gerado" com um link **locate** — clique nele pra abrir a pasta onde está o arquivo `app-release.apk`

### 6. Instalar no celular
Copie o `app-release.apk` pro celular (por cabo, WhatsApp Web, e-mail, Google Drive — qualquer jeito) e abra o arquivo no celular. O Android vai avisar que é de "fonte desconhecida" (normal, porque não veio da Play Store) — é só permitir a instalação.

## Se quiser mudar o ícone ou nome depois
- Nome: `android/app/src/main/res/values/strings.xml`
- Ícone: `android/app/src/main/res/mipmap-*` (ou usar Android Studio: botão direito em `res` → New → Image Asset)

## Estrutura do projeto (caso eu ou você precise mexer no código depois)
- `www/` — a interface do app (HTML/CSS/JS), quase idêntica à versão desktop
- `src-mobile/` — o código-fonte da camada que conecta a interface aos recursos do celular (câmera, arquivos, compartilhamento). Depois de editar algo aqui, rode:
  ```
  npx esbuild src-mobile/api.js --bundle --format=iife --platform=browser --outfile=www/api.js
  npx cap sync android
  ```
- `android/` — o projeto Android nativo gerado pelo Capacitor
