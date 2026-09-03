# -*- coding: utf-8 -*-
"""
Contador de sessões na cadeira — Barbearia do Ju (v29.46.0, 19/08/2026)

Lê o RTSP da câmera da barbearia, detecta PESSOA (YOLOv8n) e verifica se o centro da
pessoa está dentro da zona da cadeira (zone.json). Uma SESSÃO = cadeira ocupada de forma
contínua por >= MIN_SESSION_MIN minutos (tolerando buracos curtos de detecção); a sessão
fecha depois de GAP_CLOSE_SEC segundos sem ninguém na cadeira.

O que sai daqui: só horários (início/fim) e contagem de amostras -> Supabase
(rpc camera_ingest). NUNCA grava vídeo, frame ou rosto. Log local em counter.log.

Uso:  python chair_counter.py            (roda pra sempre; Ctrl+C pra parar)
      python chair_counter.py --once     (uma amostra, imprime e sai — pra testar)
      python chair_counter.py --debug    (salva debug.jpg a cada amostra com as caixas)
"""
import os, sys, json, time, uuid, datetime as dt, traceback
os.environ.setdefault('OPENCV_FFMPEG_CAPTURE_OPTIONS', 'rtsp_transport;tcp|stimeout;10000000')
import cv2, numpy as np, requests
from ultralytics import YOLO

BASE = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(os.path.expanduser('~'), 'barbearia-camera.env')

def load_env(path):
    env = {}
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1); env[k.strip()] = v.strip()
    return env

ENV = load_env(ENV_PATH)
CAM = f"rtsp://{ENV['CAM_USER']}:{ENV['CAM_PASS']}@{ENV['CAM_HOST']}:554/onvif2"
SUPABASE_URL = ENV.get('SUPABASE_URL', ''); ANON = ENV.get('SUPABASE_ANON_KEY', '')
SECRET = ENV.get('CAMERA_INGEST_SECRET', ''); DEVICE = ENV.get('DEVICE', 'barbearia-notebook')

SAMPLE_EVERY_SEC = 3        # uma amostra a cada 3 s
MIN_SESSION_MIN = 6         # menos que isso = não foi atendimento (alguém sentou pra olhar o celular)
GAP_CLOSE_SEC = 150         # 2,5 min sem ninguém na cadeira = sessão terminou
CONFIRM_SAMPLES = 4         # ~12 s ocupado seguido pra abrir candidata (filtra passagem)
HEARTBEAT_SEC = 300
CONF = 0.40
IMGSZ = 960

ZONE = json.load(open(os.path.join(BASE, 'zone.json'), encoding='utf-8'))
CHAIR = np.array(ZONE['chair'], np.int32)
DEBUG = '--debug' in sys.argv
ONCE = '--once' in sys.argv

def log(msg):
    line = f"{dt.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} {msg}"
    print(line, flush=True)
    with open(os.path.join(BASE, 'counter.log'), 'a', encoding='utf-8') as f:
        f.write(line + '\n')

def ingest(event):
    if not (SUPABASE_URL and ANON and SECRET):
        return None
    try:
        r = requests.post(f"{SUPABASE_URL}/rest/v1/rpc/camera_ingest",
                          headers={'apikey': ANON, 'Authorization': f'Bearer {ANON}', 'Content-Type': 'application/json'},
                          json={'p_secret': SECRET, 'p_event': event}, timeout=15)
        if r.status_code >= 300:
            log(f"ingest {event.get('type')} HTTP {r.status_code}: {r.text[:200]}")
        return r
    except Exception as e:
        log(f"ingest erro: {e}")
        return None

def open_capture():
    cap = cv2.VideoCapture(CAM, cv2.CAP_FFMPEG)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    return cap

def grab(cap):
    # descarta quadros acumulados e pega o mais recente
    ok = False
    for _ in range(6):
        ok = cap.grab() or ok
    if not ok: return None
    ok, frame = cap.retrieve()
    return frame if ok else None

def in_chair(box):
    x1, y1, x2, y2 = box
    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
    return cv2.pointPolygonTest(CHAIR, (float(cx), float(cy)), False) >= 0

