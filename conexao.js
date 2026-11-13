// ============================================================================
// ARQUIVO: conexao.js
// PROPÓSITO: Camada central de acesso ao banco de dados (Supabase).
//            Centraliza CRUD de alunos, controle de presença diária e
//            cálculo de elegibilidade para exames de graduação.
//
// DEPENDÊNCIAS (ordem de carregamento no HTML):
//   1. auth.js       → sanitizar(), verificarSessao(), exibirToast()
//   2. supabase CDN  → namespace global "supabase"
//   3. conexao.js    → este arquivo (usa os anteriores)
//
// ESCOPO: Importado por painel.html.
//         O exame.html possui cliente e lógica próprios (standalone).
//
// SEGURANÇA:
//   - Dados do banco são inseridos via textContent (nunca innerHTML direto)
//   - Botões de ação usam event delegation com data-* attributes (anti-XSS)
//   - Nenhuma string de dados externos é interpolada em onclick= ou innerHTML
// ============================================================================


// ============================================================================
// 1. CONFIGURAÇÃO E INICIALIZAÇÃO DO CLIENTE SUPABASE
// ============================================================================

const urlBanco   = 'https://pkbusphlutnodgconbbc.supabase.co';
const chaveBanco = 'sb_publishable_AXK9wUTEpz-rSdmXYn2SUA_u8O_u6P0';

// Instância global. "supabaseClient" evita colisão com o namespace "supabase" da lib CDN.
const supabaseClient = supabase.createClient(urlBanco, chaveBanco);

/**
 * Valida a comunicação com o banco ao inicializar.
 * Erro aqui indica problema de credencial, rede ou RLS policy bloqueando leitura.
 */
async function testarBanco() {
    const { error } = await supabaseClient.from('alunos').select('id').limit(1);
    if (error) {
        console.error("❌ Falha na conexão com o Supabase:", error.message);
    } else {
        console.log("🚀 Supabase conectado com sucesso!");
    }
}
testarBanco();


// ============================================================================
// 2. OPERAÇÕES DE FLUXO: CADASTRO OU EDIÇÃO DE ALUNOS (HÍBRIDO)
// ============================================================================

/**
 * Controla o envio do formulário de matrícula.
 * Decide dinamicamente se fará INSERT (novo aluno) ou UPDATE (edição),
 * baseando-se na presença do campo oculto `aluno_id_edicao`.
 *
 * FLUXO:
 *   1. Lê o campo oculto #aluno_id_edicao (vazio = INSERT, preenchido = UPDATE)
 *   2. Se houver nova foto, faz upload no bucket "avatars" do Storage
 *   3. Monta o payload com os dados do formulário
 *   4. Executa INSERT ou UPDATE conforme o ID
 *   5. Em sucesso: reseta o formulário e volta para a aba de chamada
 *
 * @param {Event} event - Evento de submit do formulário HTML
 */
async function cadastrarAluno(event) {
    event.preventDefault();

    const btnSubmit = document.querySelector('.btn-submit-cadastro');
    if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = 'Salvando...'; }

    // Campo oculto de controle: vazio = novo cadastro, preenchido = edição
    const idEdicao = document.getElementById('aluno_id_edicao').value.trim();

    // Coleta campos do formulário
    const nome            = document.getElementById('nome').value.trim();
    const data_nascimento = document.getElementById('data_nascimento').value;
    const cpf             = document.getElementById('cpf').value.trim();
    const faixa_inicial   = document.getElementById('faixa_inicial').value;
    const tamanho_dobok   = document.getElementById('tamanho_dobok').value;
    const tamanho_faixa   = document.getElementById('tamanho_faixa').value;
    const observacoes     = document.getElementById('observacoes').value.trim();
    const arquivoFoto     = document.getElementById('foto_aluno').files[0];

    // Validação básica no front-end
    if (!nome) {
        exibirToast('O nome do aluno é obrigatório.', 'aviso');
        if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = idEdicao ? 'Salvar Alterações' : 'Gravar Aluno'; }
        return;
    }

    let urlFotoPublica = null;

    // --- MODO EDIÇÃO: recupera URL da foto atual se não enviou nova ---
    if (idEdicao && !arquivoFoto) {
        const { data: alunoAtual } = await supabaseClient
            .from('alunos')
            .select('foto_url')
            .eq('id', idEdicao)
            .single();

        if (alunoAtual) urlFotoPublica = alunoAtual.foto_url;
    }

    // --- UPLOAD DE FOTO (se o usuário selecionou um arquivo) ---
    if (arquivoFoto) {
        const extensao = arquivoFoto.name.split('.').pop().toLowerCase();
        
        // Remove acentos e caracteres especiais para evitar Invalid Key no Supabase
        const nomeLimpo = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const nomeUnico = `${Date.now()}_${nomeLimpo}.${extensao}`;

        console.log("📸 Enviando foto para Storage 'avatars':", nomeUnico);

        const { error: uploadError } = await supabaseClient.storage
            .from('avatars')
            .upload(nomeUnico, arquivoFoto, { cacheControl: '3600', upsert: true });

        if (uploadError) {
            console.error("❌ Falha no upload:", uploadError.message);
            exibirToast('Aviso: Foto não pôde ser carregada. Aluno salvo sem foto.', 'aviso');
        } else {
            const { data: publicUrlData } = supabaseClient.storage
                .from('avatars')
                .getPublicUrl(nomeUnico);
            urlFotoPublica = publicUrlData.publicUrl;
            console.log("✅ URL pública:", urlFotoPublica);
        }
    }

    // --- PAYLOAD DA TABELA 'alunos' ---
    const dadosAluno = {
        nome,
        data_nascimento,
        cpf:                    cpf       || null,
        faixa_inicial_cadastro: faixa_inicial,       // Histórico — não é a faixa atual
        tamanho_dobok:          tamanho_dobok ? parseInt(tamanho_dobok, 10) : null,
        tamanho_faixa:          tamanho_faixa ? parseInt(tamanho_faixa, 10) : null,
        observacoes:            observacoes   || null,
        foto_url:               urlFotoPublica
    };

    let resposta;

    if (idEdicao) {
        console.log("✏️ UPDATE para ID:", idEdicao);
        resposta = await supabaseClient.from('alunos').update(dadosAluno).eq('id', idEdicao);
    } else {
        console.log("➕ INSERT novo aluno");
        resposta = await supabaseClient.from('alunos').insert([dadosAluno]);
    }

    if (resposta.error) {
        console.error("❌ Erro no banco:", resposta.error.message);
        exibirToast(`Erro ao salvar: ${resposta.error.message}`, 'erro', 6000);
    } else {
        exibirToast(
            idEdicao ? 'Cadastro atualizado com sucesso!' : 'Aluno cadastrado com sucesso!',
            'sucesso'
        );

        // Reseta o formulário e o campo de controle de modo
        document.getElementById('formAluno').reset();
        document.getElementById('aluno_id_edicao').value = '';

        if (btnSubmit) btnSubmit.textContent = 'Gravar Aluno';

        // Volta para a aba de chamada
        const navChamada = document.getElementById('nav-chamada');
        if (typeof alternarAba === 'function') {
            // Se o elemento nav-chamada existir, passa ele, caso contrário passa null de forma segura
            alternarAba('aba-chamada', navChamada || null);
        } else {
            // Fallback de segurança caso a aba opere por exibição de blocos padrão
            const abaChamadaBloco = document.getElementById('aba-chamada');
            if (abaChamadaBloco) {
                document.getElementById('aba-cadastro').classList.add('hidden');
                abaChamadaBloco.classList.remove('hidden');
            }
        }

        // Recarrega a lista para refletir o aluno salvo
        setTimeout(carregarListaChamada, 500);
    }

    if (btnSubmit) {
        btnSubmit.disabled    = false;
        btnSubmit.textContent = idEdicao ? 'Salvar Alterações' : 'Gravar Aluno';
    }
}


