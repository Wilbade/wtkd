/**
 * nav.js — Menu de Navegação Global (Web Component Nativo)
 * Wil TKD — Team Marchesini
 *
 * Uso: inclua <script src="nav.js"></script> no <head> de cada página
 *      e coloque <wtkd-nav></wtkd-nav> logo após o <body>.
 *
 * Funciona 100% em: GitHub Pages, Live Server, Netlify, ou qualquer
 * hospedagem de arquivos estáticos — sem servidor, sem Node.js.
 */

(function () {
    'use strict';

    // ============================================================
    // CSS DO HEADER — injetado uma única vez no <head>
    // ============================================================
    const NAV_STYLES = `
        /* ======================================================
           WTKD HEADER — Design System
        ====================================================== */
        :root {
            --nav-primary:    #ff1a1a;
            --nav-dark-bg:    rgba(0, 0, 0, 0.85);
            --nav-border:     #262626;
            --nav-text-main:  #ffffff;
            --nav-text-muted: #a0a0a0;
        }

        wtkd-nav header {
            background-color: var(--nav-dark-bg);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            position: sticky;
            top: 0;
            z-index: 100;
            padding: 16px 48px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--nav-border);
        }

        /* === BRAND (logo + texto) === */
        wtkd-nav .nav-brand {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 12px;
            text-decoration: none;
            color: var(--nav-text-main);
        }

        wtkd-nav .nav-brand img {
            height: 45px;
            border-radius: 50%;
            flex-shrink: 0;
        }

        wtkd-nav .nav-brand-text {
            display: flex;
            flex-direction: column;
        }

        wtkd-nav .nav-brand h1 {
            margin: 0;
            font-size: 22px;
            font-weight: 800;
            letter-spacing: 1px;
            text-transform: uppercase;
            color: var(--nav-text-main);
            line-height: 1;
        }

        wtkd-nav .nav-brand h1 span {
            color: var(--nav-primary);
        }

        /* === LISTA DE LINKS === */
        wtkd-nav nav ul {
            list-style: none;
            display: flex;
            gap: 28px;
            margin: 0;
            padding: 0;
        }

        wtkd-nav nav a {
            color: var(--nav-text-muted);
            text-decoration: none;
            font-size: 14px;
            font-weight: 500;
            transition: color 0.2s, text-shadow 0.2s;
        }

        wtkd-nav nav a:hover,
        wtkd-nav nav a.active {
            color: var(--nav-text-main);
            font-weight: 700;
            text-shadow: 0 0 10px rgba(255, 255, 255, 0.4);
        }

        /* === HAMBURGER BUTTON (só mobile) === */
        wtkd-nav .nav-hamburger {
            display: none;
            background: none;
            border: 1px solid var(--nav-border);
            border-radius: 6px;
            padding: 8px 10px;
            cursor: pointer;
            flex-direction: column;
            gap: 5px;
        }

        wtkd-nav .nav-hamburger span {
            display: block;
            width: 22px;
            height: 2px;
            background: var(--nav-text-main);
            border-radius: 2px;
            transition: all 0.3s;
        }

        /* === MOBILE DRAWER === */
        wtkd-nav .nav-drawer {
            display: none;
            position: fixed;
            top: 0; right: 0;
            width: 75%;
            max-width: 280px;
            height: 100vh;
            background: #111;
            border-left: 1px solid var(--nav-border);
            z-index: 9999;
            flex-direction: column;
            padding: 60px 28px 28px;
            gap: 8px;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        }

        wtkd-nav .nav-drawer.open {
            display: flex;
            transform: translateX(0);
        }

        wtkd-nav .nav-drawer a {
            color: var(--nav-text-muted);
            text-decoration: none;
            font-size: 18px;
            font-weight: 600;
            padding: 12px 0;
            border-bottom: 1px solid var(--nav-border);
            transition: color 0.2s;
        }

        wtkd-nav .nav-drawer a:hover,
        wtkd-nav .nav-drawer a.active {
            color: var(--nav-primary);
        }

        wtkd-nav .nav-drawer .close-drawer {
            position: absolute;
            top: 16px; right: 20px;
            background: none;
            border: none;
            color: var(--nav-text-muted);
            font-size: 28px;
            cursor: pointer;
            line-height: 1;
        }

        wtkd-nav .nav-overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.6);
            z-index: 9998;
            backdrop-filter: blur(2px);
        }

        wtkd-nav .nav-overlay.open { display: block; }

        /* === RESPONSIVO === */
        @media (max-width: 768px) {
            wtkd-nav header {
                padding: 14px 20px;
            }

            wtkd-nav nav {
                display: none; /* esconde a nav horizontal */
            }

            wtkd-nav .nav-hamburger {
                display: flex;
            }
        }

        @media (max-width: 440px) {
            wtkd-nav .nav-brand h1 {
                font-size: 18px;
            }

            wtkd-nav .nav-brand img {
                height: 38px;
            }
        }
    `;

    // ============================================================
    // LINKS DO MENU — edite apenas aqui para mudar em todas as páginas
    // ============================================================
    const NAV_LINKS = [
        { href: 'index.html',      label: 'Início'    },
        { href: 'historia.html',   label: 'História'  },
        { href: 'formas.html',     label: 'Formas'    },
        { href: 'dicionario.html', label: 'Dicionário'},
        { href: 'curriculo.html',  label: 'Currículo' },
        { href: 'exame.html',      label: 'Exame'     },
    ];

    // ============================================================
    // DETECTA A PÁGINA ATUAL (compatível com Live Server e GitHub Pages)
    // ============================================================
    function paginaAtual() {
        const path = window.location.pathname;
        const filename = path.split('/').pop() || 'index.html';
        return filename === '' ? 'index.html' : filename;
    }

    // ============================================================
    // CRIA OS <li> com a classe "active" no link correto
    // ============================================================
    function buildLinks(drawerMode = false) {
        const atual = paginaAtual();
        return NAV_LINKS.map(({ href, label }) => {
            const isActive = href === atual;
            if (drawerMode) {
                return `<a href="${href}"${isActive ? ' class="active"' : ''}>${label}</a>`;
            }
            return `<li><a href="${href}"${isActive ? ' class="active"' : ''}>${label}</a></li>`;
        }).join('\n            ');
    }

    // ============================================================
    // WEB COMPONENT <wtkd-nav>
    // ============================================================
    class WtkdNav extends HTMLElement {
        connectedCallback() {
            // Injeta os estilos no <head> uma única vez
            if (!document.getElementById('wtkd-nav-styles')) {
                const style = document.createElement('style');
                style.id = 'wtkd-nav-styles';
                style.textContent = NAV_STYLES;
                document.head.appendChild(style);
            }

            // Renderiza o HTML do header
            this.innerHTML = `
                <header>
                    <a href="index.html" class="nav-brand">
                        <img src="public/assets/images/logo.png" alt="WIL TKD Logo">
                        <div class="nav-brand-text">
                            <h1>WIL <span>TKD</span></h1>
                        </div>
                    </a>

                    <nav>
                        <ul>
                            ${buildLinks(false)}
                        </ul>
                    </nav>

                    <!-- Botão hamburguer (só aparece no mobile via CSS) -->
                    <button class="nav-hamburger" id="wtkd-hamburger" aria-label="Abrir menu">
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>
                </header>

                <!-- Overlay escurecido ao abrir o drawer -->
                <div class="nav-overlay" id="wtkd-overlay"></div>

                <!-- Drawer lateral (menu mobile) -->
                <div class="nav-drawer" id="wtkd-drawer" role="navigation" aria-label="Menu mobile">
                    <button class="close-drawer" id="wtkd-close-drawer" aria-label="Fechar menu">&times;</button>
                    ${buildLinks(true)}
                </div>
            `;

            // === EVENT LISTENERS ===
            const hamburger   = this.querySelector('#wtkd-hamburger');
            const drawer      = this.querySelector('#wtkd-drawer');
            const overlay     = this.querySelector('#wtkd-overlay');
            const closeBtn    = this.querySelector('#wtkd-close-drawer');

            const openDrawer  = () => { drawer.classList.add('open'); overlay.classList.add('open'); document.body.style.overflow = 'hidden'; };
            const closeDrawer = () => { drawer.classList.remove('open'); overlay.classList.remove('open'); document.body.style.overflow = ''; };

            hamburger.addEventListener('click', openDrawer);
            closeBtn.addEventListener('click', closeDrawer);
            overlay.addEventListener('click', closeDrawer);
        }
    }

    // Registra o elemento customizado
    customElements.define('wtkd-nav', WtkdNav);

})();
