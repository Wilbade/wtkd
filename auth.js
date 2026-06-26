// ============================================================================
// ARQUIVO: auth.js
// PROPÓSITO: Módulo central de segurança do sistema WTKD.
//            Fornece: guarda de rotas, sanitização anti-XSS,
//            validação de tipos para inserts no Supabase, e
//            roteamento de perfil pós-login.
//
// IMPORTAÇÃO: Incluir via <script src="auth.js"></script> ANTES
//             de qualquer outro script nas telas operacionais.
//             Não importar em páginas públicas (index, curriculo, etc.)
// ============================================================================


// ============================================================================
// 1. CONSTANTES DE CONFIGURAÇÃO DE ACESSO
// ============================================================================

// Contas de avaliadores de banca (email local sem domínio).
// Estes usuários são redirecionados para exame.html após o login.
const CONTAS_AVALIADORES = ['avaliador1', 'avaliador2', 'avaliador3', 'avaliador4'];

// Contas com privilégio máximo no sistema (ex: diretores gerais)
// Estes usuários podem editar cadastros. Outros administradores só podem ver/incluir.
const CONTAS_ADMIN_MASTER = ['wiliamlongo', 'master', 'admin'];

function isAvaliador(conta) {
    if (!conta) return false;
    return CONTAS_AVALIADORES.includes(conta.toLowerCase().trim());
}

function isMaster(conta) {
    if (!conta) return false;
    return CONTAS_ADMIN_MASTER.includes(conta.toLowerCase().trim());
}

// Regex para validar o formato UUID v4 (formato padrão do Supabase para PKs)
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


// ============================================================================
// 2. GUARDA DE ROTA — verificarSessao()
//
// Checa se as 3 chaves de sessão estão gravadas no localStorage.
// Se qualquer uma estiver faltando, bloqueia a execução do script
// e redireciona imediatamente para login.html.
//
// DEVE SER A PRIMEIRA FUNÇÃO CHAMADA em qualquer tela operacional.
// Bloquear ANTES de qualquer operação de banco garante que nenhuma
// query seja disparada por usuários não autenticados.
//
// @returns {{ conta: string, nome: string, graduacao: string }}
//          Retorna o objeto de sessão se válido. Nunca retorna se inválido
//          (pois redireciona antes).
// ============================================================================
function verificarSessao() {
    const conta      = localStorage.getItem('wtkd_conta');
    const nome       = localStorage.getItem('wtkd_nome_real');
    const graduacao  = localStorage.getItem('wtkd_graduacao');

    if (!conta || !nome || !graduacao) {
        // Bloqueia execução e redireciona antes de qualquer operação de banco
        window.location.replace('login.html');
        // throw garante que o JS PARE completamente mesmo antes do redirect completar
        throw new Error('[WTKD Auth] Sessão inválida. Redirecionando para login.html');
    }

    return { conta, nome, graduacao };
}


// ============================================================================
// 3. ROTEAMENTO PÓS-LOGIN — resolverDestino()
//
// Determina para qual página o usuário deve ser redirecionado após
// a autenticação bem-sucedida no Supabase Auth, com base no identificador
// da conta (parte do email antes do @).
//
// REGRA DE NEGÓCIO:
//   - avaliador1, avaliador2, avaliador3, avaliador4 → exame.html
//   - Qualquer outro login (professor, admin, etc.)  → painel.html
//
// @param {string} conta - Identificador curto da conta (ex: "avaliador1")
// @returns {string} - URL de destino ('exame.html' ou 'painel.html')
// ============================================================================
function resolverDestino(conta) {
    // Master vai para o painel por padrão, onde tem acesso a tudo
    if (isMaster(conta)) {
        return 'painel.html';
    }
    // Avaliador vai direto para o painel de exame
    if (isAvaliador(conta)) {
        return 'exame.html';
    }
    // Donos de escola / demais contas vão para o painel (matrícula)
    return 'painel.html';
}

// ============================================================================
// 3.1. CONTROLE DE MENU - aplicarRegrasDeMenu()
//
// Esconde ou exibe itens de navegação dependendo do perfil do usuário.
// Deve ser chamada logo após verificarSessao() nas páginas protegidas.
// ============================================================================
function aplicarRegrasDeMenu() {
    const contaAtual = localStorage.getItem('wtkd_conta') || '';
    const isM = isMaster(contaAtual);
    const isA = isAvaliador(contaAtual);

    const navChamada = document.getElementById('nav-chamada');
    const navMatricula = document.getElementById('nav-matricula');
    const navExame = document.getElementById('nav-exame');
    const navBlog = document.getElementById('nav-blog');

    // Regras para não-Master
    if (!isM) {
        // Esconde Chamada (Navegação inferior/superior)
        if (navChamada) {
            navChamada.style.display = 'none';
            // Se a pessoa está no painel, força abrir a aba matrícula
            if (typeof alternarAba === 'function' && navMatricula) {
                alternarAba('aba-cadastro', navMatricula);
            }
        }
    }

    // Ocultar aba Blog se a conta não for especificamente wiliamlongo
    if (navBlog && contaAtual.toLowerCase().trim() !== 'wiliamlongo') {
        navBlog.style.display = 'none';
    }

    // Regras para quem não é nem Master nem Avaliador (ex: Donos de Escola)
    if (!isM && !isA) {
        if (navExame) navExame.style.display = 'none';
    }

    // Regras para quem é APENAS Avaliador
    if (isA && !isM) {
        if (navMatricula) navMatricula.style.display = 'none';
        if (navChamada) navChamada.style.display = 'none';
    }
}


