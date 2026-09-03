# Contador de clientes na cadeira (v29.46.0)

Conta quantas pessoas sentam na cadeira por dia e permite cruzar com os atendimentos
registrados. Roda numa máquina da barbearia, lendo a câmera IP por RTSP, e grava sessões no
Supabase (`chair_sessions`, `camera_heartbeat`, RPC `camera_ingest` — migration 121). O card
"Cadeira (câmera)" no `admin.html` mostra o resultado e alerta quando as sessões divergem dos
atendimentos ou quando o sinal some por mais de 15 min.

## Por que estes arquivos estão versionados (03/09/2026)

Porque **não estavam**, e isso quase custou o projeto. O contador vivia só em
`%USERPROFILE%\barbearia-camera`, fora do Git. Quando o PC foi formatado, sumiram o Python, o
atalho de inicialização e o arquivo de configuração; o `.bat` ainda apontava para o usuário
antigo do Windows. O contador ficou **dois dias parado sem ninguém notar** — o log dizia "sem
quadro da câmera", que parecia defeito de hardware, quando a câmera estava perfeita.

Regra que fica: o que é preciso para reconstruir o serviço mora no Git. O que é segredo mora
fora dele.

## Arquivos

| | |
|---|---|
| `chair_counter.py` | o contador (YOLOv8n + OpenCV, RTSP por TCP) |
| `zone.json` | a zona da cadeira no quadro 2304x1296 — calibrada na mão, não mexer sem reconferir com `--debug` |
| `start-counter.bat` | sobe o contador; usa `%USERPROFILE%` e `%LOCALAPPDATA%` de propósito, para não quebrar se o usuário do Windows mudar |
| `BarbeariaContadorCadeira.vbs` | vai na pasta Startup do Windows; sobe o `.bat` sem janela preta |
| `detect_test.py` | teste solto de detecção |
| `.env.example` | modelo da configuração — o `.env` real **nunca** vai para o Git |

O modelo `yolov8n.pt` (6,5 MB) não é versionado: o `ultralytics` baixa sozinho na primeira
execução.

## Instalar numa máquina nova

1. Python 3.12: `winget install --id Python.Python.3.12 --silent --scope user`
2. Dependências: `python -m pip install opencv-python-headless ultralytics requests numpy`
3. Copiar esta pasta para `%USERPROFILE%\barbearia-camera`
4. Copiar `.env.example` para `%USERPROFILE%\barbearia-camera.env` e preencher (veja o arquivo)
5. Copiar `BarbeariaContadorCadeira.vbs` para a pasta Startup:
   `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`
6. Testar: `python chair_counter.py --once --debug` — gera `debug.jpg` com a zona desenhada e
   diz quantas pessoas viu. **Sempre olhar o `debug.jpg`**: é o único jeito de saber se a
   câmera não girou e se a cadeira continua dentro da zona.

## Diagnóstico rápido

O log (`counter.log`) diz "sem quadro da câmera" tanto para câmera realmente fora do ar quanto
para **senha errada**. Para separar os dois casos, rode com `--once` e olhe as linhas do ffmpeg:
`401 Unauthorized` é credencial, não é a câmera. Um `Test-NetConnection <host> -Port 554`
confirma em segundos se a câmera está viva na rede.

## Parâmetros que importam

Estão no topo do `chair_counter.py`: `MIN_SESSION_MIN` (6 min — menos que isso não é
atendimento), `GAP_CLOSE_SEC` (150 s vazia fecha a sessão), `CONFIRM_SAMPLES` (4 amostras
seguidas para abrir, filtra quem só passa na frente).

## Privacidade

Só contagem e horário são gravados. Nenhuma imagem, nenhum rosto e nenhum vídeo saem da
máquina — o `debug.jpg` é local e serve só para conferir enquadramento.
