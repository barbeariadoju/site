import { describe, it, expect } from 'vitest';
import { semEmoji } from '../../supabase/functions/_shared/sem-emoji.ts';

// v29.208.0 — revisão de textos: tecla numerada e espaço no começo da linha.

describe('semEmoji', () => {
  it('tira a tecla numerada inteira (não sobra "1⃣")', () => {
    expect(semEmoji('1️⃣ Não tinha\n2️⃣ Preço')).toBe('1 Não tinha\n2 Preço');
  });
  it('não deixa espaço no começo da linha quando o emoji abria a linha', () => {
    expect(semEmoji('Olá.\n📅 18/09 às 10:00')).toBe('Olá.\n18/09 às 10:00');
  });
  it('mantém o 🙏 do agradecimento', () => {
    expect(semEmoji('Obrigado pela preferência 🙏')).toBe('Obrigado pela preferência 🙏');
  });
});