// ============================================================================
// 3. AUXILIAR DE INTERFACE: PREPARO DOS DADOS DE EDIÇÃO
// ============================================================================

/**
 * Preenche o formulário de matrícula com os dados de um aluno existente.
 * Recebe um objeto dataset (de data-* attributes) em vez de N strings
 * individuais — elimina a necessidade de inline onclick com strings escapadas.
 *
 * CHAMADO POR: event delegation no tbody#tabelaChamada (veja seção 5).
 *
 * @param {DOMStringMap} ds - dataset do elemento com [data-action="editar"]
 */
function prepararEdicao(ds) {
    // Injeta o ID no campo oculto — ativa modo EDIÇÃO em cadastrarAluno()
    document.getElementById('aluno_id_edicao').value  = ds.id   || '';
    document.getElementById('nome').value             = ds.nome || '';
    document.getElementById('data_nascimento').value  = ds.nasc || '';

    // Filtros para não exibir a string "null" nos inputs textuais
    document.getElementById('cpf').value          = (ds.cpf   && ds.cpf   !== 'null') ? ds.cpf   : '';
    document.getElementById('faixa_inicial').value = ds.faixainicial || 'Branca';
    document.getElementById('tamanho_dobok').value = (ds.dobok && ds.dobok !== 'null') ? ds.dobok : '';
    document.getElementById('tamanho_faixa').value = (ds.faixa && ds.faixa !== 'null') ? ds.faixa : '';
    document.getElementById('observacoes').value   = (ds.obs   && ds.obs   !== 'null') ? ds.obs   : '';

    // Altera o label do botão para indicar modo de alteração
    const btnSubmit = document.querySelector('.btn-submit-cadastro');
    if (btnSubmit) btnSubmit.textContent = 'Salvar Alterações';

    // Navega para a aba de Matrícula
    if (typeof alternarAba === 'function') {
        const navMatricula = document.getElementById('nav-matricula');
        alternarAba('aba-cadastro', navMatricula);
    }
}


// ============================================================================
// 4. REGRAS DE NEGÓCIO: METAS DE HORAS PARA EXAME
// ============================================================================

/**
 * Calcula a carga horária mínima de treinos para o aluno ser considerado APTO.
 *
 * REGRA:
 *   - Ponta Preta: sempre 104h (independente de idade)
 *   - Crianças (4–10 anos): metas reduzidas nas faixas iniciais
 *   - Adultos/Jovens (>10 anos): metas progressivas por faixa
 *
 * @param {number} idade  - Idade em anos completos
 * @param {string} faixa  - Graduação atual (ex: 'Verde', 'Ponta Preta')
 * @returns {number}      - Meta de horas (52, 78 ou 104)
 */
function calcularMetaHoras(idade, faixa) {
    if (faixa === 'Ponta Preta') return 104;

    if (idade >= 4 && idade <= 10) {
        if (['Branca', 'Ponta Amarela', 'Amarela', 'Ponta Verde'].includes(faixa)) return 78;
        return 104;
    } else {
        if (['Branca', 'Ponta Amarela', 'Amarela', 'Ponta Verde'].includes(faixa)) return 52;
        if (['Verde', 'Ponta Azul'].includes(faixa)) return 52;
        return 78;
    }
}


// ============================================================================
// 5. OPERAÇÕES DE FLUXO: LISTA DE CHAMADA DIÁRIA
// ============================================================================

/**
 * Carrega e renderiza a tabela de chamada com todos os alunos ativos.
 *
 * QUERIES:
 *   1. alunos + JOIN progresso_tecnico → faixa_atual e horas acumuladas
 *   2. registro_presencas filtrado pela data → quais alunos já têm presença
 *
 * SEGURANÇA ANTI-XSS:
 *   - Todos os dados do banco são atribuídos via .textContent (nunca innerHTML)
 *   - Os botões de ação usam data-* attributes; a lógica fica no listener
 *     delegado no tbody (não no onclick= inline)
 */
