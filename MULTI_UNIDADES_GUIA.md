# 🏛️ Guia Mestre: Arquitetura Multi-Unidades (Team Marchesini)

Este documento foi projetado para que a expansão do **Team Marchesini** para novas academias (ex: **Gaviões**, **BlueFit**, **Smart Fit**, etc.) ocorra de forma fluida, sem retrabalho e sem risco de quebrar os alunos ou presenças atuais da **Ellite Fighters**.

---

## 📌 1. Visão Geral da Arquitetura

O sistema é dividido em duas camadas:
1. **Camada Pública (Site & Captação):** Gerenciada de forma modular pelo arquivo `unidades.js`. Permite adicionar uma nova academia em 10 segundos para exibi-la no site e ranquear no Google.
2. **Camada Administrativa (Supabase & Painel):** Onde os alunos, presenças e exames ficam vinculados à sua respectiva academia/unidade.

```
                  ┌─────────────────────────────────────┐
                  │    Team Marchesini (Portal Web)     │
                  └──────────────────┬──────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌──────────────────────┐                           ┌──────────────────────┐
│  Unidade 1: SBC      │                           │  Unidade 2: Santo    │
│  (CT Ellite)         │                           │  André (Gaviões/...) │
└──────────┬───────────┘                           └──────────┬───────────┘
           │                                                   │
           └─────────────────────────┬─────────────────────────┘
                                     ▼
                  ┌─────────────────────────────────────┐
                  │         Supabase Database           │
                  │   Tabela Alunos (unidade_id)        │
                  │   Tabela Presenças (unidade_id)     │
                  └─────────────────────────────────────┘
```

---

## 🗄️ 2. Como migrar o Banco (Supabase) para Multi-Unidades com 1 Script

Hoje, todos os alunos cadastrados pertencem implicitamente à **Ellite Fighters**.
Quando você fechar a primeira nova academia (ex: Gaviões Santo André), basta rodar o seguinte script SQL no **SQL Editor** do Supabase:

```sql
-- 1. Cria o campo 'unidade_id' na tabela de alunos (com padrão para a unidade atual da Ellite)
ALTER TABLE alunos 
ADD COLUMN IF NOT EXISTS unidade_id TEXT DEFAULT 'ellite-sbc';

-- 2. Garante que todos os alunos atuais fiquem marcados como 'ellite-sbc'
UPDATE alunos 
SET unidade_id = 'ellite-sbc' 
WHERE unidade_id IS NULL;

-- 3. Cria o campo 'unidade_id' na tabela de presenças
ALTER TABLE presencas 
ADD COLUMN IF NOT EXISTS unidade_id TEXT DEFAULT 'ellite-sbc';

UPDATE presencas 
SET unidade_id = 'ellite-sbc' 
WHERE unidade_id IS NULL;
```

---

## 💻 3. Como o `painel.html` funcionará no futuro

No painel de controle (`painel.html`), você terá um **Seletor de Unidade no topo**:
* `[ Todas as Unidades ]`
* `[ CT Ellite Fighters - SBC ]`
* `[ Academia Gaviões - Santo André ]`
* `[ Academia BlueFit - Santo André ]`

Ao selecionar uma unidade:
1. A lista de presença carrega apenas os alunos daquela academia.
2. O cadastro de novo aluno já grava automaticamente a unidade selecionada.
3. Os relatórios de faturamento/mensalidades e exames podem ser exportados individualmente por unidade para prestação de contas com os gerentes das academias parceiras.

---

## ⚡ 4. Como adicionar uma nova academia no Site em 1 minuto (`unidades.js`)

Na hora de apresentar a proposta comercial para o gerente da **Gaviões** ou **BlueFit**, você pode abrir o arquivo `unidades.js` e adicionar um bloco como este:

```javascript
{
    id: "gavioes-santo-andre",
    nome: "Academia Gaviões — Santo André",
    cidade: "Santo André",
    bairro: "Vila Gilda / Jardim Bela Vista",
    endereco: "Av. Portugal, Santo André - SP",
    cep: "09060-580",
    status: "ativo", // ou 'em_breve'
    horarios: [
        { turma: "Adultos", dias: "Segundas & Quartas", hora: "19:00h às 20:00h" },
        { turma: "Kids", dias: "Segundas & Quartas", hora: "18:00h às 19:00h" }
    ],
    logoUrl: "URL_DA_LOGO_GAVIOES",
    whatsappMsg: "Olá! Gostaria de informações sobre o Taekwondo na Unidade Gaviões Santo André."
}
```

O site cria automaticamente o card com mapa, horários e botão de WhatsApp segmentado!
