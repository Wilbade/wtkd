/**
 * unidades.js — Gerenciador Modular de Unidades e Academias Parceiras
 * Wil TKD — Team Marchesini
 *
 * Adicione ou edite academias parceiras neste arquivo para atualizar
 * instantaneamente o site e a demonstração para novos parceiros.
 */

(function () {
    'use strict';

    // =========================================================================
    // CONFIGURAÇÃO DAS UNIDADES E POLOS OFICIAIS TEAM MARCHESINI
    // =========================================================================
    window.WTKD_UNIDADES = [
        {
            id: 'ellite-sbc',
            nome: 'CT Ellite Fighters — São Bernardo do Campo',
            tipo: 'Unidade Oficial',
            status: 'ativo', // 'ativo' | 'em_breve' | 'turmas_abertas'
            statusLabel: '🟢 Unidade Ativa',
            cidade: 'São Bernardo do Campo',
            bairro: 'Centro',
            endereco: 'Av. Francisco Prestes Maia, 144 - Centro',
            cep: '09770-000',
            whatsappNumero: '5511948759648', // WhatsApp oficial da recepção da Ellite Fighters
            logoUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcREGhCvAbr3PHOavhJXC1ahmmDXRMunoxFMMg&s',
            instagramUrl: 'https://www.instagram.com/aellitefighters/',
            horarios: [
                { turma: 'Adultos', dias: 'Terças & Quintas', horario: '18:30h às 19:30h' },
                { turma: 'Kids', dias: 'Terças & Quintas', horario: '19:30h às 20:30h' }
            ],
            mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3653.3!2d-46.5502!3d-23.7037!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ce436a7e3b5b3f%3A0x0!2sAv.+Francisco+Prestes+Maia%2C+144+-+Centro%2C+S%C3%A3o+Bernardo+do+Campo+-+SP%2C+09770-000!5e0!3m2!1spt-BR!2sbr!4v1',
            linkAgendamento: 'https://agendamento.nextfit.com.br/ee5940af-b75d-4d4e-b098-b4db33903915',
            msgWhatsapp: 'Olá! Gostaria de agendar uma aula experimental de Taekwondo com o Mestre Wil no CT Ellite Fighters.'
        },
        {
            id: 'polo-santo-andre',
            nome: 'Polo Santo André — Vila Gilda & Região',
            tipo: 'Expansão & Parcerias',
            status: 'em_breve',
            statusLabel: '🚀 Novas Turmas / Pré-Inscrição',
            cidade: 'Santo André',
            bairro: 'Vila Gilda / Jardim Bela Vista / Bairro Jardim',
            endereco: 'Região Av. Portugal & Av. Pereira Barreto (Próx. Shopping ABC)',
            cep: '09060-580',
            whatsappNumero: '5511995314831', // WhatsApp direto do Mestre Wil para captação de Santo André
            logoUrl: 'public/assets/images/logo.png',
            instagramUrl: 'https://www.instagram.com/wil.marchesini/',
            horarios: [
                { turma: 'Adultos & Kids', dias: 'Manhã / Tarde / Noite', horario: 'Grade em formação' }
            ],
            mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d14619.567882206775!2d-46.540121!3d-23.662589!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ce42e05206ab6f%3A0x8673a5a4157e9ddb!2sVila%20Gilda%2C%20Santo%20Andr%C3%A9%20-%20SP%2C%2009060-580!5e0!3m2!1spt-BR!2sbr!4v1',
            linkAgendamento: '',
            msgWhatsapp: 'Olá Mestre Wil! Tenho interesse em treinar Taekwondo nas turmas de Santo André (Vila Gilda / Região). Quero entrar na lista VIP.'
        }
    ];

    // =========================================================================
    // RENDERIZADOR DOS CARDS DE UNIDADES
    // =========================================================================
    function renderizarCardsUnidades() {
        const container = document.getElementById('wtkd-unidades-container');
        if (!container) return;

        container.innerHTML = window.WTKD_UNIDADES.map(u => {
            const isAtivo = u.status === 'ativo';
            const badgeClass = isAtivo ? 'badge-ativo' : 'badge-em-breve';
            const numeroDestino = u.whatsappNumero || '5511995314831';
            const whatsappLink = `https://api.whatsapp.com/send/?phone=${numeroDestino}&text=${encodeURIComponent(u.msgWhatsapp)}`;

            return `
                <div class="unidade-card ${isAtivo ? 'unidade-card-ativo' : 'unidade-card-expansao'}" id="unidade-${u.id}">
                    <div class="unidade-header">
                        <div class="unidade-info-principal">
                            <span class="unidade-badge ${badgeClass}">${u.statusLabel}</span>
                            <h3 class="unidade-titulo">${u.nome}</h3>
                            <p class="unidade-bairro">📍 ${u.bairro} — ${u.cidade}</p>
                        </div>
                        ${u.logoUrl ? `
                            <div class="unidade-logo-box">
                                <img src="${u.logoUrl}" alt="Logo ${u.nome}" class="unidade-logo-img" loading="lazy">
                            </div>
                        ` : ''}
                    </div>

                    <div class="unidade-endereco">
                        <strong>Endereço:</strong> ${u.endereco}<br>
                        <strong>CEP:</strong> ${u.cep}
                    </div>

                    <div class="unidade-horarios">
                        <strong>Grade de Treinos:</strong>
                        <div class="schedule-box" style="margin-top: 8px;">
                            ${u.horarios.map(h => `
                                <div class="schedule-row">
                                    <span class="tag">${h.turma}</span>
                                    <span class="time">${h.dias} — ${h.horario}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="unidade-acoes">
                        ${u.linkAgendamento ? `
                            <a href="${u.linkAgendamento}" target="_blank" rel="noopener noreferrer" class="btn btn-nextfit" style="flex: 1;">
                                Agendar Aula Experimental
                            </a>
                        ` : ''}
                        <a href="${whatsappLink}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp" style="flex: 1;">
                            ${isAtivo ? 'Falar no WhatsApp' : 'Entrar na Lista VIP de Vagas'}
                        </a>
                    </div>

                    ${u.mapEmbedUrl ? `
                        <div class="unidade-mapa">
                            <iframe class="map-frame" src="${u.mapEmbedUrl}" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade" style="border: 0; width: 100%; height: 180px; border-radius: 8px; margin-top: 14px;"></iframe>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    // =========================================================================
    // ESTILOS DINÂMICOS DOS CARDS DE UNIDADES (CSS)
    // =========================================================================
    function injetarEstilos() {
        if (document.getElementById('wtkd-unidades-styles')) return;

        const css = `
            #wtkd-unidades-container {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                gap: 24px;
                width: 100%;
                margin-top: 20px;
            }

            .unidade-card {
                background-color: var(--card-bg, #141414);
                border: 1px solid var(--card-border, #262626);
                border-radius: 14px;
                padding: 24px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
            }

            .unidade-card:hover {
                transform: translateY(-3px);
                border-color: #ff3b30;
                box-shadow: 0 8px 30px rgba(255, 26, 26, 0.15);
            }

            .unidade-card-expansao {
                border-style: dashed;
                border-color: #444;
            }

            .unidade-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 16px;
                margin-bottom: 14px;
            }

            .unidade-badge {
                display: inline-block;
                padding: 4px 10px;
                border-radius: 20px;
                font-size: 11.5px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 8px;
            }

            .badge-ativo {
                background: rgba(37, 211, 102, 0.15);
                color: #25d366;
                border: 1px solid rgba(37, 211, 102, 0.3);
            }

            .badge-em-breve {
                background: rgba(0, 118, 255, 0.15);
                color: #38a2ff;
                border: 1px solid rgba(0, 118, 255, 0.3);
            }

            .unidade-titulo {
                font-size: 17px;
                font-weight: 700;
                margin: 0 0 4px 0;
                color: #ffffff;
                line-height: 1.3;
            }

            .unidade-bairro {
                font-size: 13px;
                color: #a0a0a0;
                margin: 0;
            }

            .unidade-logo-box {
                flex-shrink: 0;
                width: 60px;
                height: 60px;
                background: #000;
                border: 1px solid #333;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            }

            .unidade-logo-img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
            }

            .unidade-endereco {
                font-size: 13px;
                color: #ccc;
                line-height: 1.5;
                background: #0d0d0d;
                padding: 12px;
                border-radius: 8px;
                border: 1px solid #222;
                margin-bottom: 14px;
            }

            .unidade-horarios {
                font-size: 13px;
                color: #eee;
                margin-bottom: 16px;
            }

            .unidade-acoes {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-top: auto;
            }

            @media (min-width: 600px) {
                .unidade-acoes {
                    flex-direction: row;
                }
            }
        `;

        const styleEl = document.createElement('style');
        styleEl.id = 'wtkd-unidades-styles';
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
    }

    // Inicialização ao carregar a página
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injetarEstilos();
            renderizarCardsUnidades();
        });
    } else {
        injetarEstilos();
        renderizarCardsUnidades();
    }
})();