def main():
    model = YOLO(os.path.join(BASE, 'yolov8n.pt'))
    cap = open_capture()
    log(f"contador iniciado — zona {ZONE['chair']} | sessão >= {MIN_SESSION_MIN} min | fecha após {GAP_CLOSE_SEC}s vazio")
    ingest({'type': 'heartbeat', 'device': DEVICE, 'note': 'iniciado'})

    sess = None          # {'id','started','last_occ','occ','total','opened_remote'}
    occ_streak = 0
    last_hb = time.time(); fails = 0; sample_times = []

    while True:
        t0 = time.time()
        frame = grab(cap)
        if frame is None:
            fails += 1
            if fails % 5 == 1: log(f"sem quadro da câmera (tentativa {fails}) — reconectando")
            cap.release(); time.sleep(min(30, 3 * fails)); cap = open_capture(); continue
        fails = 0

        res = model.predict(frame, classes=[0], conf=CONF, imgsz=IMGSZ, verbose=False)[0]
        boxes = [tuple(map(int, b.xyxy[0])) for b in res.boxes]
        occupied = any(in_chair(b) for b in boxes)
        now = dt.datetime.now(dt.timezone.utc)
        if DEBUG and occupied != getattr(main, '_last', None):
            log(f"[debug] cadeira {'OCUPADA' if occupied else 'vazia'} — pessoas no quadro: {len(boxes)}"); main._last = occupied

        if DEBUG or ONCE:
            dbg = frame.copy()
            cv2.polylines(dbg, [CHAIR], True, (0, 215, 255), 4)
            for b in boxes:
                c = (0, 255, 0) if in_chair(b) else (0, 0, 255)
                cv2.rectangle(dbg, (b[0], b[1]), (b[2], b[3]), c, 3)
            cv2.putText(dbg, f"{'OCUPADA' if occupied else 'vazia'} pessoas={len(boxes)}", (40, 80), cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 215, 255), 4)
            cv2.imwrite(os.path.join(BASE, 'debug.jpg'), dbg)
        if ONCE:
            print(f"pessoas={len(boxes)} cadeira={'OCUPADA' if occupied else 'vazia'} -> debug.jpg")
            return

        # ---- máquina de estados da sessão ----
        if occupied:
            occ_streak += 1
            if sess is None and occ_streak >= CONFIRM_SAMPLES:
                sess = {'id': str(uuid.uuid4()), 'started': now - dt.timedelta(seconds=SAMPLE_EVERY_SEC * (CONFIRM_SAMPLES - 1)),
                        'last_occ': now, 'occ': CONFIRM_SAMPLES, 'total': CONFIRM_SAMPLES, 'opened_remote': False}
                log(f"cadeira ocupada — candidata a sessão {sess['id'][:8]}")
            elif sess is not None:
                sess['last_occ'] = now; sess['occ'] += 1; sess['total'] += 1
        else:
            occ_streak = 0
            if sess is not None:
                sess['total'] += 1

        if sess is not None:
            dur_min = (sess['last_occ'] - sess['started']).total_seconds() / 60
            gap = (now - sess['last_occ']).total_seconds()
            if not sess['opened_remote'] and dur_min >= MIN_SESSION_MIN:
                r = ingest({'type': 'open', 'session_id': sess['id'], 'started_at': sess['started'].isoformat(),
                            'samples_occupied': sess['occ'], 'samples_total': sess['total'], 'device': DEVICE})
                sess['opened_remote'] = True
                log(f"SESSÃO CONFIRMADA {sess['id'][:8]} (>= {MIN_SESSION_MIN} min) início {sess['started'].astimezone().strftime('%H:%M:%S')}")
            if gap >= GAP_CLOSE_SEC:
                if sess['opened_remote']:
                    ingest({'type': 'close', 'session_id': sess['id'], 'ended_at': sess['last_occ'].isoformat(),
                            'samples_occupied': sess['occ'], 'samples_total': sess['total']})
                    log(f"SESSÃO FECHADA {sess['id'][:8]} — {dur_min:.1f} min ({sess['occ']}/{sess['total']} amostras)")
                else:
                    log(f"candidata {sess['id'][:8]} descartada — só {dur_min:.1f} min")
                sess = None
            elif sess['opened_remote'] and sess['total'] % 20 == 0:
                ingest({'type': 'update', 'session_id': sess['id'], 'samples_occupied': sess['occ'], 'samples_total': sess['total']})

        if time.time() - last_hb >= HEARTBEAT_SEC:
            fps = round(len(sample_times) / max(1, HEARTBEAT_SEC), 3)
            ingest({'type': 'heartbeat', 'device': DEVICE, 'fps': fps,
                    'note': f"{'sessão aberta' if sess else 'cadeira vazia'}; pessoas no quadro: {len(boxes)}"})
            last_hb = time.time(); sample_times = []
        sample_times.append(t0)

        time.sleep(max(0, SAMPLE_EVERY_SEC - (time.time() - t0)))

if __name__ == '__main__':
    import socket
    _lock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        _lock.bind(('127.0.0.1', 47123))  # instância única: se a porta já está ocupada, outro contador roda
    except OSError:
        print('contador já está rodando — saindo'); sys.exit(0)
    while True:
        try:
            main()
            break
        except KeyboardInterrupt:
            log('parado pelo usuário'); break
        except Exception:
            log('erro fatal, reiniciando em 20s:\n' + traceback.format_exc())
            time.sleep(20)
