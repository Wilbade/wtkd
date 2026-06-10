// ============================================================================
// ARQUIVO: conexao.js
// PROPÓSITO: Camada central de acesso ao banco de dados (Supabase).
//            Centraliza CRUD de alunos, controle de presença diária e
//            cálculo de elegibilidade para exames de graduação.
//
// DEPENDÊNCIA EXTERNA: @supabase/supabase-js@2 (carregado via CDN no HTML)
// ESCOPO: Este arquivo é importado pelo painel.html e index.html.
//         O exame.html possui seu próprio cliente Supabase inline.
// ============================================================================


// ============================================================================
// 1. CONFIGURAÇÃO, CREDENCIAIS E INICIALIZAÇÃO DO CLIENTE SUPABASE
// ============================================================================

// URL pública do projeto no Supabase (não é segredo — é a URL da API REST)
const urlBanco = 'https://pkbusphlutnodgconbbc.supabase.co';

// Chave anônima publicável (anon key). Protegida pelas RLS policies no Supabase.
// Nunca usar a "service_role key" aqui — ela burla todas as RLS.
const chaveBanco = 'sb_publishable_AXK9wUTEpz-rSdmXYn2SUA_u8O_u6P0';

// Criação da instância global do cliente. Usada por todas as funções abaixo.
// O nome "supabaseClient" evita conflito com o namespace "supabase" da própria lib CDN.
const supabaseClient = supabase.createClient(urlBanco, chaveBanco);

/**
 * Faz uma leitura simples na tabela 'alunos' ao inicializar a página para
 * confirmar que a conexão com o Supabase está ativa e as RLS policies permitem
 * a leitura. Qualquer erro aqui indica problema de credencial ou de rede.
 */
async function testarBanco() {
    const { data, error } = await supabaseClient.from('alunos').select('*');
    if (error) {
        console.error("❌ Falha na conexão com o Supabase:", error.message);
    } else {
        console.log("🚀 Supabase conectado e validado com sucesso!");
    }
}
testarBanco();


// ============================================================================
// 2. OPERAÇÕES DE FLUXO: CADASTRO OU EDIÇÃO DE ALUNOS (HÍBRIDO)
// ============================================================================

/**
 * Controla o envio do formulário da aba Matrícula. Decide dinamicamente
 * se vai realizar um novo INSERT ou atualizar um registro via UPDATE,
 * baseando-se na presença do campo oculto `aluno_id_edicao`.
 *
 * FLUXO:
 *   1. Lê o ID oculto de controle.
 *   2. Se houver foto, faz upload no Storage "avatars" e captura a URL pública.
 *   3. Monta o objeto `dadosAluno` com todos os campos do formulário.
 *   4. Executa INSERT (novo aluno) ou UPDATE (edição) conforme o ID.
 *   5. Em caso de sucesso, reseta o formulário e volta para a aba de chamada.
 *
 * @param {Event} event - Evento nativo de submit do formulário HTML.
 */
