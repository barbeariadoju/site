# Artes impressas

Fonte das peças que vão para a gráfica. **O PNG final não é versionado** — é gerado a partir
daqui, e vai para a Área de Trabalho do Juliano.

## Plaquinha do reajuste de 01/10/2026

- `placa-reajuste-outubro.html` — o layout (A5, 1748x2480 = 300 dpi)
- `gerar-placa.mjs` — renderiza com Playwright e **mede transbordo** antes de salvar
- `qr-precos.png` — o QR que vai embutido, aponta para `barbeariadoju.com.br/precos/`
- `lerqr.mjs` — lê um QR de volta de qualquer PNG

Gerar:

```
node artes/gerar-placa.mjs        # rode da raiz do repo, precisa do node_modules
node artes/lerqr.mjs PLAQUINHA-reajuste-outubro-A5-v2.png
```

## Regras que saíram de erro real (não pular nenhuma)

1. **Ler o QR de volta do arquivo FINAL**, nunca só do original. Em 30/08 o QR foi gerado
   apontando para `/precos` sem a barra — no GitHub Pages isso dá erro no navegador, e teria
   queimado a impressão inteira. O `lerqr.mjs` checa domínio e barra final sozinho.
2. **Medir transbordo por JavaScript**, comparando `scrollWidth` com `innerWidth`. O
   `chrome --headless --screenshot --window-size` não respeita a largura: renderiza maior e
   recorta, fazendo a peça PARECER quebrada. O `gerar-placa.mjs` já mede.
3. **Nunca imprimir número que envelhece** (quantidade de avaliações, nota). Correção do
   Juliano em 30/08: "amanhã vamos ter 200, 300…".
4. **Não repetir o que o contexto já diz.** Em peça usada dentro da loja, endereço e cidade são
   desperdício de espaço — quem lê já está lá.
5. **Conferir preço contra `service_price_changes`/`services` no banco**, nunca contra memória
   ou documento. Foi assim que se pegou, em 03/09, que dois reajustes estavam agendados com
   nome de serviço que não existe mais.