async function carregarListaChamada() {
    const campoData = document.getElementById('data_chamada');
    if (!campoData) return; // Proteção: elemento pode não existir em outras telas

    // Define a data padrão como hoje se o campo estiver vazio
    if (!campoData.value) {
        campoData.value = new Date().toISOString().split('T')[0];
    }
    const dataSelecionada = campoData.value;

    // --- QUERY 1: Alunos ativos com progresso técnico via JOIN ---
    const { data: listaAlunos, error: erroAlunos } = await supabaseClient
        .from('alunos')
        .select(`
            id,
            nome,
            data_nascimento,
            cpf,
            tamanho_dobok,
            tamanho_faixa,
            observacoes,
            foto_url,
            faixa_inicial_cadastro,
            progresso_tecnico (faixa_atual, horas_acumuladas)
        `)
        .eq('status', 'ativo')
        .order('nome', { ascending: true });

    // --- QUERY 2: Presenças do dia selecionado ---
    const { data: presencasDoDia, error: erroPresencas } = await supabaseClient
        .from('registro_presencas')
        .select('aluno_id')
        .eq('data_aula', dataSelecionada);

    if (erroAlunos || erroPresencas) {
        console.error("❌ Erro ao buscar dados:", erroAlunos?.message || erroPresencas?.message);
        return;
    }

    // Array de IDs com presença registrada hoje (para o includes() abaixo)
    const IDsComPresenca = presencasDoDia.map(p => p.aluno_id);

    const tabela = document.getElementById('tabelaChamada');
    if (!tabela) return;
    tabela.innerHTML = ''; // Limpa iteração anterior

    listaAlunos.forEach(aluno => {

        // --- CÁLCULO DE IDADE ---
        let idadeTexto  = 'N/A';
        let idadeNumero = 0;

        if (aluno.data_nascimento) {
            const anoNasc  = new Date(aluno.data_nascimento).getFullYear();
            const anoAtual = new Date().getFullYear();
            idadeNumero    = anoAtual - anoNasc;
            if (!isNaN(idadeNumero) && idadeNumero > 0 && idadeNumero < 120) {
                idadeTexto = `${idadeNumero} anos`;
            }
        }

        // --- PROGRESSO TÉCNICO (JOIN) ---
        // Usa [0] do array retornado pelo JOIN (relação 1:N).
        // Fallback: Branca + 0h se não houver registro de progresso.
        const progresso = (aluno.progresso_tecnico && aluno.progresso_tecnico[0])
            ? aluno.progresso_tecnico[0]
            : { faixa_atual: 'Branca', horas_acumuladas: 0 };

        const jaTemPresenca  = IDsComPresenca.includes(aluno.id);
        const metaHoras      = calcularMetaHoras(idadeNumero, progresso.faixa_atual);
        const horasTreinadas = progresso.horas_acumuladas;
        const estaApto       = horasTreinadas >= metaHoras;

        // ============================================================
        // CONSTRUÇÃO DO DOM VIA createElement + textContent (anti-XSS)
        // Nenhum dado do banco é interpolado em innerHTML ou onclick=
        // ============================================================
        const tr = document.createElement('tr');

        // --- Coluna 1: Avatar ---
        const tdFoto = document.createElement('td');
        if (aluno.foto_url) {
            const img = document.createElement('img');
            img.src   = aluno.foto_url;                // URL segura (não é input do usuário)
            img.alt   = 'Foto';
            img.loading = 'lazy';
            img.decoding = 'async';
            img.style.cssText = 'width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid #333;';
            tdFoto.appendChild(img);
        } else {
            tdFoto.textContent = '👤';
            tdFoto.style.cssText = 'font-size:20px;';
        }

        // --- Coluna 2: Nome ---
        const tdNome  = document.createElement('td');
        tdNome.style.fontWeight = '600';
        tdNome.textContent = aluno.nome;              // textContent: seguro, não interpreta HTML

        // --- Coluna 3: Idade ---
        const tdIdade = document.createElement('td');
        tdIdade.style.color = '#a0a0a0';
        tdIdade.textContent = idadeTexto;

        // --- Coluna 4: Graduação ---
        const tdGrad  = document.createElement('td');
        const spanGrad = document.createElement('span');
        spanGrad.style.cssText = 'background:#222;padding:4px 8px;border-radius:4px;border:1px solid #333;';
        spanGrad.textContent = `🥋 ${progresso.faixa_atual}`;
        tdGrad.appendChild(spanGrad);

        // --- Coluna 5: Horas + Selo de Aptidão ---
        const tdHoras = document.createElement('td');

        const spanHoras = document.createElement('span');
        if (estaApto) {
            spanHoras.style.cssText = 'font-weight:bold;color:#30d158;background:#1c421c;padding:2px 6px;border-radius:4px;border:1px solid #30d158;';
        } else {
            spanHoras.style.cssText = 'font-weight:bold;color:#ff1a1a;';
        }
        spanHoras.textContent = `${horasTreinadas}h`;

        const spanSelo = document.createElement('span');
        spanSelo.style.cssText = 'font-size:11px;display:block;margin-top:4px;';
        if (estaApto) {
            spanSelo.style.color  = '#30d158';
            spanSelo.textContent  = '🔥 Apto';
        } else {
            spanSelo.style.color  = '#636366';
            spanSelo.textContent  = `Faltam ${metaHoras - horasTreinadas}h`;
        }

        tdHoras.appendChild(spanHoras);
        tdHoras.appendChild(spanSelo);

        // --- Coluna 6: Botão Editar ---
        // ANTI-XSS: Dados do aluno ficam em data-* attributes,
        // NÃO em strings de onclick=. O listener delegado abaixo lê o dataset.
        const tdEditar = document.createElement('td');
        tdEditar.style.textAlign = 'center';

        // Permissão: Apenas contas master podem editar
        const contaAtual = localStorage.getItem('wtkd_conta');
        if (isMaster(contaAtual)) {
            const btnEditar = document.createElement('button');
            btnEditar.textContent    = '✏️';
            btnEditar.title          = 'Editar Cadastro';
            btnEditar.style.cssText  = 'background:none;border:none;cursor:pointer;font-size:18px;padding:4px;';
            btnEditar.dataset.action = 'editar';

            btnEditar.dataset.id           = aluno.id;
            btnEditar.dataset.nome         = aluno.nome;
            btnEditar.dataset.nasc         = aluno.data_nascimento || '';
            btnEditar.dataset.cpf          = aluno.cpf             || '';
            btnEditar.dataset.faixainicial = aluno.faixa_inicial_cadastro || '';
            btnEditar.dataset.dobok        = aluno.tamanho_dobok   || '';
            btnEditar.dataset.faixa        = aluno.tamanho_faixa   || '';
            btnEditar.dataset.obs          = aluno.observacoes     || '';

            tdEditar.appendChild(btnEditar);
        } else {
            // Conta de dono de escola (sem privilégio de edição)
            const spanBloqueado = document.createElement('span');
            spanBloqueado.textContent = 'Bloqueado';
            spanBloqueado.style.color = '#555';
            spanBloqueado.style.fontSize = '11px';
            spanBloqueado.style.textTransform = 'uppercase';
            tdEditar.appendChild(spanBloqueado);
        }

        const btnCertificado = document.createElement('button');
        btnCertificado.textContent    = '🖨️';
        btnCertificado.title          = 'Imprimir Certificado (Último Exame)';
        btnCertificado.style.cssText  = 'background:none;border:none;cursor:pointer;font-size:18px;padding:4px;margin-left:5px;';
        btnCertificado.onclick = () => window.open(`certificado.html?ids=${aluno.id}`, '_blank');
        tdEditar.appendChild(btnCertificado);

        // --- Coluna 7: Botão de Presença ---
        const tdPresenca = document.createElement('td');
        tdPresenca.style.textAlign = 'right';

        if (jaTemPresenca) {
            const lacre = document.createElement('span');
            lacre.style.cssText = 'padding:6px 12px;font-size:12px;background:#1c1c1e;color:#8e8e93;border:1px solid #2c2c2e;border-radius:4px;display:inline-block;';
            lacre.textContent   = '🔒 Registrada';
            tdPresenca.appendChild(lacre);
        } else {
            const btnPresenca        = document.createElement('button');
            btnPresenca.textContent  = '✔ Presença';
            btnPresenca.style.cssText = 'padding:6px 12px;font-size:12px;background:#2c421c;color:#30d158;border:1px solid #1c421c;border-radius:4px;cursor:pointer;font-weight:bold;';
            btnPresenca.dataset.action  = 'presenca';
            btnPresenca.dataset.alunoId = aluno.id;
            tdPresenca.appendChild(btnPresenca);
        }

        // --- Monta a linha ---
        tr.appendChild(tdFoto);
        tr.appendChild(tdNome);
        tr.appendChild(tdIdade);
        tr.appendChild(tdGrad);
        tr.appendChild(tdHoras);
        tr.appendChild(tdEditar);
        tr.appendChild(tdPresenca);

        tabela.appendChild(tr);
    });
}


// ============================================================================
// 6. EVENT DELEGATION NO TBODY — elimina onClick inline
//
// Em vez de onclick="prepararEdicao(...)" ou onclick="registrarPresenca(...)"
// no HTML gerado, usamos um único listener no elemento pai (tabela).
// Isso é mais seguro (nenhuma string de dados externa em atributos de evento)
// e mais eficiente (1 listener para N botões).
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    const tabelaChamada = document.getElementById('tabelaChamada');

    if (tabelaChamada) {
        tabelaChamada.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return; // Clique fora de botões de ação

            if (btn.dataset.action === 'editar') {
                // Passa o dataset completo para prepararEdicao()
                prepararEdicao(btn.dataset);
            }

            if (btn.dataset.action === 'presenca') {
                registrarPresenca(btn.dataset.alunoId);
            }
        });
    }
});


// ============================================================================
// 7. OPERAÇÕES DE FLUXO: GRAVAÇÃO DE PRESENÇAS COM ANTI-DUPLICIDADE
// ============================================================================

/**
 * Registra a presença de um aluno na data selecionada.
 * Verifica duplicidade antes de inserir (busca aluno_id + data_aula).
 *
 * @param {string} alunoId - UUID do aluno (vem do data-aluno-id do botão)
 */