async function cadastrarAluno(event) {
    event.preventDefault(); // Impede o recarregamento padrão da página (evita "?" na URL)

    // Lê o campo oculto injetado pela função prepararEdicao().
    // Se estiver preenchido com um ID, o sistema opera em modo EDIÇÃO.
    // Se estiver vazio, opera em modo CADASTRO (INSERT).
    const idEdicao = document.getElementById('aluno_id_edicao').value;

    // Captura todos os campos textuais do formulário de matrícula
    const nome            = document.getElementById('nome').value;
    const data_nascimento = document.getElementById('data_nascimento').value;
    const cpf             = document.getElementById('cpf').value;
    const faixa_inicial   = document.getElementById('faixa_inicial').value;
    const tamanho_dobok   = document.getElementById('tamanho_dobok').value;
    const tamanho_faixa   = document.getElementById('tamanho_faixa').value;
    const observacoes     = document.getElementById('observacoes').value;

    // Captura o arquivo de imagem (se o usuário anexou uma foto)
    const arquivoFoto = document.getElementById('foto_aluno').files[0];
    let urlFotoPublica = null; // Inicializa vazia — será preenchida só se houver upload

    console.log("Iniciando persistência dos dados do aluno:", nome);

    // --- MODO EDIÇÃO: recupera a URL da foto antiga ---
    // Se estamos editando e o usuário NÃO enviou nova foto, mantém a foto atual do banco.
    if (idEdicao && !arquivoFoto) {
        const { data: alunoAtual } = await supabaseClient
            .from('alunos')
            .select('foto_url')
            .eq('id', idEdicao)
            .single(); // Espera exatamente 1 linha (busca por PK)

        if (alunoAtual) urlFotoPublica = alunoAtual.foto_url;
    }

    // --- ARMAZENAMENTO (STORAGE): upload da imagem para o bucket "avatars" ---
    // Só executa se o usuário selecionou um arquivo de imagem no formulário.
    if (arquivoFoto) {
        const extensao = arquivoFoto.name.split('.').pop();

        // Gera um nome de arquivo único usando timestamp + nome do aluno sem espaços,
        // evitando colisão de nomes no bucket de armazenamento.
        const nomeArquivoUnico = `${Date.now()}_${nome.replace(/\s+/g, '_').toLowerCase()}.${extensao}`;

        console.log("Enviando foto para o Storage Bucket 'avatars':", nomeArquivoUnico);

        const { error: uploadError } = await supabaseClient.storage
            .from('avatars')
            .upload(nomeArquivoUnico, arquivoFoto, {
                cacheControl: '3600', // Cache de 1h para otimizar requisições repetidas
                upsert: true          // Substitui se já existir (prevenção de duplicata)
            });

        if (uploadError) {
            // Avisa o usuário mas NÃO aborta o cadastro — o aluno é salvo sem foto
            console.error("❌ Falha ao subir imagem para o Storage:", uploadError.message);
            alert("Aviso: Não foi possível carregar a nova foto. Detalhes: " + uploadError.message);
        } else {
            // Upload bem-sucedido: captura a URL pública permanente da imagem
            const { data: publicUrlData } = supabaseClient.storage
                .from('avatars')
                .getPublicUrl(nomeArquivoUnico);

            urlFotoPublica = publicUrlData.publicUrl;
            console.log("🔥 URL pública gerada com sucesso:", urlFotoPublica);
        }
    }

    // --- MONTAGEM DO PAYLOAD ---
    // Objeto estruturado com os campos da tabela 'alunos' no Supabase.
    // Campos numéricos usam parseInt() e fallback null para evitar strings vazias no banco.
    const dadosAluno = {
        nome:                    nome,
        data_nascimento:         data_nascimento,
        cpf:                     cpf ? cpf : null,          // null se CPF não informado
        faixa_inicial_cadastro:  faixa_inicial,             // Graduação no momento da matrícula
        tamanho_dobok:           tamanho_dobok ? parseInt(tamanho_dobok) : null,
        tamanho_faixa:           tamanho_faixa ? parseInt(tamanho_faixa) : null,
        observacoes:             observacoes,
        foto_url:                urlFotoPublica              // URL do Storage ou null
    };

    let resposta;

    // --- EXECUÇÃO NO SUPABASE ---
    // Decide entre INSERT (novo) e UPDATE (edição) com base no ID de controle.
    if (idEdicao) {
        console.log("Executando UPDATE para o ID:", idEdicao);
        resposta = await supabaseClient.from('alunos').update(dadosAluno).eq('id', idEdicao);
    } else {
        console.log("Executando INSERT para novo registro");
        resposta = await supabaseClient.from('alunos').insert([dadosAluno]);
    }

    if (resposta.error) {
        console.error("❌ Erro nas operações de banco de dados:", resposta.error.message);
        alert("Erro ao salvar os dados no Supabase: " + resposta.error.message);
    } else {
        alert(idEdicao ? "Cadastro atualizado com sucesso!" : "Aluno cadastrado com sucesso!");

        // Reseta o formulário e limpa o campo oculto de controle de estado
        document.getElementById('formAluno').reset();
        document.getElementById('aluno_id_edicao').value = "";

        // Restaura o texto original do botão de envio
        document.querySelector('.btn-submit').innerText = "Gravar Aluno";

        // Volta a exibir a aba de Chamada Diária automaticamente
        if (typeof alternarAba === "function") {
            alternarAba('aba-chamada', document.querySelectorAll('.aba-botao')[0]);
        }

        // Recarrega a tabela de chamada para refletir o aluno recém-cadastrado
        carregarListaChamada();
    }
}