// ============================================================================
// 4. SANITIZAÇÃO ANTI-XSS — sanitizar()
//
// Converte caracteres especiais HTML em entidades seguras antes de inserir
// qualquer string de origem externa (banco de dados, inputs) no innerHTML.
//
// QUANDO USAR:
//   - Sempre que injetar dados do banco em innerHTML/outerHTML
//   - NÃO é necessário para textContent (que é seguro por natureza)
//
// Caracteres sanitizados:
//   & → &amp;   < → &lt;   > → &gt;   " → &quot;   ' → &#x27;
//
// @param {any} valor - Valor a sanitizar. Null/undefined retornam string vazia.
// @returns {string} - String segura para uso em HTML
// ============================================================================
function sanitizar(valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor)
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#x27;');
}


// ============================================================================
// 5. VALIDAÇÃO DE NOTA — validarNota()
//
// Valida se um valor de input é um número finito dentro do intervalo [0, max].
// Usado antes de cada INSERT na tabela 'exames_notas' para garantir que
// apenas dados numéricos válidos cheguem ao Supabase.
//
// PROTEÇÃO: Impede que strings, NaN, Infinity ou valores fora do limite
// sejam inseridos como notas, mesmo que o input seja manipulado via DevTools.
//
// @param {string|number} valor - Valor bruto do input
// @param {number} max          - Pontuação máxima permitida para a técnica
// @returns {number|null}       - Número parseado e válido, ou null se inválido
// ============================================================================
function validarNota(valor, max) {
    const num = parseFloat(valor);
    if (isNaN(num))        return null; // Não é número
    if (!isFinite(num))    return null; // Infinity ou -Infinity
    if (num < 0)           return null; // Negativo não permitido
    if (num > max)         return null; // Acima do limite da técnica
    return num;
}


// ============================================================================
// 6. VALIDAÇÃO DE UUID — validarUUID()
//
// Valida se uma string segue o formato UUID v4 padrão do Supabase.
// Usado antes de cada INSERT para garantir que o campo id_aluno seja
// um UUID legítimo e não uma string arbitrária injetada.
//
// @param {string} str - String a validar
// @returns {boolean}  - true se for UUID v4 válido
// ============================================================================
function validarUUID(str) {
    if (typeof str !== 'string') return false;
    return REGEX_UUID.test(str.trim());
}


// ============================================================================
// 7. UTILITÁRIO DE TOAST — exibirToast()
//
// Exibe uma mensagem de feedback temporária (toast notification) no canto
// inferior da tela. Substitui alert() nas validações para não bloquear a UI.
//
// @param {string} mensagem  - Texto a exibir
// @param {'sucesso'|'erro'|'aviso'} tipo - Define a cor do toast
// @param {number} [duracao=3500] - Duração em ms antes de desaparecer
// ============================================================================
function exibirToast(mensagem, tipo = 'aviso', duracao = 3500) {
    // Remove toast anterior se existir
    const toastExistente = document.getElementById('wtkd-toast');
    if (toastExistente) toastExistente.remove();

    // Cria o elemento de toast
    const toast = document.createElement('div');
    toast.id = 'wtkd-toast';
    toast.textContent = mensagem;

    // Cores por tipo
    const cores = {
        sucesso: { bg: '#1c421c', border: '#30d158', text: '#30d158' },
        erro:    { bg: '#421c1c', border: '#ff453a', text: '#ff453a' },
        aviso:   { bg: '#2c2416', border: '#ff9f0a', text: '#ff9f0a' }
    };
    const cor = cores[tipo] || cores.aviso;

    // Estilos do toast (inline para independência de CSS externo)
    Object.assign(toast.style, {
        position:     'fixed',
        bottom:       '24px',
        left:         '50%',
        transform:    'translateX(-50%)',
        background:   cor.bg,
        border:       `1px solid ${cor.border}`,
        color:        cor.text,
        padding:      '12px 24px',
        borderRadius: '8px',
        fontWeight:   '600',
        fontSize:     '14px',
        zIndex:       '9999',
        boxShadow:    '0 4px 20px rgba(0,0,0,0.5)',
        maxWidth:     '90vw',
        textAlign:    'center',
        transition:   'opacity 0.3s ease'
    });

    document.body.appendChild(toast);

    // Remove automaticamente após a duração configurada
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, duracao);
}

// ============================================================================
// 8. LOGOFF — fazerLogoff()
//
// Limpa a sessão do localStorage e redireciona para a tela de login.
// ============================================================================
function fazerLogoff() {
    if (confirm("Deseja realmente sair e deslogar da sessão?")) {
        localStorage.removeItem('wtkd_conta');
        localStorage.removeItem('wtkd_nome_real');
        localStorage.removeItem('wtkd_graduacao');
        window.location.replace('login.html');
    }
}

