// ============================================================================
// 1. CONFIGURAÇÃO, CREDENCIAIS E INICIALIZAÇÃO DO CLIENTE SUPABASE
// ============================================================================

const urlBanco = 'https://pkbusphlutnodgconbbc.supabase.co';
const chaveBanco = 'sb_publishable_AXK9wUTEpz-rSdmXYn2SUA_u8O_u6P0';

// Criação da instância global de conexão com a API do Supabase
const supabaseClient = supabase.createClient(urlBanco, chaveBanco);

/**
 * Valida a integridade da comunicação com as tabelas do banco de dados na inicialização.
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
 * se vai realizar um novo INSERT ou atualizar um registro via UPDATE.
 * @param {Event} event - Evento nativo de submit do formulário
 */
async function cadastrarAluno(event) {
    event.preventDefault();

    // Captura o ID oculto de controle. Se estiver preenchido, o sistema opera em modo EDIÇÃO.
    const idEdicao = document.getElementById('aluno_id_edicao').value;

    // Captura os dados textuais e cadastrais digitados pelo usuário
    const nome = document.getElementById('nome').value;
    const data_nascimento = document.getElementById('data_nascimento').value;
    const cpf = document.getElementById('cpf').value;
    const faixa_inicial = document.getElementById('faixa_inicial').value;
    const tamanho_dobok = document.getElementById('tamanho_dobok').value;
    const tamanho_faixa = document.getElementById('tamanho_faixa').value;
    const observacoes = document.getElementById('observacoes').value;
    
    // Captura o arquivo de imagem anexado pelo usuário
    const arquivoFoto = document.getElementById('foto_aluno').files[0];
    let urlFotoPublica = null;

    console.log("Iniciando persistência dos dados do aluno:", nome);

    // MODO EDIÇÃO: Recupera a URL da foto antiga caso o usuário não envie um arquivo novo
    if (idEdicao && !arquivoFoto) {
        const { data: alunoAtual } = await supabaseClient
            .from('alunos')
            .select('foto_url')
            .eq('id', idEdicao)
            .single();
            
        if (alunoAtual) urlFotoPublica = alunoAtual.foto_url;
    }

    // ARMAZENAMENTO (STORAGE): Processa o upload da imagem se houver um novo arquivo anexado
    if (arquivoFoto) {
        const extensao = arquivoFoto.name.split('.').pop();
        // Constrói um nome limpo e exclusivo para o arquivo usando timestamp e o nome do aluno
        const nomeArquivoUnico = `${Date.now()}_${nome.replace(/\s+/g, '_').toLowerCase()}.${extensao}`;
        
        console.log("Enviando foto para o Storage Bucket 'avatars':", nomeArquivoUnico);

        const { error: uploadError } = await supabaseClient.storage
            .from('avatars')
            .upload(nomeArquivoUnico, arquivoFoto, {
                cacheControl: '3600',
                upsert: true
            });

        if (uploadError) {
            console.error("❌ Falha ao subir imagem para o Storage:", uploadError.message);
            alert("Aviso: Não foi possível carregar a nova foto. Detalhes: " + uploadError.message);
        } else {
            // Se o upload foi bem-sucedido, captura e armazena a URL pública da imagem
            const { data: publicUrlData } = supabaseClient.storage
                .from('avatars')
                .getPublicUrl(nomeArquivoUnico);
                
            urlFotoPublica = publicUrlData.publicUrl;
            console.log("🔥 URL pública gerada com sucesso:", urlFotoPublica);
        }
    }

    // Montagem do payload estruturado para a tabela 'alunos'
    const dadosAluno = {
        nome: nome,
        data_nascimento: data_nascimento,
        cpf: cpf ? cpf : null,
        faixa_inicial_cadastro: faixa_inicial,
        tamanho_dobok: tamanho_dobok ? parseInt(tamanho_dobok) : null,
        tamanho_faixa: tamanho_faixa ? parseInt(tamanho_faixa) : null,
        observacoes: observacoes,
        foto_url: urlFotoPublica
    };

    let resposta;
    
    // EXECUÇÃO NO SUPABASE: Seleciona o comando correto com base no ID de controle
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
        
        // Reseta o formulário por completo e limpa o ID oculto de controle de estado
        document.getElementById('formAluno').reset();
        document.getElementById('aluno_id_edicao').value = "";
        
        // Restaura o texto original do botão de confirmação
        document.querySelector('.btn-submit').innerText = "Gravar Aluno";
        
        // Redireciona o usuário visualmente de volta para a aba de Chamada Diária
        if (typeof alternarAba === "function") {
            alternarAba('aba-chamada', document.querySelectorAll('.aba-botao')[0]);
        }
        
        // Recarrega a tabela de frequência para refletir as alterações instantaneamente
        carregarListaChamada();
    }
}