async function registrarPresenca(alunoId) {
    const dataAula = document.getElementById('data_chamada')?.value;

    if (!dataAula) {
        exibirToast('Selecione uma data de aula antes de registrar.', 'aviso');
        return;
    }

    // Validação básica do UUID antes de fazer a query
    if (!validarUUID(alunoId)) {
        console.error('UUID inválido em registrarPresenca:', alunoId);
        return;
    }

    // --- VERIFICAÇÃO DE DUPLICIDADE ---
    const { data: presencaExistente } = await supabaseClient
        .from('registro_presencas')
        .select('id')
        .eq('aluno_id', alunoId)
        .eq('data_aula', dataAula);

    if (presencaExistente && presencaExistente.length > 0) {
        exibirToast('⚠️ Este aluno já tem presença registrada hoje!', 'aviso');
        return;
    }

    // --- INSERT DE PRESENÇA ---
    // horas_aula: 1 = 1 treino = 1 hora (padrão do dojang)
    const { error } = await supabaseClient
        .from('registro_presencas')
        .insert([{ aluno_id: alunoId, data_aula: dataAula, horas_aula: 1 }]);

    if (error) {
        exibirToast(`Erro ao registrar: ${error.message}`, 'erro', 5000);
    } else {
        // Recarrega a tabela para refletir o botão "Registrada"
        carregarListaChamada();
        if (typeof carregarRelatorioPresenca === 'function') {
            relatorioCacheCarregado = false;
        }
    }
}


// ============================================================================
// 8. INICIALIZAÇÃO DO SISTEMA (DOM Ready)
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    const tabelaExistente = document.getElementById('tabelaChamada');

    if (tabelaExistente) {
        console.log("📅 Painel detectado. Iniciando chamada...");

        // Carga inicial da chamada
        carregarListaChamada();

        // Listener do formulário de cadastro/edição
        const form = document.getElementById('formAluno');
        if (form) {
            form.addEventListener('submit', cadastrarAluno);
        }

        // Atualiza a lista quando o usuário muda a data
        const campoData = document.getElementById('data_chamada');
        if (campoData) {
            campoData.addEventListener('change', carregarListaChamada);
        }
    } else {
        console.log("🏠 Tela sem painel. Conexao.js em espera.");
    }
});


// ============================================================================
// 9. RELATÓRIO DE PRESENÇAS E FREQUÊNCIA (A PARTIR DE OUTUBRO/2026)
//    - Filtro Mensal, Por Data de Aula ou Intervalo de Datas (>= 2026-10-01)
//    - Lista com Todos os Alunos, Datas que Vieram e Datas que Faltaram
//    - Gerador de Texto Pronto para WhatsApp (Copia e Cola / Envio Direto)
//    - Abertura de Página Externa para PDF Detalhado (relatorio-presenca.html)
// ============================================================================

const DATA_CORTE_OUTUBRO = '2026-10-01';

let relatorioAlunosCache    = [];
let relatorioPresencasCache = [];
let relatorioCacheCarregado = false;
let formatoWhatsAtual       = 'simples';
let visaoRelatorioAtual     = 'cards';

const NOMES_MESES_PT = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const DIAS_SEMANA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_SEMANA_LONGO = [
    'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
    'Quinta-feira', 'Sexta-feira', 'Sábado'
];

/**
 * Formata "YYYY-MM-DD" para "DD/MM" sem risco de deslocamento de fuso horário.
 */
function formatarDataCurta(dataISO) {
    if (!dataISO) return '';
    const partes = dataISO.split('-');
    if (partes.length !== 3) return dataISO;
    return `${partes[2]}/${partes[1]}`;
}

/**
 * Formata "YYYY-MM-DD" para "DD/MM/YYYY" sem deslocamento de fuso horário.
 */
