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
        const extensao       = arquivoFoto.name.split('.').pop().toLowerCase();
        const nomeUnico      = `${Date.now()}_${nome.replace(/\s+/g, '_').toLowerCase()}.${extensao}`;

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
    document.getElementById('tamanho_dobok').value = (ds.dobok && ds.dobok !== 'null') ? ds.dobok : '';
    document.getElementById('tamanho_faixa').value = (ds.faixa && ds.faixa !== 'null') ? ds.faixa : '';
    document.getElementById('observacoes').value   = (ds.obs   && ds.obs   !== 'null') ? ds.obs   : '';

    // Altera o label do botão para indicar modo de alteração
    const btnSubmit = document.querySelector('.btn-submit-cadastro');
    if (btnSubmit) btnSubmit.textContent = 'Salvar Alterações';

    // Navega para a aba de Matrícula
    if (typeof alternarAba === 'function') {
        alternarAba('aba-cadastro', document.querySelectorAll('.aba-btn')[1]);
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

            // Dados sensíveis em data-* (nunca em onclick=)
            btnEditar.dataset.id    = aluno.id;
            btnEditar.dataset.nome  = aluno.nome;
            btnEditar.dataset.nasc  = aluno.data_nascimento || '';
            btnEditar.dataset.cpf   = aluno.cpf             || '';
            btnEditar.dataset.dobok = aluno.tamanho_dobok   || '';
            btnEditar.dataset.faixa = aluno.tamanho_faixa   || '';
            btnEditar.dataset.obs   = aluno.observacoes     || '';

            tdEditar.appendChild(btnEditar);
        } else {
            // Conta de dono de escola (sem privilégio de edição)
            tdEditar.textContent = 'Bloqueado';
            tdEditar.style.color = '#555';
            tdEditar.style.fontSize = '11px';
            tdEditar.style.textTransform = 'uppercase';
        }

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