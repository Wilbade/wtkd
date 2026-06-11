
    // ============================================================
    // 1. GUARDA DE ROTA — bloqueia acesso não autenticado
    //    verificarSessao() lança exceção + redireciona se inválido.
    //    O código abaixo SÓ executa se a sessão for válida.
    // ============================================================
    const sessao = verificarSessao();
    const { conta: contaBanca, nome: nomeAvaliador, graduacao: graduacaoAvaliador } = sessao;

    // Exibe o nome e graduação no badge do header
    document.getElementById('info-banca-topo').textContent =
        `${nomeAvaliador} (${graduacaoAvaliador})`;

    // ============================================================
    // 2. CLIENTE SUPABASE LOCAL
    // ============================================================
    const SUPABASE_URL = "https://pkbusphlutnodgconbbc.supabase.co";
    const SUPABASE_KEY = "sb_publishable_AXK9wUTEpz-rSdmXYn2SUA_u8O_u6P0";
    const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // ============================================================
    // 3. EMENTA TÉCNICA POR GRADUAÇÃO (REGRAS_EXAME)
    //
    // Chaves em minúsculas — mapeadas com .trim().toLowerCase()
    // para tolerar espaços e capitalização variável do banco.
    // ============================================================
    const REGRAS_EXAME = {
        "branca": [
            { cat: "Kibon Donjak", nome: "Juntchumso Jumok", max: 5 },
            { cat: "Kibon Donjak", nome: "Kibon Poom-se", max: 5 },
            { cat: "Poom-se/Tull", nome: "Saju Dirugui", max: 10 },
            { cat: "Poom-se/Tull", nome: "Tchon-Ji Hian", max: 10 },
            { cat: "Tchagui", nome: "Ap-tcha Oligui", max: 10 },
            { cat: "Tchagui", nome: "Ap-tchagui", max: 10 },
            { cat: "Tchagui", nome: "Bacat-Tchagui", max: 10 },
            { cat: "Tchagui", nome: "Antchagui", max: 10 },
            { cat: "Tchagui", nome: "Ap-Dolio-Tchagui", max: 10 },
            { cat: "Jaiu Kyorugui", nome: "Combate Livre", max: 10 },
            { cat: "Coordenação", nome: "Coordenação motora", max: 10 }
        ],
        "amarela": [
            { cat: "Kibon Donjak", nome: "Kibon Donjak II", max: 5 },
            { cat: "Kibon Donjak", nome: "Kibon Poom-se", max: 5 },
            { cat: "Poom-se/Tull", nome: "Dangum Hian", max: 10 },
            { cat: "Poom-se/Tull", nome: "Teguk Il Jang", max: 10 },
            { cat: "Combate", nome: "Matcho Kyorugui", max: 10 },
            { cat: "Tchagui", nome: "Ap-miro tchagui", max: 10 },
            { cat: "Tchagui", nome: "Tigô-tchagui", max: 10 },
            { cat: "Tchagui", nome: "Yop-Tchagui", max: 10 },
            { cat: "Tchagui", nome: "Tuit-tchagui", max: 10 },
            { cat: "Tchagui", nome: "Dolio-Tchagui", max: 10 },
            { cat: "Jaiu Kyorugui", nome: "Combate Livre", max: 5 },
            { cat: "Iron", nome: "Teoria (Iron)", max: 5 }
        ],
        "amarela p. verde": [
            { cat: "Kibon Donjak", nome: "Kibon Donjak Il e I", max: 5 },
            { cat: "Kibon Donjak", nome: "Kibon Poom-se", max: 5 },
            { cat: "Poom-se/Tull", nome: "Dosan Hian", max: 10 },
            { cat: "Poom-se/Tull", nome: "Teguk I Jang", max: 10 },
            { cat: "Combate", nome: "Matcho Kyorugui", max: 5 },
            { cat: "Tchagui", nome: "Timio ap bal ap Dolio Tchagui", max: 10 },
            { cat: "Tchagui", nome: "Tuit bal- Rurio-tchagui", max: 10 },
            { cat: "Tchagui", nome: "Ap bal- Rurio-Tchagui", max: 10 },
            { cat: "Tchagui", nome: "Mondolio - Rurio -tchagui", max: 10 },
            { cat: "Tchagui", nome: "Timio Tui Tchagui", max: 10 },
            { cat: "Jaiu Kyorugui", nome: "Combate Livre", max: 10 },
            { cat: "Iron", nome: "Teoria (Iron)", max: 5 }
        ],
        "verde": [
            { cat: "Kibon Donjak", nome: "Kibon Donjak IL, I e Sam", max: 5 },
            { cat: "Kibon Donjak", nome: "Kibon Poom-se", max: 5 },
            { cat: "Poom-se/Tull", nome: "Won Yo Hian", max: 15 },
            { cat: "Poom-se/Tull", nome: "Teguk Sam Jang", max: 10 },
            { cat: "Combate", nome: "Matcho Kyorugui", max: 10 },
            { cat: "Tchagui", nome: "Tchagui 1 Jejari (no lugar)", max: 15 },
            { cat: "Tchagui", nome: "Thagui 2 Timio (saltando)", max: 15 },
            { cat: "Combate", nome: "Kyorugui", max: 15 },
            { cat: "Quebramento", nome: "Kyok-Pa Sull (Son-nal)", max: 10 }
        ],
        "faixa verde c/ azul": [
            { cat: "Kibon Donjak", nome: "Kibon Donjak IL, I, Sam, Sa", max: 5 },
            { cat: "Kibon Donjak", nome: "Kibon Poom-se", max: 5 },
            { cat: "Poom-se/Tull", nome: "Iul Gok Hian", max: 15 },
            { cat: "Poom-se/Tull", nome: "Teguk Sa Jang", max: 10 },
            { cat: "Combate", nome: "Matcho Kyorugui", max: 10 },
            { cat: "Tchagui", nome: "Tchagui 1 Jejari (no lugar)", max: 15 },
            { cat: "Tchagui", nome: "Thagui 2 Apuro", max: 15 },
            { cat: "Combate", nome: "Kyorugui", max: 15 },
            { cat: "Quebramento", nome: "Kyok-Pa Sull (Son-nal)", max: 5 },
            { cat: "Quebramento", nome: "Pal Kub (madeira)", max: 5 }
        ],
        "faixa azul": [
            { cat: "Kibon Donjak", nome: "Kibon Poom-se", max: 5 },
            { cat: "Kibon Donjak", nome: "Bal-Ki-sull II", max: 5 },
            { cat: "Poom-se/Tull", nome: "Jun Gun Hian", max: 10 },
            { cat: "Poom-se/Tull", nome: "Teguk O Jang", max: 10 },
            { cat: "Poom-se/Tull", nome: "Sorteio", max: 10 },
            { cat: "Combate", nome: "Matcho Kyorugui", max: 10 },
            { cat: "Tchagui", nome: "Godup", max: 15 },
            { cat: "Tchagui", nome: "Jejari", max: 15 },
            { cat: "Tchagui", nome: "Precisão (técnica livre)", max: 10 },
            { cat: "Quebramento", nome: "Ju-mok (madeira solta)", max: 5 },
            { cat: "Quebramento", nome: "Son-nal-dung (madeira)", max: 5 }
        ],
        "faixa azul p.vermelha": [
            { cat: "Kibon Donjak", nome: "Kibon Poom-se", max: 5 },
            { cat: "Kibon Donjak", nome: "Bal-Ki-Sull Il e I", max: 5 },
            { cat: "Poom-se/Tull", nome: "Toi Gae Hian", max: 10 },
            { cat: "Poom-se/Tull", nome: "Teguk Iuk Jang", max: 10 },
            { cat: "Poom-se/Tull", nome: "Sorteio 1", max: 5 },
            { cat: "Poom-se/Tull", nome: "Sorteio 2", max: 5 },
            { cat: "Combate", nome: "Matcho Kyorugui", max: 5 },
            { cat: "Tchagui", nome: "Jejari", max: 10 },
            { cat: "Tchagui", nome: "Apuro", max: 20 },
            { cat: "Combate Livre", nome: "Jaiu Kyorugui 1X1", max: 10 },
            { cat: "Combate Livre", nome: "Jaiu Kyorugui 1X2", max: 5 },
            { cat: "Quebramento", nome: "Timio Yop Tchagui (3 pessoas)", max: 5 },
            { cat: "Técnica Livre", nome: "Técnica livre", max: 5 }
        ],
        "faixa vermelha": [
            { cat: "Kibon Donjak", nome: "Kibon Poom-se", max: 5 },
            { cat: "Kibon Donjak", nome: "Bal-Ki-Sull Il , I e San", max: 5 },
            { cat: "Poom-se/Tull", nome: "Hwa Rang Hian", max: 5 },
            { cat: "Poom-se/Tull", nome: "Teguk Tchil Jang", max: 5 },
            { cat: "Poom-se/Tull", nome: "Sorteio 1", max: 5 },
            { cat: "Poom-se/Tull", nome: "Sorteio 2", max: 5 },
            { cat: "Defesa Pessoal", nome: "Ho-Shin-Sull", max: 5 },
            { cat: "Tchagui", nome: "Jejari", max: 15 },
            { cat: "Tchagui", nome: "Taguet Tchagui", max: 15 },
            { cat: "Combate Livre", nome: "Jaiu Kyorugui 1X1", max: 10 },
            { cat: "Combate Livre", nome: "Jaiu Kyorugui 1X2", max: 5 },
            { cat: "Combate Livre", nome: "Jaiu Kyorugui 1X3", max: 5 },
            { cat: "Quebramento", nome: "Timio Yop Tchagui (3 pessoas)", max: 5 },
            { cat: "Técnica Livre", nome: "Técnica livre", max: 5 },
            { cat: "Quebramento", nome: "son nal, son nal dung (madeira)", max: 5 }
        ],
        "candidato": [
            { cat: "Kibon Donjak", nome: "Kibon Donjak Il, I, San e Sa", max: 5 },
            { cat: "Kibon Donjak", nome: "Kibom Poonsee", max: 10 },
            { cat: "Poom-se/Tull", nome: "Chung Mu Hian", max: 10 },
            { cat: "Poom-se/Tull", nome: "Teguk Pal Jang", max: 10 },
            { cat: "Poom-se/Tull", nome: "Sorteio 1", max: 5 },
            { cat: "Poom-se/Tull", nome: "Sorteio 2", max: 5 },
            { cat: "Poom-se/Tull", nome: "Sorteio 3", max: 5 },
            { cat: "Defesa Pessoal", nome: "Ho-Shin-Sull", max: 5 },
            { cat: "Defesa Pessoal", nome: "Bal - Ki - Sull", max: 5 },
            { cat: "Tchagui", nome: "Sequencia 1, 2 e 3", max: 10 },
            { cat: "Tchagui", nome: "Jejari", max: 5 },
            { cat: "Tchagui", nome: "Taguet Tchagui", max: 5 },
            { cat: "Combate", nome: "1X1", max: 5 },
            { cat: "Combate", nome: "1X2", max: 3 },
            { cat: "Combate", nome: "1X3", max: 3 },
            { cat: "Combate", nome: "1X4", max: 4 },
            { cat: "Quebramento", nome: "Timio Yop Tchagui (5 pessoas)", max: 5 }
        ]
    };

    // ============================================================
    // 4. ESTADO DA SESSÃO DE EXAME
    // cacheAlunos: array normalizado { id, nome, faixa_atual }
    // ============================================================
    let cacheAlunos = [];
    let totalRodadas = 1; // Contador incremental de rodadas extras (rodada 1 é a original)
    const seletores = [
        document.getElementById('aluno-1'),
        document.getElementById('aluno-2'),
        document.getElementById('aluno-3'),
        document.getElementById('aluno-4')
    ];

    // ============================================================
    // 5. carregarAlunosBase()
    //
    // Query com JOIN em progresso_tecnico para obter faixa_atual.
    // A faixa NÃO existe diretamente em 'alunos' — vive na tabela
    // relacionada 'progresso_tecnico' (campo faixa_atual).
    // ============================================================
    async function carregarAlunosBase() {
        const { data, error } = await _supabase
            .from('alunos')
            .select('id, nome, progresso_tecnico (faixa_atual)')
            .eq('status', 'ativo')
            .order('nome', { ascending: true });

        if (error) {
            console.error("Erro ao listar alunos:", error.message);
            seletores[0].innerHTML = '<option value="">Erro ao carregar alunos</option>';
            return;
        }

        // Normaliza: extrai faixa_atual do sub-array do JOIN
        cacheAlunos = data.map(al => ({
            id:          al.id,
            nome:        al.nome,
            faixa_atual: (al.progresso_tecnico && al.progresso_tecnico[0])
                ? al.progresso_tecnico[0].faixa_atual
                : 'Branca' // fallback se não houver registro de progresso
        }));

        // Popula SOMENTE o select do Candidato 1 com todos os alunos ativos.
        // Os selects 2-4 são preenchidos dinamicamente pelo filtro de faixa
        // após a seleção do Candidato 1 (ver evento change do seletor[0] abaixo).
        seletores[0].innerHTML = '<option value="">Selecione o Candidato 1...</option>';
        cacheAlunos.forEach(al => {
            const opt = document.createElement('option');
            opt.value       = al.id;
            opt.textContent = `${al.nome} — ${al.faixa_atual}`;
            seletores[0].appendChild(opt);
        });

        restaurarEstadoLocalStorage();
    }

    seletores[0].addEventListener('change', (e) => {
        const id  = e.target.value;
        const al1 = cacheAlunos.find(a => a.id === id);

        if (!al1) {
            for (let i = 1; i < 4; i++) {
                seletores[i].innerHTML  = '<option value="">— Selecione o Candidato 1 primeiro —</option>';
                seletores[i].disabled   = true;
                document.getElementById(`badge-${i + 1}`).textContent = '—';
                document.getElementById(`col-aluno-${i + 1}`).textContent = `Candidato ${i + 1}`;
            }
            document.getElementById('card-notas-dinamicas').style.display = 'none';
            document.getElementById('badge-1').textContent = '—';
            atualizarTodosSeletores();
            salvarEstadoLocalStorage();
            return;
        }

        document.getElementById('badge-1').textContent        = al1.faixa_atual;
        document.getElementById('col-aluno-1').textContent    = al1.nome.split(' ')[0];

        atualizarTodosSeletores();
        renderizarMatriz(al1.faixa_atual);
        salvarEstadoLocalStorage();
    });

    for (let i = 1; i < 4; i++) {
        seletores[i].addEventListener('change', (e) => {
            const al  = cacheAlunos.find(a => a.id === e.target.value);
            const lbl = document.getElementById(`col-aluno-${i + 1}`);
            const bdg = document.getElementById(`badge-${i + 1}`);

            if (al) {
                lbl.textContent = al.nome.split(' ')[0];
                bdg.textContent = al.faixa_atual;
            } else {
                lbl.textContent = `Candidato ${i + 1}`;
                bdg.textContent = '—';
            }
            atualizarTodosSeletores();
            salvarEstadoLocalStorage();
        });
    }

    // ============================================================
    // 8. renderizarMatriz(faixa)
    //
    // .trim().toLowerCase() antes de consultar REGRAS_EXAME para
    // tolerar espaços invisíveis e capitalização variável do banco.
    // ============================================================
    function renderizarMatriz(faixa) {
        if (!faixa) {
            exibirToast('Aluno sem graduação definida.', 'erro');
            return;
        }

        const faixaChave = faixa.trim().toLowerCase();
        const items      = REGRAS_EXAME[faixaChave];

        if (!items) {
            exibirToast(`Graduação "${faixa.trim()}" sem ementa cadastrada.`, 'erro');
            return;
        }

        const corpo = document.getElementById('tabela-corpo-itens');
        corpo.innerHTML = '';

        // Título em maiúsculo sem interpolação de HTML (textContent)
        document.getElementById('titulo-tabela-exame').textContent =
            `Matriz de Avaliação — Faixa ${faixa.trim().toUpperCase()}`;

        items.forEach((item, index) => {
            const tr = document.createElement('tr');

            // Cria células sem innerHTML para evitar XSS em dados futuros do banco
            const tdTecnica = document.createElement('td');
            const strong = document.createElement('strong');
            strong.textContent = `[${item.cat}] `;
            tdTecnica.appendChild(strong);
            tdTecnica.appendChild(document.createTextNode(item.nome));

            const tdMax = document.createElement('td');
            tdMax.innerHTML = `<strong>${item.max}</strong>`;

            // Cria os 4 inputs de nota
            const inputClasses = ['n-al1', 'n-al2', 'n-al3', 'n-al4'];
            const inputRequireds = [true, false, false, false];

            const cells = [tdTecnica, tdMax];
            inputClasses.forEach((cls, ci) => {
                const td    = document.createElement('td');
                const input = document.createElement('input');
                input.type         = 'number';
                input.step         = '0.1';
                input.min          = '0';
                input.max          = String(item.max);
                input.className    = `nota-input ${cls}`;
                input.dataset.index = String(index);
                input.dataset.max   = String(item.max);
                if (inputRequireds[ci]) input.required = true;
                td.appendChild(input);
                cells.push(td);
            });

            cells.forEach(c => tr.appendChild(c));
            corpo.appendChild(tr);
        });

        document.getElementById('card-notas-dinamicas').style.display = 'block';
    }

    // ============================================================
    // 9. SUBMIT — GRAVAÇÃO EM LOTE COM VALIDAÇÃO ESTRITA
    //
    // SEGURANÇA APLICADA:
    //   a) validarUUID(idAluno) — rejeita IDs malformados
    //   b) validarNota(valor, max) — rejeita strings, NaN, out-of-range
    //   c) Feedback visual nos inputs inválidos (.invalida)
    //   d) INSERT só ocorre se TODOS os dados passarem na validação
    // ============================================================
    document.getElementById('form-banca-notas').addEventListener('submit', async (e) => {
        e.preventDefault();

        const btnGravar = document.getElementById('btn-gravar');
        const inserts   = [];
        let   temErro   = false;

        // Limpa marcações de erro anteriores
        document.querySelectorAll('.nota-input.invalida').forEach(el => el.classList.remove('invalida'));

        for (let i = 0; i < 4; i++) {
            const idAluno = seletores[i].value;
            if (!idAluno) continue; // Slot vazio — OK, pula

            // VALIDAÇÃO 1: ID deve ser UUID v4 válido
            if (!validarUUID(idAluno)) {
                exibirToast(`ID do Candidato ${i + 1} é inválido. Recarregue a página.`, 'erro');
                temErro = true;
                break;
            }

            const alObj      = cacheAlunos.find(a => a.id === idAluno);
            const inputsNota = document.querySelectorAll(`.n-al${i + 1}`);
            let   somatório  = 0;
            let   erroNota   = false;

            inputsNota.forEach(input => {
                const maxItem = parseFloat(input.dataset.max);
                const nota    = validarNota(input.value, maxItem);

                if (nota === null) {
                    // VALIDAÇÃO 2: nota inválida — marca o input visualmente
                    input.classList.add('invalida');
                    erroNota = true;
                } else {
                    somatório += nota;
                }
            });

            if (erroNota) {
                exibirToast(
                    `Notas do Candidato ${i + 1} inválidas. Verifique os campos marcados em vermelho.`,
                    'erro',
                    5000
                );
                temErro = true;
                break;
            }

            inserts.push({
                conta_avaliador:     contaBanca,
                nome_real_avaliador: nomeAvaliador,
                graduacao_avaliador: graduacaoAvaliador,
                id_aluno:            idAluno,
                faixa_avaliada:      alObj ? alObj.faixa_atual : 'Desconhecida',
                materia:             'Exame de Graduação em Lote',
                nota:                somatório
            });
        }

        if (temErro || inserts.length === 0) {
            if (inserts.length === 0 && !temErro) {
                exibirToast('Selecione pelo menos 1 candidato.', 'aviso');
            }
            return;
        }

        // Desabilita o botão durante o INSERT para evitar duplo clique
        btnGravar.disabled     = true;
        btnGravar.textContent  = 'Gravando...';

        const { error } = await _supabase.from('exames_notas').insert(inserts);

        if (error) {
            exibirToast(`Erro na gravação: ${error.message}`, 'erro', 6000);
            btnGravar.disabled    = false;
            btnGravar.textContent = 'Gravar Notas de Toda a Banca';
        } else {
            exibirToast('Notas gravadas com sucesso!', 'sucesso');
            localStorage.removeItem('wtkd_sessao_exame'); // Limpa o estado salvo ao finalizar com sucesso
            setTimeout(() => location.reload(), 1800);
        }
    });

    // ============================================================
    // 9.1. FUNÇÕES AUXILIARES DE EXCLUSÃO MÚTUA E PERSISTÊNCIA
    // ============================================================

    /**
     * Evita que o mesmo aluno seja selecionado em mais de um select na página.
     * reconstrói as opções dos selects filtrando os alunos já selecionados
     * em outras rodadas ou posições.
     */
    function atualizarTodosSeletores() {
        const todosSelects = Array.from(document.querySelectorAll('select[id*="aluno-"]'));
        const selecionados = todosSelects.map(s => s.value).filter(v => v !== "");

        const rodadas = [1];
        for (let n = 2; n <= totalRodadas; n++) {
            if (document.getElementById(`rodada-bloco-${n}`)) {
                rodadas.push(n);
            }
        }

        rodadas.forEach(r => {
            const prefix = r === 1 ? "" : `r${r}-`;
            const sel1 = document.getElementById(`${prefix}aluno-1`);
            if (!sel1) return;

            const valAtual1 = sel1.value;
            const al1 = cacheAlunos.find(a => a.id === valAtual1);

            // Atualiza Candidato 1
            sel1.innerHTML = '<option value="">Selecione o Candidato 1...</option>';
            cacheAlunos.forEach(al => {
                if (al.id === valAtual1 || !selecionados.includes(al.id)) {
                    const opt = document.createElement('option');
                    opt.value = al.id;
                    opt.textContent = `${al.nome} — ${al.faixa_atual}`;
                    sel1.appendChild(opt);
                }
            });
            sel1.value = valAtual1;

            // Atualiza Candidatos 2, 3, 4
            const faixaFiltro = al1 ? al1.faixa_atual.trim().toLowerCase() : null;

            for (let i = 2; i <= 4; i++) {
                const selI = document.getElementById(`${prefix}aluno-${i}`);
                if (!selI) continue;

                const valAtualI = selI.value;
                const colId = r === 1 ? `col-aluno-${i}` : `${prefix}col-${i}`;
                const badgeId = `${prefix}badge-${i}`;
                const colElem = document.getElementById(colId);
                const badgeElem = document.getElementById(badgeId);

                if (!al1) {
                    selI.innerHTML = '<option value="">— Selecione o Candidato 1 primeiro —</option>';
                    selI.disabled = true;
                    selI.value = "";
                    if (badgeElem) badgeElem.textContent = '—';
                    if (colElem) colElem.textContent = `Candidato ${i}`;
                    continue;
                }

                // Filtra alunos da mesma faixa que não estejam selecionados em outro lugar
                const mesmaFaixaFiltrada = cacheAlunos.filter(al => {
                    const mesmaFaixa = al.faixa_atual.trim().toLowerCase() === faixaFiltro;
                    const naoSelecionadoOutro = al.id === valAtualI || !selecionados.includes(al.id);
                    return mesmaFaixa && naoSelecionadoOutro;
                });

                if (mesmaFaixaFiltrada.length === 0 && valAtualI === "") {
                    selI.innerHTML = `<option value="">— Sem outros alunos em ${al1.faixa_atual} —</option>`;
                    selI.disabled = true;
                    selI.value = "";
                    if (badgeElem) badgeElem.textContent = '—';
                    if (colElem) colElem.textContent = `Candidato ${i}`;
                } else {
                    selI.innerHTML = '<option value="">— Vazio (opcional) —</option>';
                    mesmaFaixaFiltrada.forEach(al => {
                        const opt = document.createElement('option');
                        opt.value = al.id;
                        opt.textContent = al.nome;
                        selI.appendChild(opt);
                    });
                    selI.disabled = false;
                    selI.value = valAtualI;

                    const alI = cacheAlunos.find(a => a.id === valAtualI);
                    if (alI) {
                        if (colElem) colElem.textContent = alI.nome.split(' ')[0];
                        if (badgeElem) badgeElem.textContent = alI.faixa_atual;
                    } else {
                        if (colElem) colElem.textContent = `Candidato ${i}`;
                        if (badgeElem) badgeElem.textContent = '—';
                    }
                }
            }
        });
    }

    /**
     * Salva o estado atual de toda a banca de avaliação no localStorage.
     */
    function salvarEstadoLocalStorage() {
        try {
            const rodadasExistentes = [1];
            for (let n = 2; n <= totalRodadas; n++) {
                if (document.getElementById(`rodada-bloco-${n}`)) {
                    rodadasExistentes.push(n);
                }
            }

            const dadosRodadas = rodadasExistentes.map(r => {
                const prefix = r === 1 ? "" : `r${r}-`;
                const candidatos = [
                    document.getElementById(`${prefix}aluno-1`) ? document.getElementById(`${prefix}aluno-1`).value : "",
                    document.getElementById(`${prefix}aluno-2`) ? document.getElementById(`${prefix}aluno-2`).value : "",
                    document.getElementById(`${prefix}aluno-3`) ? document.getElementById(`${prefix}aluno-3`).value : "",
                    document.getElementById(`${prefix}aluno-4`) ? document.getElementById(`${prefix}aluno-4`).value : ""
                ];

                const notas = [[], [], [], []];
                for (let c = 1; c <= 4; c++) {
                    const inputClass = r === 1 ? `n-al${c}` : `r${r}-al${c}`;
                    const inputs = document.querySelectorAll(`.${inputClass}`);
                    inputs.forEach(input => {
                        const idx = parseInt(input.dataset.index);
                        notas[c - 1][idx] = input.value || "";
                    });
                }

                // Salva se o botão gravar já está em estado final gravado
                const btn = r === 1 ? document.getElementById('btn-gravar') : document.getElementById(`r${r}-btn-gravar`);
                const gravado = btn ? (btn.textContent.includes('Gravado') || (btn.disabled && btn.style.background.includes('rgb(28, 66, 28)'))) : false;

                return {
                    numero: r,
                    candidatos: candidatos,
                    notas: notas,
                    gravado: gravado
                };
            });

            localStorage.setItem('wtkd_sessao_exame', JSON.stringify({
                totalRodadas: totalRodadas,
                rodadas: dadosRodadas
            }));
        } catch (e) {
            console.error("Erro ao salvar estado no localStorage:", e);
        }
    }

    /**
     * Restaura o estado anterior de toda a banca a partir do localStorage.
     */
    function restaurarEstadoLocalStorage() {
        try {
            const estadoRaw = localStorage.getItem('wtkd_sessao_exame');
            if (!estadoRaw) return;

            const estado = JSON.parse(estadoRaw);
            if (!estado || !estado.rodadas || !Array.isArray(estado.rodadas)) return;

            // 1. Recria as rodadas extras salvas
            const extraRounds = estado.rodadas.filter(r => r.numero > 1).sort((a, b) => a.numero - b.numero);
            extraRounds.forEach(rData => {
                criarEstruturaRodada(rData.numero);
                if (rData.numero > totalRodadas) {
                    totalRodadas = rData.numero;
                }
            });

            // 2. Popula os seletores de cada rodada
            estado.rodadas.forEach(rData => {
                const prefix = rData.numero === 1 ? "" : `r${rData.numero}-`;

                // Restaura Candidato 1
                const sel1 = document.getElementById(`${prefix}aluno-1`);
                if (sel1) {
                    sel1.value = rData.candidatos[0] || "";
                    const al1 = cacheAlunos.find(a => a.id === sel1.value);
                    if (al1) {
                        document.getElementById(`${prefix}badge-1`).textContent = al1.faixa_atual;
                        const col1 = document.getElementById(rData.numero === 1 ? 'col-aluno-1' : `${prefix}col-1`);
                        if (col1) col1.textContent = al1.nome.split(' ')[0];

                        // Renderiza a tabela correspondente
                        if (rData.numero === 1) {
                            renderizarMatriz(al1.faixa_atual);
                        } else {
                            renderizarMatrizRodada(rData.numero, al1.faixa_atual);
                        }
                    }
                }

                // Restaura Candidatos 2, 3, 4
                for (let i = 2; i <= 4; i++) {
                    const selI = document.getElementById(`${prefix}aluno-${i}`);
                    if (selI) {
                        selI.value = rData.candidatos[i - 1] || "";
                        const alI = cacheAlunos.find(a => a.id === selI.value);
                        const colI = document.getElementById(rData.numero === 1 ? `col-aluno-${i}` : `${prefix}col-${i}`);
                        const badgeI = document.getElementById(`${prefix}badge-${i}`);
                        if (alI) {
                            if (colI) colI.textContent = alI.nome.split(' ')[0];
                            if (badgeI) badgeI.textContent = alI.faixa_atual;
                        } else {
                            if (colI) colI.textContent = `Candidato ${i}`;
                            if (badgeI) badgeI.textContent = '—';
                        }
                    }
                }
            });

            // 3. Executa a exclusão mútua inicial de opções
            atualizarTodosSeletores();

            // 4. Preenche as notas salvas
            estado.rodadas.forEach(rData => {
                const prefix = rData.numero === 1 ? "" : `r${rData.numero}-`;

                for (let c = 1; c <= 4; c++) {
                    const inputClass = rData.numero === 1 ? `n-al${c}` : `r${rData.numero}-al${c}`;
                    const inputs = document.querySelectorAll(`.${inputClass}`);
                    const savedCandidateNotes = rData.notas[c - 1] || [];
                    inputs.forEach(input => {
                        const idx = parseInt(input.dataset.index);
                        if (savedCandidateNotes[idx] !== undefined && savedCandidateNotes[idx] !== "") {
                            input.value = savedCandidateNotes[idx];
                        }
                    });
                }

                // Se a rodada já estava salva no Supabase, bloqueia inputs e botão
                if (rData.gravado) {
                    const btn = rData.numero === 1 ? document.getElementById('btn-gravar') : document.getElementById(`r${rData.numero}-btn-gravar`);
                    if (btn) {
                        btn.textContent = '✅ Gravado';
                        btn.style.background = '#1c421c';
                        btn.style.color      = '#30d158';
                        btn.disabled = true;
                    }
                    desabilitarRodadaGravada(rData.numero);
                }
            });

        } catch (e) {
            console.error("Erro ao restaurar estado do exame:", e);
        }
    }

    /**
     * Trava seletores e notas de uma rodada gravada com sucesso.
     */
    function desabilitarRodadaGravada(n) {
        for (let i = 1; i <= 4; i++) {
            const prefix = n === 1 ? "" : `r${n}-`;
            const sel = document.getElementById(`${prefix}aluno-${i}`);
            if (sel) sel.disabled = true;

            const inputClass = n === 1 ? `n-al${i}` : `r${n}-al${i}`;
            const inputs = document.querySelectorAll(`.${inputClass}`);
            inputs.forEach(input => input.disabled = true);
        }
        if (n > 1) {
            const btnRemover = document.querySelector(`#rodada-bloco-${n} .btn-remover-rodada`);
            if (btnRemover) btnRemover.style.display = 'none';
        }
    }

    // Listener global para auto-salvar qualquer alteração de nota
    document.addEventListener('input', (e) => {
        if (e.target.classList.contains('nota-input')) {
            salvarEstadoLocalStorage();
        }
    });

    // ============================================================
    // 10. INICIALIZAÇÃO
    // ============================================================
    window.onload = carregarAlunosBase;

