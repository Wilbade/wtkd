# Wil TKD — Sistema de Gestão do Dojang

Sistema web completo para gerenciamento de alunos, controle de presença e banca de exames de graduação do **Wil Taekwondo — Team Marchesini** (São Bernardo do Campo, SP).

---

## 🥋 Funcionalidades

| Módulo | Arquivo | Descrição |
|--------|---------|-----------|
| **Site Institucional** | `index.html` | Landing page com horários, localização e links de agendamento |
| **Painel do Professor** | `painel.html` + `conexao.js` | Chamada diária, cadastro/edição de alunos, controle de horas |
| **Banca de Exame** | `exame.html` | Avaliação de até 4 alunos simultâneos com matriz técnica por graduação |
| **Login da Banca** | `login.html` | Autenticação em 2 passos via Supabase Auth |
| **Conteúdo Técnico** | `curriculo.html`, `formas.html`, `dicionario.html`, `historia.html` | Material pedagógico do TKD |
| **Menu Global** | `nav.js` | Web Component `<wtkd-nav>` — header compartilhado entre todas as páginas públicas com detecção automática da página ativa |

---

## 🗄️ Estrutura do Banco de Dados (Supabase)

### Tabela `alunos`
```
id                    UUID (PK)
nome                  TEXT
data_nascimento       DATE
cpf                   TEXT
faixa_inicial_cadastro TEXT  — graduação no momento da matrícula (histórico)
tamanho_dobok         INTEGER (cm)
tamanho_faixa         INTEGER (cm)
observacoes           TEXT
foto_url              TEXT  — URL pública do Storage bucket "avatars"
status                TEXT  — 'ativo' | 'inativo'
```

### Tabela `progresso_tecnico` (relação 1:N com `alunos`)
```
id                    UUID (PK)
aluno_id              UUID (FK → alunos.id)
faixa_atual           TEXT  — graduação vigente do aluno
horas_acumuladas      INTEGER — total de treinos realizados
```
> ⚠️ A graduação **atual** do aluno **NÃO está em `alunos.faixa`**. Ela fica em `progresso_tecnico.faixa_atual`. Usar `faixa` diretamente em `alunos` causará erro 400.

### Tabela `registro_presencas`
```
id                    UUID (PK)
aluno_id              UUID (FK → alunos.id)
data_aula             DATE
horas_aula            INTEGER  — padrão: 1
```

### Tabela `exames_notas`
```
id                    UUID (PK)
conta_avaliador       TEXT
nome_real_avaliador   TEXT
graduacao_avaliador   TEXT
id_aluno              UUID (FK → alunos.id)
faixa_avaliada        TEXT
materia               TEXT
nota                  NUMERIC
```

---

## 🏗️ Arquitetura

```
wtkd/
├── index.html          # Landing page institucional
├── login.html          # Autenticação da banca (Supabase Auth + localStorage)
├── painel.html         # Painel do professor (usa conexao.js)
├── conexao.js          # Camada de acesso ao banco — CRUD, chamada, presença
├── exame.html          # Banca multialunos (standalone — não usa conexao.js)
├── nav.js              # 🔑 Web Component <wtkd-nav> — menu global das páginas públicas
├── curriculo.html      # Currículo técnico de TKD
├── formas.html         # Biblioteca de formas (Poom-se/Hyun/Tull)
├── dicionario.html     # Dicionário de termos coreanos
├── historia.html       # História do Taekwondo
├── .env                # Variáveis de ambiente (não comitar — veja .gitignore)
├── CNAME               # Domínio customizado do GitHub Pages
└── public/             # Assets estáticos
    └── assets/images/  # logo.png, favicon e imagens do conteúdo
```

### Menu Global (`nav.js`)

```html
<!-- Inclua no <head> de qualquer página pública: -->
<script src="nav.js" defer></script>

<!-- Coloque no <body> onde o header deve aparecer: -->
<wtkd-nav></wtkd-nav>
```

**Como funciona:**
- `customElements.define('wtkd-nav', ...)` registra um Web Component nativo do browser.
- Detecta a página atual via `window.location.pathname` e aplica a classe `active` no link correto.
- Para adicionar/remover itens do menu, edite **apenas** o array `NAV_LINKS` no `nav.js`.
- Compatível com GitHub Pages, Live Server ou qualquer servidor de arquivos estáticos.

### Fluxo de Autenticação da Banca

```
login.html
  └─ PASSO 1: Supabase Auth (email + senha)
       └─ PASSO 2: Perfil da banca (nome + graduação)
            └─ localStorage: wtkd_conta | wtkd_nome_real | wtkd_graduacao
                 └─ exame.html (guarda de rota valida o localStorage)
```

### Por que `exame.html` não importa `conexao.js`?

O `exame.html` é uma aplicação autossuficiente com seu próprio cliente Supabase (`_supabase`). Isso evita colisão de escopo com o `supabaseClient` global do `conexao.js` e mantém o módulo isolado para uso na banca sem o overhead do painel de chamada.

---

## 🚀 Deploy

O projeto é hospedado via **GitHub Pages** (domínio configurado no `CNAME`).

### Para subir alterações:
```bash
git add .
git commit -m "feat: descrição da alteração"
git push origin main
```

O GitHub Pages publica automaticamente a partir da branch `main`.

---

## 🔐 Segurança

- A **anon key** do Supabase (publishable) é exposta no front-end — isso é intencional e seguro quando as **RLS Policies** estão configuradas corretamente no Supabase.
- Nunca exponha a `service_role key` — ela ignora todas as RLS.
- O arquivo `.env` está no `.gitignore` e **não deve ser comitado**.
- Credenciais de avaliadores são gerenciadas pelo **Supabase Auth** (não hardcoded).

---

## 🎓 Graduações Suportadas na Banca de Exame

| Chave no banco | Exibição |
|---|---|
| `Branca` | 10º Gub |
| `Ponta Amarela` | 9º Gub |
| `Amarela` | 8º Gub |
| `Ponta Verde` | 7º Gub |
| `Verde` | 6º Gub |
| `Ponta Azul` | 5º Gub |
| `Azul` | 4º Gub |
| `Ponta Vermelha` | 3º Gub |
| `Vermelha` | 2º Gub |
| `Ponta Preta` | 1º Gub |

> O mapeamento usa `.trim().toLowerCase()` para tolerar espaços invisíveis e variações de capitalização vindos do banco.

---

## 🧮 Regra de Aptidão para Exame

| Faixa | Adultos (>10 anos) | Crianças (4–10 anos) |
|---|---|---|
| Branca → Ponta Verde | 52h | 78h |
| Verde → Ponta Azul | 52h | 104h |
| Azul → Vermelha | 78h | 104h |
| Ponta Preta | 104h | 104h |

---

## 👨‍💻 Desenvolvido por

**Wiliam Longo** — Wil Taekwondo Team Marchesini  
São Bernardo do Campo, SP

---

*© Todos os direitos reservados — Wil Taekwondo Team Marchesini*
