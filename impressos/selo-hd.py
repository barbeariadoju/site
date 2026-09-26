# Selo transparente em 1200 px: cor do logo-topo-wide.jpg (1200x445, fundo preto) + recorte do
# marca-selo-transparente.png (600x223) ampliado 2x. O PNG tem buracos no alfa dentro das bases
# dos postes (a remoção de fundo confundiu o preto da arte com o fundo). Buracos = regiões
# transparentes FECHADAS (não alcançáveis a partir da borda): são tampados, exceto os vãos das
# correntes (colunas conhecidas, área pequena), que continuam transparentes.
from collections import deque
from PIL import Image, ImageFilter

ASSETS = r"C:\Users\Juliano\Documents\GitHub\site\assets"
OUT = r"C:\Users\Juliano\AppData\Local\Temp\claude\C--Users-Juliano--claude\06de77bf-6c75-4ff2-a000-4b3e7db25ccf\scratchpad\impressos"
COLUNAS_CORRENTE = ((150, 250), (950, 1050))  # x onde as correntes pendem, em px de 1200
AREA_VAO = 900

grande = Image.open(fr"{ASSETS}\logo-topo-wide.jpg").convert("RGB")
W, H = grande.size
alfa_png = Image.open(fr"{ASSETS}\marca-selo-transparente.png").convert("RGBA").getchannel("A").resize((W, H), Image.LANCZOS)
a = alfa_png.load()
transp = [[a[x, y] < 128 for x in range(W)] for y in range(H)]

# transparente alcançável a partir da borda = fundo de verdade
fundo = [[False] * W for _ in range(H)]
fila = deque()
for x in range(W):
    for y in (0, H - 1):
        if transp[y][x] and not fundo[y][x]:
            fundo[y][x] = True; fila.append((x, y))
for y in range(H):
    for x in (0, W - 1):
        if transp[y][x] and not fundo[y][x]:
            fundo[y][x] = True; fila.append((x, y))
while fila:
    x, y = fila.popleft()
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if 0 <= nx < W and 0 <= ny < H and transp[ny][nx] and not fundo[ny][nx]:
            fundo[ny][nx] = True; fila.append((nx, ny))

# regiões transparentes fechadas: tampar, salvo vãos de corrente
visto = [[False] * W for _ in range(H)]
tampar = [[False] * W for _ in range(H)]
tampados = 0
for y0 in range(H):
    for x0 in range(W):
        if transp[y0][x0] and not fundo[y0][x0] and not visto[y0][x0]:
            comp = []; fila.append((x0, y0)); visto[y0][x0] = True
            while fila:
                x, y = fila.popleft(); comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < W and 0 <= ny < H and transp[ny][nx] and not fundo[ny][nx] and not visto[ny][nx]:
                        visto[ny][nx] = True; fila.append((nx, ny))
            xs = [p[0] for p in comp]
            cx = sum(xs) / len(xs)
            vao = len(comp) < AREA_VAO and any(lo <= cx <= hi for lo, hi in COLUNAS_CORRENTE)
            if not vao:
                tampados += 1
                for x, y in comp: tampar[y][x] = True

alfa = Image.new("L", (W, H), 0)
pa = alfa.load()
for y in range(H):
    for x in range(W):
        pa[x, y] = 0 if (fundo[y][x] or (transp[y][x] and not tampar[y][x])) else 255
alfa = alfa.filter(ImageFilter.GaussianBlur(0.7))

selo = grande.copy()
selo.putalpha(alfa)
selo.save(fr"{OUT}\marca-selo.png", optimize=True)

esq = selo.crop((0, H - 150, 220, H)).resize((660, 450), Image.LANCZOS)
dir_ = selo.crop((W - 220, H - 150, W, H)).resize((660, 450), Image.LANCZOS)
zoom = Image.new("RGBA", (1340, 450), (243, 235, 219, 255))
zoom.alpha_composite(esq, (0, 0)); zoom.alpha_composite(dir_, (680, 0))
zoom.save(fr"{OUT}\selo-zoom-bases.png")
inteiro = Image.new("RGBA", (W, H), (243, 235, 219, 255)); inteiro.alpha_composite(selo)
inteiro.save(fr"{OUT}\selo-no-papel.png")
print("ok", selo.size, "buracos tampados:", tampados)