// ============================================================================
// 3. AUXILIAR DE INTERFACE: CARGA E PREPARO DOS DADOS DE EDIÇÃO
// ============================================================================

/**
 * Preenche o formulário de matrícula com os dados atuais de um aluno
 * para que o usuário possa editar. Os dados chegam diretamente do atributo
 * `onclick` da linha da tabela de chamada (strings dinâmicas do HTML).
 *
 * ATENÇÃO: O campo oculto `aluno_id_edicao` é a chave que sinaliza
 * para cadastrarAluno() que estamos em modo EDIÇÃO (UPDATE) e não INSERT.
 *
 * @param {string} id         - UUID do aluno (chave primária da tabela)
 * @param {string} nome       - Nome completo
 * @param {string} nascimento - Data no formato YYYY-MM-DD
 * @param {string} cpf        - CPF ou "null" como string
 * @param {string} dobok      - Tamanho do dobok em cm ou "null"
 * @param {string} faixa      - Tamanho da faixa em cm ou "null"
 * @param {string} obs        - Observações / histórico médico
 */
function prepararEdicao(id, nome, nascimento, cpf, dobok, faixa, obs) {
    // Injeta o ID no campo oculto — isso ativa o modo EDIÇÃO em cadastrarAluno()
    document.getElementById('aluno_id_edicao').value = id;
    document.getElementById('nome').value            = nome;
    document.getElementById('data_nascimento').value = nascimento;

    // Filtros para não exibir a string literal "null" nos inputs visuais
    document.getElementById('cpf').value           = (cpf   === "null" || !cpf)   ? "" : cpf;
    document.getElementById('tamanho_dobok').value = (dobok === "null" || !dobok) ? "" : dobok;
    document.getElementById('tamanho_faixa').value = (faixa === "null" || !faixa) ? "" : faixa;
    document.getElementById('observacoes').value   = (obs   === "null" || !obs)   ? "" : obs;

    // Altera o label do botão para indicar que estamos no modo de alteração
    document.querySelector('.btn-submit').innerText = "Salvar Alterações";

    // Navega visualmente para a aba de Matrícula (índice 1)
    if (typeof alternarAba === "function") {
        alternarAba('aba-cadastro', document.querySelectorAll('.aba-botao')[1]);
    }
}


// ============================================================================
// 4. REGRAS DE NEGÓCIO: METAS DE HORAS PARA EXAME DE GRADUAÇÃO
// ============================================================================

/**
 * Calcula a carga horária mínima de treinos que um aluno precisa acumular
 * para ser considerado APTO a realizar o exame de graduação.
 *
 * REGRA PEDAGÓGICA:
 *  - Ponta Preta (pré-faixa preta): sempre 104h independente de idade.
 *  - Crianças (4–10 anos): metas menores nas faixas iniciais (78h) e intermediárias (104h).
 *  - Adultos/Jovens (>10 anos): metas progressivas (52h → 52h → 78h).
 *
 * @param {number} idade  - Idade calculada em anos completos
 * @param {string} faixa  - Graduação atual (ex: 'Branca', 'Verde', 'Ponta Preta')
 * @returns {number}      - Meta em horas (ex: 52, 78 ou 104)
 */
function calcularMetaHoras(idade, faixa) {
    // Caso especial: pré-faixa preta exige o dobro de horas para todos
    if (faixa === 'Ponta Preta') return 104;

    if (idade >= 4 && idade <= 10) {
        // Crianças nas faixas iniciais têm meta reduzida
        if (['Branca', 'Ponta Amarela', 'Amarela', 'Ponta Verde'].includes(faixa)) return 78;
        return 104; // Crianças em faixas intermediárias/avançadas: meta padrão
    } else {
        // Adultos e jovens: faixas iniciais e intermediárias com meta menor
        if (['Branca', 'Ponta Amarela', 'Amarela', 'Ponta Verde'].includes(faixa)) return 52;
        if (['Verde', 'Ponta Azul'].includes(faixa)) return 52;
        return 78; // Faixas avançadas (Azul, Ponta Vermelha, Vermelha)
    }
}