function formatarDataBR(dataISO) {
    if (!dataISO) return '';
    const partes = dataISO.split('-');
    if (partes.length !== 3) return dataISO;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

/**
 * Retorna o nome do dia da semana para uma string "YYYY-MM-DD".
 */
function obterDiaSemana(dataISO, curto = true) {
    if (!dataISO) return '';
    const [ano, mes, dia] = dataISO.split('-').map(Number);
    const dt = new Date(ano, mes - 1, dia);
    return curto ? DIAS_SEMANA_CURTO[dt.getDay()] : DIAS_SEMANA_LONGO[dt.getDay()];
}

/**
 * Formata "YYYY-MM" para "Outubro / 2026".
 */
function formatarAnoMes(anoMes) {
    if (!anoMes || anoMes === 'todos') return 'Desde Outubro/2026 (Acumulado)';
    const [ano, mes] = anoMes.split('-').map(Number);
    const nomeMes = NOMES_MESES_PT[(mes || 1) - 1] || anoMes;
    return `${nomeMes} / ${ano}`;
}

/**
 * Carrega alunos ativos e registros de presença (>= 2026-10-01) do Supabase.
 */
async function carregarRelatorioPresenca(forcarRecarga = false) {
    const containerCards = document.getElementById('relatorio_visao_cards');
    if (!containerCards) return;

    if (!relatorioCacheCarregado || forcarRecarga) {
        containerCards.innerHTML = '<div style="padding: 24px; text-align: center; color: #8e8e93;">Carregando lista de presença a partir de Outubro/2026...</div>';

        const [resAlunos, resPresencas] = await Promise.all([
            supabaseClient
                .from('alunos')
                .select(`
                    id,
                    nome,
                    data_nascimento,
                    status,
                    faixa_inicial_cadastro,
                    progresso_tecnico (faixa_atual, horas_acumuladas)
                `)
                .eq('status', 'ativo')
                .order('nome', { ascending: true }),
            supabaseClient
                .from('registro_presencas')
                .select('id, aluno_id, data_aula, horas_aula')
                .gte('data_aula', DATA_CORTE_OUTUBRO)
                .order('data_aula', { ascending: true })
        ]);

        if (resAlunos.error || resPresencas.error) {
            console.error('❌ Erro ao carregar relatório:', resAlunos.error || resPresencas.error);
            exibirToast('Erro ao carregar dados de presença.', 'erro');
            return;
        }

        relatorioAlunosCache    = resAlunos.data    || [];
        relatorioPresencasCache = resPresencas.data || [];
        relatorioCacheCarregado = true;

        popularOpcoesFiltroRelatorio();
    }

    renderizarRelatorioPresenca();
}

/**
 * Popula os selects de meses (a partir de 2026-10) e de datas de aula registradas.
 */
function popularOpcoesFiltroRelatorio() {
    const selectMes  = document.getElementById('relatorio_mes');
    const selectAula = document.getElementById('relatorio_select_aula');
    const inputFim   = document.getElementById('relatorio_data_fim');
    const inputUnica = document.getElementById('relatorio_data_unica');

    // Extrai todas as datas de aula distintas (>= 2026-10-01)
    const datasDistintas = [...new Set(relatorioPresencasCache.map(p => p.data_aula))]
        .filter(d => d >= DATA_CORTE_OUTUBRO)
        .sort();

    // Gera lista de meses desde 2026-10 até o maior mês entre hoje e o banco
    const hojeISO = new Date().toISOString().split('T')[0];
    const ultimaData = datasDistintas.length > 0
        ? (datasDistintas[datasDistintas.length - 1] > hojeISO ? datasDistintas[datasDistintas.length - 1] : hojeISO)
        : (hojeISO >= DATA_CORTE_OUTUBRO ? hojeISO : '2026-10-01');

    if (inputFim && !inputFim.value) {
        inputFim.value = ultimaData;
    }

    const mesesSet = new Set(['2026-10']);
    datasDistintas.forEach(d => mesesSet.add(d.slice(0, 7)));

    // Adiciona meses corridos de 2026-10 até o mês de ultimaData
    let [anoCur, mesCur] = [2026, 10];
    const [anoMax, mesMax] = ultimaData.slice(0, 7).split('-').map(Number);
    while (anoCur < anoMax || (anoCur === anoMax && mesCur <= mesMax)) {
        const ym = `${anoCur}-${String(mesCur).padStart(2, '0')}`;
        mesesSet.add(ym);
        mesCur++;
        if (mesCur > 12) { mesCur = 1; anoCur++; }
    }

    const mesesOrdenados = [...mesesSet].filter(m => m >= '2026-10').sort().reverse();

    if (selectMes) {
        const valorAnterior = selectMes.value;
        selectMes.innerHTML = '';

        const optTodos = document.createElement('option');
        optTodos.value = 'todos';
        optTodos.textContent = `📊 Todos (Desde Outubro/2026 — ${datasDistintas.length} aulas)`;
        selectMes.appendChild(optTodos);

        mesesOrdenados.forEach(ym => {
            const qtdAulasMes = datasDistintas.filter(d => d.startsWith(ym)).length;
            const opt = document.createElement('option');
            opt.value = ym;
            opt.textContent = `📅 ${formatarAnoMes(ym)} (${qtdAulasMes} ${qtdAulasMes === 1 ? 'aula' : 'aulas'})`;
            selectMes.appendChild(opt);
        });

        if (valorAnterior && [...selectMes.options].some(o => o.value === valorAnterior)) {
            selectMes.value = valorAnterior;
        } else {
            // Padrão: Todos desde Outubro/2026 para já exibir tudo de Outubro em diante
            selectMes.value = 'todos';
        }
    }

    if (selectAula) {
        const valorAulaAnt = selectAula.value;
        selectAula.innerHTML = '';

        const datasReverso = [...datasDistintas].reverse();
        if (datasReverso.length === 0) {
            const optVazio = document.createElement('option');
            optVazio.value = '';
            optVazio.textContent = 'Nenhuma aula registrada desde Out/2026';
            selectAula.appendChild(optVazio);
        } else {
            datasReverso.forEach(dt => {
                const qtdPres = relatorioPresencasCache.filter(p => p.data_aula === dt).length;
                const opt = document.createElement('option');
                opt.value = dt;
                opt.textContent = `${formatarDataBR(dt)} (${obterDiaSemana(dt, true)}) — ${qtdPres} presentes`;
                selectAula.appendChild(opt);
            });
        }

        const dataPadraoAula = (valorAulaAnt && datasDistintas.includes(valorAulaAnt))
            ? valorAulaAnt
            : (datasReverso[0] || DATA_CORTE_OUTUBRO);

        selectAula.value = dataPadraoAula;
        if (inputUnica && !inputUnica.value) {
            inputUnica.value = dataPadraoAula;
        }
    }
}

/**
 * Alterna os campos visíveis conforme o modo de filtro (mensal | data | periodo).
 */
function alternarModoFiltroRelatorio() {
    const modo = document.getElementById('relatorio_modo_filtro')?.value || 'mensal';

    const gMes        = document.getElementById('grupo_filtro_mes');
    const gDataSelect = document.getElementById('grupo_filtro_data_aula');
    const gDataInput  = document.getElementById('grupo_filtro_data_input');
    const gInicio     = document.getElementById('grupo_filtro_inicio');
    const gFim        = document.getElementById('grupo_filtro_fim');

    if (gMes)        gMes.style.display        = (modo === 'mensal')  ? 'flex' : 'none';
    if (gDataSelect) gDataSelect.style.display = (modo === 'data')    ? 'flex' : 'none';
    if (gDataInput)  gDataInput.style.display  = (modo === 'data')    ? 'flex' : 'none';
    if (gInicio)     gInicio.style.display     = (modo === 'periodo') ? 'flex' : 'none';
    if (gFim)        gFim.style.display        = (modo === 'periodo') ? 'flex' : 'none';

    renderizarRelatorioPresenca();
}

/**
 * Sincroniza o select de aulas registradas com o input type="date" de data única.
 */
function sincronizarDataAulaSelect() {
    const selectAula = document.getElementById('relatorio_select_aula');
    const inputUnica = document.getElementById('relatorio_data_unica');
    if (selectAula && inputUnica && selectAula.value) {
        inputUnica.value = selectAula.value;
    }
    renderizarRelatorioPresenca();
}

/**
 * Retorna os metadados do período filtrado atual e as datas de aula correspondentes.
 */
function obterContextoPeriodoRelatorio() {
    const modo = document.getElementById('relatorio_modo_filtro')?.value || 'mensal';
    const todasDatasBanco = [...new Set(relatorioPresencasCache.map(p => p.data_aula))]
        .filter(d => d >= DATA_CORTE_OUTUBRO)
        .sort();

    let datasAulas = [];
    let tituloPeriodo = '';

    if (modo === 'mensal') {
        const mesEscolhido = document.getElementById('relatorio_mes')?.value || 'todos';
        if (mesEscolhido === 'todos') {
            datasAulas = todasDatasBanco;
            tituloPeriodo = 'Outubro/2026 em diante (Acumulado)';
        } else {
            datasAulas = todasDatasBanco.filter(d => d.startsWith(mesEscolhido));
            tituloPeriodo = formatarAnoMes(mesEscolhido);
        }
    } else if (modo === 'data') {
        let dataUnica = document.getElementById('relatorio_data_unica')?.value
            || document.getElementById('relatorio_select_aula')?.value
            || DATA_CORTE_OUTUBRO;
        if (dataUnica < DATA_CORTE_OUTUBRO) dataUnica = DATA_CORTE_OUTUBRO;
        datasAulas = [dataUnica];
        tituloPeriodo = `Aula de ${formatarDataBR(dataUnica)} (${obterDiaSemana(dataUnica, false)})`;
    } else if (modo === 'periodo') {
        let dtInicio = document.getElementById('relatorio_data_inicio')?.value || DATA_CORTE_OUTUBRO;
        let dtFim    = document.getElementById('relatorio_data_fim')?.value    || '2099-12-31';
        if (dtInicio < DATA_CORTE_OUTUBRO) dtInicio = DATA_CORTE_OUTUBRO;
        if (dtFim < dtInicio) dtFim = dtInicio;

        datasAulas = todasDatasBanco.filter(d => d >= dtInicio && d <= dtFim);
        tituloPeriodo = `De ${formatarDataBR(dtInicio)} até ${formatarDataBR(dtFim)}`;
    }

    return { modo, datasAulas, tituloPeriodo };
}

/**
 * Processa os dados de todos os alunos no período ativo e renderiza:
 *   1. KPIs de resumo
 *   2. Caixa de texto formatada para WhatsApp (Copia e Cola)
 *   3. Visão em Cards (Nome completo + Datas que vieram + Datas que faltaram)
 *   4. Visão em Grade / Matriz (Tabela cruzada Aluno x Data)
 */
function renderizarRelatorioPresenca() {
    const { modo, datasAulas, tituloPeriodo } = obterContextoPeriodoRelatorio();
    const termoBusca   = (document.getElementById('relatorio_busca_aluno')?.value || '').trim().toLowerCase();
    const filtroStatus = document.getElementById('relatorio_filtro_status')?.value || 'todos';

    const setDatasPeriodo = new Set(datasAulas);

    // Mapeia presenças por aluno_id dentro do conjunto de datas do período
    const mapaPresencasAluno = new Map();
    relatorioPresencasCache.forEach(reg => {
        if (setDatasPeriodo.has(reg.data_aula)) {
            if (!mapaPresencasAluno.has(reg.aluno_id)) {
                mapaPresencasAluno.set(reg.aluno_id, new Set());
            }
            mapaPresencasAluno.get(reg.aluno_id).add(reg.data_aula);
        }
    });

    // Monta a lista consolidada de cada aluno
    const listaConsolidada = relatorioAlunosCache.map(aluno => {
        const setVeio = mapaPresencasAluno.get(aluno.id) || new Set();
        const datasVieram   = datasAulas.filter(d => setVeio.has(d));
        const datasFaltaram = datasAulas.filter(d => !setVeio.has(d));

        const progresso = (aluno.progresso_tecnico && aluno.progresso_tecnico[0])
            ? aluno.progresso_tecnico[0]
            : { faixa_atual: aluno.faixa_inicial_cadastro || 'Branca', horas_acumuladas: 0 };

        const totalAulas = datasAulas.length;
        const qtdVieram  = datasVieram.length;
        const qtdFaltas  = datasFaltaram.length;
        const freqPct    = totalAulas > 0 ? Math.round((qtdVieram / totalAulas) * 100) : 0;

        return {
            id: aluno.id,
            nome: aluno.nome,
            faixa: progresso.faixa_atual || 'Branca',
            horasAcumuladas: progresso.horas_acumuladas || 0,
            datasVieram,
            datasFaltaram,
            qtdVieram,
            qtdFaltas,
            totalAulas,
            freqPct
        };
    });

    // Filtra por nome e por status selecionado
    const listaFiltrada = listaConsolidada.filter(item => {
        if (termoBusca && !item.nome.toLowerCase().includes(termoBusca)) {
            return false;
        }
        if (filtroStatus === 'vieram' && item.qtdVieram === 0) return false;
        if (filtroStatus === 'faltaram' && item.qtdFaltas === 0) return false;
        if (filtroStatus === 'sem_presenca' && item.qtdVieram > 0) return false;
        return true;
    });

    // 1. Atualiza KPIs
    const totalPresencasPeriodo = listaFiltrada.reduce((acc, a) => acc + a.qtdVieram, 0);
    const totalPossivel = listaFiltrada.length * datasAulas.length;
    const mediaFreq = totalPossivel > 0 ? Math.round((totalPresencasPeriodo / totalPossivel) * 100) : 0;

    const elKpiAlunos    = document.getElementById('kpi_total_alunos');
    const elSubAlunos    = document.getElementById('kpi_sub_alunos');
    const elKpiAulas     = document.getElementById('kpi_total_aulas');
    const elSubAulas     = document.getElementById('kpi_sub_aulas');
    const elKpiPresencas = document.getElementById('kpi_total_presencas');
    const elSubPresencas = document.getElementById('kpi_sub_presencas');
    const elKpiFreq      = document.getElementById('kpi_media_freq');
    const elSubFreq      = document.getElementById('kpi_sub_freq');

    if (elKpiAlunos)    elKpiAlunos.textContent    = String(listaFiltrada.length);
    if (elSubAlunos)    elSubAlunos.textContent    = `${relatorioAlunosCache.length} alunos ativos no total`;
    if (elKpiAulas)     elKpiAulas.textContent     = String(datasAulas.length);
    if (elSubAulas)     elSubAulas.textContent     = datasAulas.length > 0
        ? `Dias: ${datasAulas.map(formatarDataCurta).join(', ')}`
        : 'Nenhuma aula neste filtro';
    if (elKpiPresencas) elKpiPresencas.textContent = String(totalPresencasPeriodo);
    if (elSubPresencas) elSubPresencas.textContent = `${listaFiltrada.reduce((acc, a) => acc + a.qtdFaltas, 0)} faltas no período`;
    if (elKpiFreq)      elKpiFreq.textContent      = `${mediaFreq}%`;
    if (elSubFreq)      elSubFreq.textContent      = tituloPeriodo;

    // 2. Atualiza o texto para WhatsApp (Copia e Cola)
    gerarTextoWhatsApp(listaFiltrada, datasAulas, tituloPeriodo);

    // 3. Renderiza Visão de Cards (Lista detalhada com Datas que Vieram e Faltaram)
    renderizarCardsRelatorio(listaFiltrada, datasAulas);

    // 4. Renderiza Visão de Matriz Cruzada
    renderizarMatrizRelatorio(listaFiltrada, datasAulas);
}

/**
 * Gera o texto formatado para copiar e enviar no WhatsApp conforme o formato escolhido.
 */
function gerarTextoWhatsApp(listaAlunos, datasAulas, tituloPeriodo) {
    const textarea = document.getElementById('texto_whatsapp_relatorio');
    const contador = document.getElementById('contador_linhas_whats');
    if (!textarea) return;

    const datasCurtasAulas = datasAulas.map(formatarDataCurta).join(', ');
    const linhas = [];

    if (formatoWhatsAtual === 'simples') {
        // Formato 1 (Padrão pedido): Nome completo e os dias que vieram (fácil leitura e cópia)
        linhas.push(`🥋 *LISTA DE PRESENÇA — WIL TKD*`);
        linhas.push(`📅 *Período:* ${tituloPeriodo}`);
        if (datasAulas.length > 0) {
            linhas.push(`🗓️ *Dias de aula (${datasAulas.length}):* ${datasCurtasAulas}`);
        }
        linhas.push(`--------------------------------`);

        listaAlunos.forEach((a, idx) => {
            const diasVeioTexto = a.datasVieram.length > 0
                ? a.datasVieram.map(formatarDataCurta).join(', ')
                : 'Nenhuma presença registrada';
            linhas.push(`${idx + 1}. *${a.nome}* (${a.qtdVieram}/${a.totalAulas})`);
            linhas.push(`   ✅ Veio: ${diasVeioTexto}`);
        });

    } else if (formatoWhatsAtual === 'compacto') {
        // Formato 2: Super compacto (1 linha por aluno: Nome Completo — dias que vieram)
        linhas.push(`🥋 *PRESENÇAS WIL TKD — ${tituloPeriodo}*`);
        if (datasAulas.length > 0) {
            linhas.push(`🗓️ Aulas (${datasAulas.length}): ${datasCurtasAulas}`);
        }
        linhas.push(``);

        listaAlunos.forEach(a => {
            const diasVeioTexto = a.datasVieram.length > 0
                ? a.datasVieram.map(formatarDataCurta).join(', ')
                : '—';
            linhas.push(`• *${a.nome}*: ${diasVeioTexto} (${a.qtdVieram}p)`);
        });

    } else if (formatoWhatsAtual === 'completo') {
        // Formato 3: Completo com Dias que Vieram + Dias que Faltaram
        linhas.push(`🥋 *RELATÓRIO DE PRESENÇA E FALTAS — WIL TKD*`);
        linhas.push(`📅 *Período:* ${tituloPeriodo} (${datasAulas.length} aulas)`);
        linhas.push(`--------------------------------`);

        listaAlunos.forEach((a, idx) => {
            const veioStr = a.datasVieram.length > 0
                ? a.datasVieram.map(formatarDataCurta).join(', ')
                : 'Nenhum dia';
            const faltouStr = a.datasFaltaram.length > 0
                ? a.datasFaltaram.map(formatarDataCurta).join(', ')
                : 'Nenhuma falta';

            linhas.push(`${idx + 1}. *${a.nome}* — ${a.qtdVieram}P | ${a.qtdFaltas}F (${a.freqPct}%)`);
            linhas.push(`   ✅ Vieram: ${veioStr}`);
            linhas.push(`   ❌ Faltaram: ${faltouStr}`);
        });

    } else if (formatoWhatsAtual === 'por_dia') {
        // Formato 4: Separado por Presentes ✅ e Faltantes ❌ (ótimo para chamada de 1 dia ou resumo)
        linhas.push(`🥋 *CHAMADA / FREQUÊNCIA — WIL TKD*`);
        linhas.push(`📅 *Período:* ${tituloPeriodo}`);
        if (datasAulas.length > 1) {
            linhas.push(`🗓️ *Aulas (${datasAulas.length}):* ${datasCurtasAulas}`);
        }
        linhas.push(``);

        const presentes = listaAlunos.filter(a => a.qtdVieram > 0);
        const ausentes  = listaAlunos.filter(a => a.qtdVieram === 0);

        linhas.push(`✅ *PRESENTES (${presentes.length}):*`);
        if (presentes.length === 0) {
            linhas.push(`• Nenhum aluno com presença`);
        } else {
            presentes.forEach(a => {
                if (datasAulas.length === 1) {
                    linhas.push(`• ${a.nome}`);
                } else {
                    linhas.push(`• *${a.nome}* — ${a.datasVieram.map(formatarDataCurta).join(', ')} (${a.qtdVieram}/${a.totalAulas})`);
                }
            });
        }

        linhas.push(``);
        linhas.push(`❌ *SEM PRESENÇA / FALTARAM (${ausentes.length}):*`);
        if (ausentes.length === 0) {
            linhas.push(`• Todos compareceram!`);
        } else {
            ausentes.forEach(a => {
                linhas.push(`• ${a.nome}`);
            });
        }
    }

    textarea.value = linhas.join('\n');
    if (contador) {
        contador.textContent = `${listaAlunos.length} alunos listados • ${datasAulas.length} dias de aula`;
    }
}

/**
 * Seleciona o formato do texto para WhatsApp e atualiza a caixa.
 */
function selecionarFormatoWhats(formato, btnClicado) {
    formatoWhatsAtual = formato;
    document.querySelectorAll('.btn-formato-whats').forEach(b => b.classList.remove('ativo'));
    if (btnClicado) btnClicado.classList.add('ativo');
    renderizarRelatorioPresenca();
}

/**
 * Copia todo o conteúdo da caixa de texto do WhatsApp para a área de transferência.
 */
async function copiarTextoRelatorioWhats() {
    const textarea = document.getElementById('texto_whatsapp_relatorio');
    if (!textarea || !textarea.value) {
        exibirToast('Não há texto para copiar.', 'aviso');
        return;
    }

    try {
        await navigator.clipboard.writeText(textarea.value);
        exibirToast('✅ Lista copiada! Agora é só colar no WhatsApp.', 'sucesso');
    } catch (err) {
        textarea.select();
        document.execCommand('copy');
        exibirToast('✅ Lista copiada para a área de transferência!', 'sucesso');
    }
}

/**
 * Abre o WhatsApp diretamente com o texto gerado.
 */
function enviarRelatorioWhatsDireto() {
    const textarea = document.getElementById('texto_whatsapp_relatorio');
    if (!textarea || !textarea.value) {
        exibirToast('Lista vazia.', 'aviso');
        return;
    }
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(textarea.value)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Copia os dados de presença e faltas de UM único aluno para enviar individualmente no WhatsApp.
 */
async function copiarResumoIndividualAluno(item, tituloPeriodo) {
    const veioStr = item.datasVieram.length > 0
        ? item.datasVieram.map(formatarDataCurta).join(', ')
        : 'Nenhuma presença registrada';
    const faltouStr = item.datasFaltaram.length > 0
        ? item.datasFaltaram.map(formatarDataCurta).join(', ')
        : 'Nenhuma falta';

    const texto = [
        `🥋 *FREQUÊNCIA INDIVIDUAL — WIL TKD*`,
        `👤 *Aluno(a):* ${item.nome}`,
        `📅 *Período:* ${tituloPeriodo}`,
        `📊 *Resumo:* ${item.qtdVieram} presenças | ${item.qtdFaltas} faltas (${item.freqPct}%)`,
        `✅ *Dias que veio:* ${veioStr}`,
        `❌ *Dias que faltou:* ${faltouStr}`
    ].join('\n');

    try {
        await navigator.clipboard.writeText(texto);
        exibirToast(`✅ Dados de ${item.nome} copiados!`, 'sucesso');
    } catch (e) {
        exibirToast('Erro ao copiar texto.', 'erro');
    }
}

/**
 * Renderiza a lista visual de alunos com Nome Completo, Datas que Vieram e Datas que Faltaram.
 */
function renderizarCardsRelatorio(listaFiltrada, datasAulas) {
    const container = document.getElementById('relatorio_visao_cards');
    if (!container) return;
    container.innerHTML = '';

    const { tituloPeriodo } = obterContextoPeriodoRelatorio();

    if (listaFiltrada.length === 0) {
        const vazio = document.createElement('div');
        vazio.style.cssText = 'padding: 24px; text-align: center; color: #8e8e93; background: #141414; border-radius: 10px; border: 1px solid #262626;';
        vazio.textContent = 'Nenhum aluno encontrado para este filtro.';
        container.appendChild(vazio);
        return;
    }

    listaFiltrada.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'aluno-presenca-card';

        // Topo do card: Nome Completo + Badges + Botão copiar individual
        const topo = document.createElement('div');
        topo.className = 'aluno-presenca-topo';

        const divNome = document.createElement('div');
        divNome.className = 'aluno-presenca-nome';

        const spanNumNome = document.createElement('span');
        spanNumNome.textContent = `${index + 1}. ${item.nome}`;

        const spanGrad = document.createElement('span');
        spanGrad.className = 'aluno-presenca-grad';
        spanGrad.textContent = `🥋 ${item.faixa}`;

        divNome.appendChild(spanNumNome);
        divNome.appendChild(spanGrad);

        const divBadges = document.createElement('div');
        divBadges.className = 'aluno-presenca-badges';

        const pillVeio = document.createElement('span');
        pillVeio.className = 'pill-stat pill-veio';
        pillVeio.textContent = `✔ ${item.qtdVieram} ${item.qtdVieram === 1 ? 'presença' : 'presenças'}`;

        const pillFaltou = document.createElement('span');
        pillFaltou.className = 'pill-stat pill-faltou';
        pillFaltou.textContent = `✖ ${item.qtdFaltas} ${item.qtdFaltas === 1 ? 'falta' : 'faltas'}`;

        const pillFreq = document.createElement('span');
        pillFreq.className = 'pill-stat pill-freq';
        pillFreq.textContent = `${item.freqPct}%`;

        const btnCopiarUm = document.createElement('button');
        btnCopiarUm.type = 'button';
        btnCopiarUm.className = 'btn-copiar-individual';
        btnCopiarUm.textContent = '📋 Copiar Aluno';
        btnCopiarUm.onclick = () => copiarResumoIndividualAluno(item, tituloPeriodo);

        divBadges.appendChild(pillVeio);
        divBadges.appendChild(pillFaltou);
        divBadges.appendChild(pillFreq);
        divBadges.appendChild(btnCopiarUm);

        topo.appendChild(divNome);
        topo.appendChild(divBadges);

        // Grade de Datas: Coluna 1 = Datas que Vieram | Coluna 2 = Datas que Faltaram
        const gridDatas = document.createElement('div');
        gridDatas.className = 'aluno-datas-grid';

        // Bloco Vieram
        const blocoVeio = document.createElement('div');
        blocoVeio.className = 'bloco-datas-linha';
        const labelVeio = document.createElement('span');
        labelVeio.className = 'bloco-datas-label';
        labelVeio.style.color = '#30d158';
        labelVeio.textContent = `✅ Dias que veio (${item.qtdVieram}):`;
        blocoVeio.appendChild(labelVeio);

        if (item.datasVieram.length === 0) {
            const txtSem = document.createElement('span');
            txtSem.style.color = '#636366';
            txtSem.textContent = 'Nenhuma presença registrada neste período';
            blocoVeio.appendChild(txtSem);
        } else {
            item.datasVieram.forEach(dt => {
                const chip = document.createElement('span');
                chip.className = 'data-chip data-chip-veio';
                chip.title = `${formatarDataBR(dt)} (${obterDiaSemana(dt, false)})`;
                chip.textContent = formatarDataCurta(dt);
                blocoVeio.appendChild(chip);
            });
        }

        // Bloco Faltaram
        const blocoFaltou = document.createElement('div');
        blocoFaltou.className = 'bloco-datas-linha';
        const labelFaltou = document.createElement('span');
        labelFaltou.className = 'bloco-datas-label';
        labelFaltou.style.color = '#ff6961';
        labelFaltou.textContent = `❌ Dias que faltou (${item.qtdFaltas}):`;
        blocoFaltou.appendChild(labelFaltou);

        if (datasAulas.length === 0) {
            const txtSemAula = document.createElement('span');
            txtSemAula.style.color = '#636366';
            txtSemAula.textContent = 'Sem aulas no período';
            blocoFaltou.appendChild(txtSemAula);
        } else if (item.datasFaltaram.length === 0) {
            const txtZero = document.createElement('span');
            txtZero.style.color = '#30d158';
            txtZero.textContent = '100% presente! Nenhuma falta no período.';
            blocoFaltou.appendChild(txtZero);
        } else {
            item.datasFaltaram.forEach(dt => {
                const chip = document.createElement('span');
                chip.className = 'data-chip data-chip-faltou';
                chip.title = `${formatarDataBR(dt)} (${obterDiaSemana(dt, false)})`;
                chip.textContent = formatarDataCurta(dt);
                blocoFaltou.appendChild(chip);
            });
        }

        gridDatas.appendChild(blocoVeio);
        gridDatas.appendChild(blocoFaltou);

        card.appendChild(topo);
        card.appendChild(gridDatas);
        container.appendChild(card);
    });
}