// ============================================================================
// 3. AUXILIAR DE INTERFACE: CARGA E PREPARO DOS DADOS DE EDIÇÃO
// ============================================================================

/**
 * Captura as variáveis de linha da tabela, injeta os dados nos respectivos inputs
 * do formulário na aba de Matrícula e altera o comportamento visual do botão principal.
 */
function prepararEdicao(id, nome, nascimento, cpf, dobok, faixa, obs) {
    // Alimenta os elementos do formulário de matrícula com os valores antigos do aluno
    document.getElementById('aluno_id_edicao').value = id;
    document.getElementById('nome').value = nome;
    document.getElementById('data_nascimento').value = nascimento;
    
    // Filtros para evitar strings vazias ou "null" nos inputs textuais
    document.getElementById('cpf').value = (cpf === "null" || !cpf) ? "" : cpf;
    document.getElementById('tamanho_dobok').value = (dobok === "null" || !dobok) ? "" : dobok;
    document.getElementById('tamanho_faixa').value = (faixa === "null" || !faixa) ? "" : faixa;
    document.getElementById('observacoes').value = (obs === "null" || !obs) ? "" : obs;

    // Altera o texto do botão para indicar a modificação
    document.querySelector('.btn-submit').innerText = "Salvar Alterações";

    // Joga o foco visual para a aba de Matrícula
    if (typeof alternarAba === "function") {
        alternarAba('aba-cadastro', document.querySelectorAll('.aba-botao')[1]);
    }
}


// ============================================================================
// 4. REGRAS DE NEGÓCIO: METAS DE HORAS
// ============================================================================