// ============================================================================
// 5. OPERAÇÕES DE FLUXO: CONTROLE DA LISTA DE CHAMADA DIÁRIA
// ============================================================================

/**
 * Carrega e renderiza a tabela de chamada do painel com todos os alunos ativos.
 * Para cada aluno exibe: foto, nome, idade, graduação atual, horas acumuladas,
 * selo de aptidão para o exame, botão de edição e botão de presença.
 *
 * QUERIES EXECUTADAS:
 *  1. Tabela 'alunos' + JOIN com 'progresso_tecnico' (faixa_atual + horas acumuladas)
 *  2. Tabela 'registro_presencas' filtrada pela data selecionada
 *
 * A data padrão é o dia de hoje (new Date()). O campo de data no HTML
 * permite alterar manualmente para consultar chamadas de outros dias.
 */
async function carregarListaChamada() {
    // Pega o campo de data no HTML e define hoje como valor padrão
    const campoData = document.getElementById('data_chamada');
    if (campoData && !campoData.value) {
        campoData.value = new Date().toISOString().split('T')[0]; // Formato: YYYY-MM-DD
    }
    const dataSelecionada = campoData.value;

    // --- QUERY 1: Busca todos os alunos com status "ativo" ---
    // O JOIN com 'progresso_tecnico' traz faixa_atual e horas_acumuladas
    // de uma tabela separada (relação 1:N — um aluno, muitos registros de progresso).
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
        .eq('status', 'ativo')               // Ignora alunos inativos/cancelados
        .order('nome', { ascending: true });  // Ordem alfabética para facilitar chamada

    // --- QUERY 2: Busca quais alunos já têm presença registrada hoje ---
    // Usado para alternar o botão entre "Registrar" e "Registrada" (lock)
    const { data: presencasDoDia, error: erroPresencas } = await supabaseClient
        .from('registro_presencas')
        .select('aluno_id')
        .eq('data_aula', dataSelecionada);

    if (erroAlunos || erroPresencas) {
        console.error("❌ Erro ao buscar dados estruturados:", erroAlunos?.message || erroPresencas?.message);
        return;
    }

    // Cria um array plano de IDs para facilitar o includes() no loop abaixo
    const IDsComPresenca = presencasDoDia.map(p => p.aluno_id);

    const tabela = document.getElementById('tabelaChamada');
    if (!tabela) return; // Sai silenciosamente se a tabela não existir na página atual
    tabela.innerHTML = ''; // Limpa o conteúdo anterior antes de re-renderizar

    listaAlunos.forEach(aluno => {
        // --- CÁLCULO DE IDADE ---
        // Usa apenas o ano para evitar problemas com fuso horário em new Date(string)
        let idadeTexto = "N/A";
        let idadeNumero = 0;

        if (aluno.data_nascimento) {
            const anoNascimento = new Date(aluno.data_nascimento).getFullYear();
            const anoAtual      = new Date().getFullYear();
            idadeNumero = anoAtual - anoNascimento;
            // Sanidade: evita exibir idades absurdas (menores de 0 ou maiores de 120)
            if (!isNaN(idadeNumero) && idadeNumero > 0 && idadeNumero < 120) {
                idadeTexto = `${idadeNumero} anos`;
            }
        }

        // --- EXTRAÇÃO DO PROGRESSO TÉCNICO (JOIN) ---
        // progresso_tecnico é um array (relação 1:N). Usa [0] para pegar o registro mais recente.
        // Se não houver registro, assume Branca com 0 horas como estado inicial.
        const progresso = aluno.progresso_tecnico && aluno.progresso_tecnico[0]
            ? aluno.progresso_tecnico[0]
            : { faixa_atual: 'Branca', horas_acumuladas: 0 };

        const jaTemPresenca = IDsComPresenca.includes(aluno.id);
        const metaHoras     = calcularMetaHoras(idadeNumero, progresso.faixa_atual);
        const horasTreinadas = progresso.horas_acumuladas;

        // --- LÓGICA DE APTIDÃO PARA EXAME ---
        // Aluno com horas >= meta recebe cor verde e o selo "🔥 Apto"
        // Aluno sem horas suficientes recebe cor vermelha e a quantidade restante
        let estiloHoras = `font-weight: bold; color: #ff1a1a;`;
        let seloApto    = '';

        if (horasTreinadas >= metaHoras) {
            estiloHoras = `font-weight: bold; color: #30d158; background: #1c421c; padding: 2px 6px; border-radius: 4px; border: 1px solid #30d158;`;
            seloApto    = `<span style="font-size: 11px; color: #30d158; display: block; margin-top: 4px;">🔥 Apto</span>`;
        } else {
            seloApto = `<span style="font-size: 11px; color: #636366; display: block; margin-top: 4px;">Faltam ${metaHoras - horasTreinadas}h</span>`;
        }

        // --- RENDERIZAÇÃO DO AVATAR ---
        // Exibe a foto do Storage se disponível, ou um ícone placeholder
        let htmlAvatar = '';
        if (aluno.foto_url) {
            htmlAvatar = `<img src="${aluno.foto_url}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1px solid #333;" alt="Foto">`;
        } else {
            htmlAvatar = `<div style="width: 36px; height: 36px; border-radius: 50%; background: #222; display: flex; align-items: center; justify-content: center; border: 1px solid #333; color: #636366; font-size: 16px;">👤</div>`;
        }

        // --- BOTÃO DE PRESENÇA ---
        // Se o aluno já tem presença hoje: exibe lacre (botão desabilitado visualmente)
        // Se não tem: exibe botão funcional que chama registrarPresenca()
        let botaodeAcao = '';
        if (jaTemPresenca) {
            botaodeAcao = `<span style="padding: 6px 12px; font-size: 12px; background: #1c1c1e; color: #8e8e93; border: 1px solid #2c2c2e; border-radius: 4px; display: inline-block;">🔒 Registrada</span>`;
        } else {
            botaodeAcao = `<button onclick="registrarPresenca('${aluno.id}')" style="padding: 6px 12px; font-size: 12px; background: #2c421c; color: #30d158; border: 1px solid #1c421c; border-radius: 4px; cursor: pointer; font-weight: bold;">✔ Presença</button>`;
        }

        // --- ESCAPE DE STRINGS PARA INLINE onclick ---
        // Aspas simples no nome ou observações quebrariam o atributo onclick do HTML.
        // O replace aqui converte as aspas em aspas escapadas (\')
        const nomeEscapado = aluno.nome.replace(/'/g, "\\'");
        const obsEscapada  = aluno.observacoes
            ? aluno.observacoes.replace(/'/g, "\\'").replace(/\n/g, " ")
            : "";

        // --- MONTAGEM DA LINHA DA TABELA ---
        const linha = document.createElement('tr');
        linha.style.borderBottom = "1px solid #262626";

        linha.innerHTML = `
            <td style="padding: 12px 8px;">${htmlAvatar}</td>
            <td style="padding: 12px 8px; font-weight: 600;">${aluno.nome}</td>
            <td style="padding: 12px 8px; color: #a0a0a0;">${idadeTexto}</td>
            <td style="padding: 12px 8px;"><span style="background: #222; padding: 4px 8px; border-radius: 4px; border: 1px solid #333;">🥋 ${progresso.faixa_atual}</span></td>
            <td style="padding: 12px 8px;"><span style="${estiloHoras}">${horasTreinadas}h</span>${seloApto}</td>
            <td style="padding: 12px 8px; text-align: center;">
                <button onclick="prepararEdicao('${aluno.id}', '${nomeEscapado}', '${aluno.data_nascimento}', '${aluno.cpf}', '${aluno.tamanho_dobok}', '${aluno.tamanho_faixa}', '${obsEscapada}')" style="background: none; border: none; cursor: pointer; font-size: 16px;" title="Editar Cadastro">✏️</button>
            </td>
            <td style="padding: 12px 8px; text-align: right;">${botaodeAcao}</td>
        `;
        tabela.appendChild(linha);
    });
}


// ============================================================================
// 6. OPERAÇÕES DE FLUXO: GRAVAÇÃO DE PRESENÇAS E CONTROLE DE DUPLICIDADE
// ============================================================================

/**
 * Registra a presença de um aluno na data selecionada no painel.
 * Antes de inserir, verifica se já existe registro para evitar duplicidade.
 *
 * REGRA: cada aluno pode ter no máximo 1 presença por data_aula.
 * A verificação é feita em duas colunas: aluno_id + data_aula.
 *
 * NOTA: horas_aula está fixo em 1 (1 treino = 1 hora). Pode ser parametrizado
 * futuramente se o dojang adotar aulas de durações variadas.
 *
 * @param {string} alunoId - UUID do aluno (vem do onclick da linha da tabela)
 */
async function registrarPresenca(alunoId) {
    const dataAula = document.getElementById('data_chamada').value;
    if (!dataAula) {
        alert("Por favor, selecione uma data.");
        return;
    }

    // --- VERIFICAÇÃO DE DUPLICIDADE ---
    // Consulta se já existe um registro com a combinação aluno_id + data_aula
    const { data: presencaExistente } = await supabaseClient
        .from('registro_presencas')
        .select('id')
        .eq('aluno_id', alunoId)
        .eq('data_aula', dataAula);

    if (presencaExistente && presencaExistente.length > 0) {
        alert("⚠️ Este aluno já tem presença hoje!");
        return; // Aborta sem fazer INSERT duplicado
    }

    // --- INSERÇÃO DA PRESENÇA ---
    // horas_aula: 1 = 1 hora de treino (unidade padrão do dojang)
    const { error } = await supabaseClient
        .from('registro_presencas')
        .insert([{ aluno_id: alunoId, data_aula: dataAula, horas_aula: 1 }]);

    if (error) {
        alert("Erro: " + error.message);
    } else {
        // Recarrega a tabela inteira para refletir o estado atualizado
        // (botão muda de "✔ Presença" para "🔒 Registrada")
        carregarListaChamada();
    }
}


// ============================================================================
// 7. MAPEAMENTO E CONFIGURAÇÃO DOS ESCUTADORES DE EVENTOS DO SISTEMA (DOM)
// ============================================================================

/**
 * Inicialização principal acionada quando o DOM estiver completamente carregado.
 * Usa uma trava de segurança para verificar se a tabela de chamada existe na
 * página atual antes de registrar os listeners — isso permite que este mesmo
 * arquivo seja carregado em páginas sem a tela de painel (ex: index.html)
 * sem causar erros de elementos não encontrados.
 */
document.addEventListener('DOMContentLoaded', () => {
    const tabelaExistente = document.getElementById('tabelaChamada');

    if (tabelaExistente) {
        // --- TELA DO PAINEL (painel.html) ---
        console.log("📅 Tela de Painel detectada. Inicializando motores da chamada...");

        // Carga inicial da lista assim que o DOM estiver pronto
        carregarListaChamada();

        // Listener do formulário de cadastro/edição
        const form = document.getElementById('formAluno');
        if (form) {
            form.addEventListener('submit', cadastrarAluno);
            // Após o submit, aguarda 1s e recarrega a lista para refletir o novo aluno
            form.addEventListener('submit', () => {
                setTimeout(carregarListaChamada, 1000);
            });
        }

        // Listener do campo de data: recarrega a chamada sempre que o dia mudar
        const campoData = document.getElementById('data_chamada');
        if (campoData) {
            campoData.addEventListener('change', carregarListaChamada);
        }
    } else {
        // --- OUTRAS TELAS (index.html, etc.) ---
        // O arquivo foi carregado mas a tela de painel não está presente.
        // Nenhuma ação necessária — apenas log informativo.
        console.log("🏠 Tela institucional detectada. Motores do painel em espera.");
    }
});