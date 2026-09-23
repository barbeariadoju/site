// Simulador da JuIA (v29.212.0) — cliente Supabase FALSO. Nada aqui fala com o banco de produção.
// Cada consulta é registrada em `chamadas` e respondida por `respostas`, que o cenário configura.

export type Chamada = { tipo: 'from' | 'rpc'; alvo: string; op?: string; filtros?: any[]; payload?: any; args?: any }
export const chamadas: Chamada[] = []
export const respostas: {
  tabela: Record<string, (c: Chamada) => any>
  rpc: Record<string, (args: any) => any>
} = { tabela: {}, rpc: {} }

class Consulta {
  c: Chamada
  constructor(tabela: string) { this.c = { tipo: 'from', alvo: tabela, op: 'select', filtros: [] } }
  select(_cols?: any, opts?: any) { if (this.c.op === 'select') this.c.op = opts?.head ? 'count' : 'select'; return this }
  insert(p: any) { this.c.op = 'insert'; this.c.payload = p; return this }
  upsert(p: any, _o?: any) { this.c.op = 'upsert'; this.c.payload = p; return this }
  update(p: any) { this.c.op = 'update'; this.c.payload = p; return this }
  delete() { this.c.op = 'delete'; return this }
  eq(k: string, v: any) { this.c.filtros!.push(['eq', k, v]); return this }
  neq(k: string, v: any) { this.c.filtros!.push(['neq', k, v]); return this }
  in(k: string, v: any) { this.c.filtros!.push(['in', k, v]); return this }
  is(k: string, v: any) { this.c.filtros!.push(['is', k, v]); return this }
  gte(k: string, v: any) { this.c.filtros!.push(['gte', k, v]); return this }
  gt(k: string, v: any) { this.c.filtros!.push(['gt', k, v]); return this }
  lte(k: string, v: any) { this.c.filtros!.push(['lte', k, v]); return this }
  lt(k: string, v: any) { this.c.filtros!.push(['lt', k, v]); return this }
  like(k: string, v: any) { this.c.filtros!.push(['like', k, v]); return this }
  ilike(k: string, v: any) { this.c.filtros!.push(['ilike', k, v]); return this }
  order() { return this }
  limit() { return this }
  maybeSingle() { this.c.filtros!.push(['single']); return this }
  single() { this.c.filtros!.push(['single']); return this }
  resolver() {
    chamadas.push(this.c)
    const h = respostas.tabela[this.c.alvo]
    const r = h ? h(this.c) : null
    if (this.c.op === 'count') return { data: null, error: null, count: 0 }
    if (r && typeof r === 'object' && ('data' in r || 'error' in r)) return r
    return { data: r ?? (this.c.op === 'select' ? [] : null), error: null }
  }
  then(ok: any, erro: any) { try { return Promise.resolve(this.resolver()).then(ok, erro) } catch (e) { return Promise.reject(e).then(ok, erro) } }
}

export const createClient = (_url?: string, _key?: string, _opts?: any) => ({
  from: (t: string) => new Consulta(t),
  rpc: async (nome: string, args: any) => {
    chamadas.push({ tipo: 'rpc', alvo: nome, args })
    const h = respostas.rpc[nome]
    const r = h ? h(args) : null
    if (r && typeof r === 'object' && ('data' in r || 'error' in r)) return r
    return { data: r, error: null }
  },
})