/**
 * Calcula a carga horária mínima necessária baseada no cruzamento de idade e gub atual.
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
// 5. OPERAÇÕES DE FLUXO: CONTROLE DA LISTA DE CHAMADA DIÁRIA
// ============================================================================

async function carregarListaChamada() {
    const campoData = document.getElementById('data_chamada');
    if (campoData && !campoData.value) {
        campoData.value = new Date().toISOString().split('T')[0];
    }
    const dataSelecionada = campoData.value;

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

    const { data: presencasDoDia, error: erroPresencas } = await supabaseClient
        .from('registro_presencas')
        .select('aluno_id')
        .eq('data_aula', dataSelecionada);

    if (erroAlunos || erroPresencas) {
        console.error("❌ Erro ao buscar dados estruturados:", erroAlunos?.message || erroPresencas?.message);
        return;
    }

    const IDsComPresenca = presencasDoDia.map(p => p.aluno_id);
    const tabela = document.getElementById('tabelaChamada');
    if (!tabela) return;
    tabela.innerHTML = '';

    listaAlunos.forEach(aluno => {
        let idadeTexto = "N/A";
        let idadeNumero = 0;

        if (aluno.data_nascimento) {
            const anoNascimento = new Date(aluno.data_nascimento).getFullYear();
            const anoAtual = new Date().getFullYear();
            idadeNumero = anoAtual - anoNascimento;
            if (!isNaN(idadeNumero) && idadeNumero > 0 && idadeNumero < 120) {
                idadeTexto = `${idadeNumero} anos`;
            }
        }

        const progresso = aluno.progresso_tecnico && aluno.progresso_tecnico[0]
            ? aluno.progresso_tecnico[0]
            : { faixa_atual: 'Branca', horas_acumuladas: 0 };

        const jaTemPresenca = IDsComPresenca.includes(aluno.id);
        const metaHoras = calcularMetaHoras(idadeNumero, progresso.faixa_atual);
        const horasTreinadas = progresso.horas_acumuladas;

        let estiloHoras = `font-weight: bold; color: #ff1a1a;`;
        let seloApto = '';

        if (horasTreinadas >= metaHoras) {
            estiloHoras = `font-weight: bold; color: #30d158; background: #1c421c; padding: 2px 6px; border-radius: 4px; border: 1px solid #30d158;`;
            seloApto = `<span style="font-size: 11px; color: #30d158; display: block; margin-top: 4px;">🔥 Apto</span>`;
        } else {
            seloApto = `<span style="font-size: 11px; color: #636366; display: block; margin-top: 4px;">Faltam ${metaHoras - horasTreinadas}h</span>`;
        }

        let htmlAvatar = '';
        if (aluno.foto_url) {
            htmlAvatar = `<img src="${aluno.foto_url}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1px solid #333;" alt="Foto">`;
        } else {
            htmlAvatar = `<div style="width: 36px; height: 36px; border-radius: 50%; background: #222; display: flex; align-items: center; justify-content: center; border: 1px solid #333; color: #636366; font-size: 16px;">👤</div>`;
        }

        let botaodeAcao = '';
        if (jaTemPresenca) {
            botaodeAcao = `<span style="padding: 6px 12px; font-size: 12px; background: #1c1c1e; color: #8e8e93; border: 1px solid #2c2c2e; border-radius: 4px; display: inline-block;">🔒 Registrada</span>`;
        } else {
            botaodeAcao = `<button onclick="registrarPresenca('${aluno.id}')" style="padding: 6px 12px; font-size: 12px; background: #2c421c; color: #30d158; border: 1px solid #1c421c; border-radius: 4px; cursor: pointer; font-weight: bold;">✔ Presença</button>`;
        }

        // Escapa aspas para strings dinâmicas não quebrarem o HTML do inline onclick
        const nomeEscapado = aluno.nome.replace(/'/g, "\\'");
        const obsEscapada = aluno.observacoes ? aluno.observacoes.replace(/'/g, "\\'").replace(/\n/g, " ") : "";

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

async function registrarPresenca(alunoId) {
    const dataAula = document.getElementById('data_chamada').value;
    if (!dataAula) {
        alert("Por favor, selecione uma data.");
        return;
    }

    const { data: presencaExistente } = await supabaseClient
        .from('registro_presencas')
        .select('id')
        .eq('aluno_id', alunoId)
        .eq('data_aula', dataAula);

    if (presencaExistente && presencaExistente.length > 0) {
        alert("⚠️ Este aluno já tem presença hoje!");
        return;
    }

    const { error } = await supabaseClient
        .from('registro_presencas')
        .insert([{ aluno_id: alunoId, data_aula: dataAula, horas_aula: 1 }]);

    if (error) {
        alert("Erro: " + error.message);
    } else {
        carregarListaChamada();
    }
}


// ============================================================================
// 7. MAPEAMENTO E CONFIGURAÇÃO DOS ESCUTADORES DE EVENTOS DO SISTEMA (DOM)
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // TRAVA DE SEGURANÇA: Só tenta carregar a chamada se a tabela existir na página atual
    const tabelaExistente = document.getElementById('tabelaChamada');
    
    if (tabelaExistente) {
        console.log("📅 Tela de Painel detectada. Inicializando motores da chamada...");
        carregarListaChamada();

        const form = document.getElementById('formAluno');
        if (form) {
            form.addEventListener('submit', cadastrarAluno);
            form.addEventListener('submit', () => { 
                setTimeout(carregarListaChamada, 1000); 
            });
        }

        const campoData = document.getElementById('data_chamada');
        if (campoData) {
            campoData.addEventListener('change', carregarListaChamada);
        }
    } else {
        console.log("🏠 Tela institucional detectada. Motores do painel em espera.");
    }
});