/**
 * Renderiza a Grade / Matriz Cruzada (Alunos nas linhas x Datas de Aula nas colunas).
 */
function renderizarMatrizRelatorio(listaFiltrada, datasAulas) {
    const tabela = document.getElementById('tabela_matriz_presenca');
    if (!tabela) return;
    tabela.innerHTML = '';

    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');

    const thNome = document.createElement('th');
    thNome.textContent = 'Aluno (Nome Completo)';
    trHead.appendChild(thNome);

    datasAulas.forEach(dt => {
        const thDia = document.createElement('th');
        thDia.innerHTML = `${sanitizar(formatarDataCurta(dt))}<br><span style="font-size:9.5px;color:#777;font-weight:normal;">${sanitizar(obterDiaSemana(dt, true))}</span>`;
        trHead.appendChild(thDia);
    });

    const thPres = document.createElement('th');
    thPres.style.color = '#30d158';
    thPres.textContent = 'Veio';
    trHead.appendChild(thPres);

    const thFaltas = document.createElement('th');
    thFaltas.style.color = '#ff6961';
    thFaltas.textContent = 'Faltou';
    trHead.appendChild(thFaltas);

    const thPct = document.createElement('th');
    thPct.textContent = '% Freq';
    trHead.appendChild(thPct);

    thead.appendChild(trHead);
    tabela.appendChild(thead);

    const tbody = document.createElement('tbody');

    listaFiltrada.forEach((item, idx) => {
        const tr = document.createElement('tr');
        const setVeio = new Set(item.datasVieram);

        const tdNome = document.createElement('td');
        tdNome.textContent = `${idx + 1}. ${item.nome}`;
        tr.appendChild(tdNome);

        datasAulas.forEach(dt => {
            const td = document.createElement('td');
            const veio = setVeio.has(dt);
            if (veio) {
                td.style.color = '#30d158';
                td.style.fontWeight = 'bold';
                td.textContent = '✔';
                td.title = `${item.nome} — Presente em ${formatarDataBR(dt)}`;
            } else {
                td.style.color = '#ff453a';
                td.style.opacity = '0.6';
                td.textContent = '✖';
                td.title = `${item.nome} — Faltou em ${formatarDataBR(dt)}`;
            }
            tr.appendChild(td);
        });

        const tdVeio = document.createElement('td');
        tdVeio.style.fontWeight = 'bold';
        tdVeio.style.color = '#30d158';
        tdVeio.textContent = String(item.qtdVieram);
        tr.appendChild(tdVeio);

        const tdFaltou = document.createElement('td');
        tdFaltou.style.fontWeight = 'bold';
        tdFaltou.style.color = '#ff6961';
        tdFaltou.textContent = String(item.qtdFaltas);
        tr.appendChild(tdFaltou);

        const tdFreq = document.createElement('td');
        tdFreq.style.fontWeight = 'bold';
        tdFreq.textContent = `${item.freqPct}%`;
        tr.appendChild(tdFreq);

        tbody.appendChild(tr);
    });

    tabela.appendChild(tbody);
}

/**
 * Alterna entre a visão de Cards (Lista Detalhada) e a Visão de Grade (Matriz).
 */
function alternarVisaoRelatorio(visao) {
    visaoRelatorioAtual = visao;
    const divCards  = document.getElementById('relatorio_visao_cards');
    const divMatriz = document.getElementById('relatorio_visao_matriz');
    const btnCards  = document.getElementById('btn_view_cards');
    const btnMatriz = document.getElementById('btn_view_matriz');

    if (visao === 'matriz') {
        if (divCards)  divCards.style.display  = 'none';
        if (divMatriz) divMatriz.style.display = 'block';
        if (btnCards)  btnCards.classList.remove('ativo');
        if (btnMatriz) btnMatriz.classList.add('ativo');
    } else {
        if (divCards)  divCards.style.display  = 'grid';
        if (divMatriz) divMatriz.style.display = 'none';
        if (btnCards)  btnCards.classList.add('ativo');
        if (btnMatriz) btnMatriz.classList.remove('ativo');
    }
}

/**
 * Abre a página dedicada externa (relatorio-presenca.html) para visualização e
 * geração do PDF detalhado, passando os filtros atuais na query string.
 */
function abrirRelatorioPDFExterno() {
    const modo   = document.getElementById('relatorio_modo_filtro')?.value || 'mensal';
    const mes    = document.getElementById('relatorio_mes')?.value || 'todos';
    const data   = document.getElementById('relatorio_data_unica')?.value || '';
    const inicio = document.getElementById('relatorio_data_inicio')?.value || DATA_CORTE_OUTUBRO;
    const fim    = document.getElementById('relatorio_data_fim')?.value || '';
    const busca  = document.getElementById('relatorio_busca_aluno')?.value || '';
    const status = document.getElementById('relatorio_filtro_status')?.value || 'todos';

    const params = new URLSearchParams({
        modo,
        mes,
        data,
        inicio,
        fim,
        busca,
        status
    });

    window.open(`relatorio-presenca.html?${params.toString()}`, '_blank');
}
