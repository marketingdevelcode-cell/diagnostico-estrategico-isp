/**
 * script.js — Diagnóstico Estratégico Máquina.ISP
 * -------------------------------------------------
 * Responsável por:
 *  1. Navegação entre as etapas do formulário
 *  2. Validação dos campos obrigatórios
 *  3. Cálculo do impacto estimado com base na estrutura de equipe
 *  4. Exibição formatada dos 5 resultados do diagnóstico
 *  5. Animação de análise de IA entre etapas
 */

/* ============================================================
   CONSTANTES DO MODELO DE CÁLCULO
   Salários médios de mercado para cada função
   Fator de custo inclui encargos trabalhistas (~50% sobre a folha)
   ============================================================ */
const salarios = {
    SDR:        3500,
    Closer:     5000,
    Financeiro: 4500,
    Suporte:    3000,
    PosVenda:   3500
};

const fatorCusto = 2.0; // Encargos + benefícios sobre a folha bruta (Fator 2X)

// Ganhos estimados pela solução Máquina.ISP
const reducaoInadimplencia    = 0.4;  // 40% do valor inadimplente recuperado
const reducaoChurn            = 0.3;  // 30% da perda por churn evitada
const aumentoCrescimento      = 0.15; // +15% de aumento na base (fallback)
const taxaConversaoLeads      = 0.20; // 20% de fechamento sobre novos leads
const reducaoCustoOperacional = 0.5;  // 50% de redução na folha operacional

/* ============================================================
   VARIÁVEIS GLOBAIS
   Armazenam os dados coletados no formulário de cadastro
   ============================================================ */
let dadosCadastro = {
    nome: '',
    email: '',
    telefone: '',
    empresa: '',
    cargo: '',
    erp: ''
};

/* ============================================================
   REFERÊNCIAS AOS ELEMENTOS DO DOM
   ============================================================ */

// Seções principais
const secaoCadastro    = document.getElementById('form-cadastro');
const secaoOperacional = document.getElementById('form-operacional');
const secaoResultados  = document.getElementById('secao-resultados');

// Formulários HTML
const formCadastro     = document.getElementById('form-cadastro-fields');
const formOperacional  = document.getElementById('form-operacional-fields');

// Botões de navegação
const btnVoltar        = document.getElementById('btn-voltar');
const btnRecalcular    = document.getElementById('btn-recalcular');
const btnAgendar       = document.getElementById('btn-agendar');

// Indicadores do stepper
const step1  = document.getElementById('step-1-indicator');
const step2  = document.getElementById('step-2-indicator');
const step3  = document.getElementById('step-3-indicator');
const line12 = document.getElementById('line-1-2');
const line23 = document.getElementById('line-2-3');

// Campos do formulário de cadastro
const campoNome      = document.getElementById('nome');
const campoEmail     = document.getElementById('email');
const campoTelefone  = document.getElementById('telefone');
const campoEmpresa   = document.getElementById('empresa');
const campoCargo     = document.getElementById('cargo');
const campoErp       = document.getElementById('erp');

// Campos do formulário operacional — dados do negócio
const campoNumClientes   = document.getElementById('num-clientes');
const campoTicketMedio   = document.getElementById('ticket-medio');
const campoInadimplencia = document.getElementById('inadimplencia');
const campoChurn         = document.getElementById('churn');

// Campos da estrutura da operação (equipe)
const campoSDR        = document.getElementById('num-sdr');
const campoCloser     = document.getElementById('num-closer');
const campoFinanceiro = document.getElementById('num-financeiro');
const campoSuporte    = document.getElementById('num-suporte');
const campoPosVenda   = document.getElementById('num-posvenda');

// Elementos de resultado
const resultadoEmpresaNome  = document.getElementById('resultado-empresa-nome');
const valRecuperacaoInad    = document.getElementById('val-recuperacao-inad');
const valRetencaoChurn      = document.getElementById('val-retencao-churn');
const valEconomiaCusto      = document.getElementById('val-economia-custo');

// Novos elementos do Redesign 
const valImpactoTotal       = document.getElementById('val-impacto-total');

const compCustoAtual  = document.getElementById('comp-custo-atual');
const compPerdaAtual  = document.getElementById('comp-perda-atual');
const compCustoNovo   = document.getElementById('comp-custo-novo');
const compReceitaNova = document.getElementById('comp-receita-nova');

const cenarioModerado      = document.getElementById('cenario-moderado');
const cenarioIntermediario = document.getElementById('cenario-intermediario');
const cenarioOtimista      = document.getElementById('cenario-otimista');

/* ============================================================
   UTILITÁRIOS
   ============================================================ */

/**
 * Formata um número como moeda brasileira (R$ X.XXX,XX)
 * @param {number} valor
 * @returns {string}
 */
function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

/**
 * Lê o valor de um campo numérico. Retorna 0 se vazio/inválido/negativo.
 * @param {HTMLInputElement} campo
 * @returns {number}
 */
function lerNumero(campo) {
    if (!campo) return 0;
    const valor = parseFloat(campo.value);
    return isNaN(valor) || valor < 0 ? 0 : valor;
}

/**
 * Exibe mensagem de erro abaixo de um campo
 */
function mostrarErro(idErro, mensagem, campo) {
    const el = document.getElementById(idErro);
    if (el) el.textContent = mensagem;
    if (campo) campo.classList.add('error');
}

/**
 * Remove mensagem de erro de um campo
 */
function limparErro(idErro, campo) {
    const el = document.getElementById(idErro);
    if (el) el.textContent = '';
    if (campo) campo.classList.remove('error');
}

/**
 * Aplica máscara de telefone (00) 00000-0000 em tempo real
 */
function mascararTelefone(evento) {
    let valor = evento.target.value.replace(/\D/g, ""); // Remove tudo que não é dígito
    
    // Formatação progressiva
    if (valor.length > 0) {
        valor = "(" + valor;
    }
    if (valor.length > 3) {
        valor = valor.slice(0, 3) + ") " + valor.slice(3);
    }
    if (valor.length > 10) {
        valor = valor.slice(0, 10) + "-" + valor.slice(10, 14);
    }

    evento.target.value = valor;
}

/* ============================================================
   VALIDAÇÃO
   ============================================================ */

/**
 * Valida o formulário de cadastro inicial (Etapa 1)
 * @returns {boolean}
 */
function validarCadastro() {
    let valido = true;

    if (!campoNome.value.trim()) {
        mostrarErro('erro-nome', 'Por favor, informe seu nome completo.', campoNome);
        valido = false;
    } else {
        limparErro('erro-nome', campoNome);
    }

    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!campoEmail.value.trim()) {
        mostrarErro('erro-email', 'Por favor, informe seu e-mail.', campoEmail);
        valido = false;
    } else if (!regexEmail.test(campoEmail.value.trim())) {
        mostrarErro('erro-email', 'Informe um e-mail válido (ex.: nome@empresa.com).', campoEmail);
        valido = false;
    } else {
        limparErro('erro-email', campoEmail);
    }

    if (!campoTelefone.value.trim()) {
        mostrarErro('erro-telefone', 'Por favor, informe seu telefone ou WhatsApp.', campoTelefone);
        valido = false;
    } else if (campoTelefone.value.length < 15) {
        mostrarErro('erro-telefone', 'Informe o telefone completo no padrão (00) 00000-0000.', campoTelefone);
        valido = false;
    } else {
        limparErro('erro-telefone', campoTelefone);
    }

    if (!campoEmpresa.value.trim()) {
        mostrarErro('erro-empresa', 'Por favor, informe o nome da sua empresa.', campoEmpresa);
        valido = false;
    } else {
        limparErro('erro-empresa', campoEmpresa);
    }

    if (!campoCargo.value.trim()) {
        mostrarErro('erro-cargo', 'Por favor, informe o seu cargo.', campoCargo);
        valido = false;
    } else {
        limparErro('erro-cargo', campoCargo);
    }

    if (!campoErp.value) {
        mostrarErro('erro-erp', 'Por favor, selecione o seu ERP atual.', campoErp);
        valido = false;
    } else {
        limparErro('erro-erp', campoErp);
    }

    return valido;
}

/**
 * Valida o formulário operacional (Etapa 2)
 * Verifica campos obrigatórios, valores positivos e percentuais válidos.
 * @returns {boolean}
 */
function validarOperacional() {
    let valido = true;

    // Número de clientes
    if (!campoNumClientes.value || lerNumero(campoNumClientes) <= 0) {
        mostrarErro('erro-num-clientes', 'Informe o número de clientes (valor positivo).', campoNumClientes);
        valido = false;
    } else {
        limparErro('erro-num-clientes', campoNumClientes);
    }

    // Ticket médio
    if (!campoTicketMedio.value || lerNumero(campoTicketMedio) <= 0) {
        mostrarErro('erro-ticket-medio', 'Informe o ticket médio mensal (valor positivo).', campoTicketMedio);
        valido = false;
    } else {
        limparErro('erro-ticket-medio', campoTicketMedio);
    }

    // Inadimplência: 0–100
    if (campoInadimplencia.value === '') {
        mostrarErro('erro-inadimplencia', 'Informe o percentual de inadimplência (0–100).', campoInadimplencia);
        valido = false;
    } else if (lerNumero(campoInadimplencia) < 0 || lerNumero(campoInadimplencia) > 100) {
        mostrarErro('erro-inadimplencia', 'O percentual deve estar entre 0 e 100.', campoInadimplencia);
        valido = false;
    } else {
        limparErro('erro-inadimplencia', campoInadimplencia);
    }

    // Churn (Cancelamento): 0–100
    if (campoChurn.value === '') {
        mostrarErro('erro-churn', 'Informe o percentual de cancelamento mensal (0–100).', campoChurn);
        valido = false;
    } else if (lerNumero(campoChurn) < 0 || lerNumero(campoChurn) > 100) {
        mostrarErro('erro-churn', 'O percentual deve estar entre 0 e 100.', campoChurn);
        valido = false;
    } else {
        limparErro('erro-churn', campoChurn);
    }

    // Campos da equipe — mínimo de 0, mas ao menos 1 pessoa no total
    const camposEquipe = [
        { campo: campoSDR,        id: 'erro-num-sdr',        label: 'número de SDRs' },
        { campo: campoCloser,     id: 'erro-num-closer',     label: 'número de Vendedores' },
        { campo: campoFinanceiro, id: 'erro-num-financeiro', label: 'pessoas no Financeiro' },
        { campo: campoSuporte,    id: 'erro-num-suporte',    label: 'pessoas no Suporte' },
        { campo: campoPosVenda,   id: 'erro-num-posvenda',   label: 'pessoas no Pós-venda' },
    ];

    camposEquipe.forEach(({ campo, id, label }) => {
        if (campo.value === '') {
            mostrarErro(id, `Informe o ${label} (mínimo 0).`, campo);
            valido = false;
        } else if (lerNumero(campo) < 0) {
            mostrarErro(id, 'Não são permitidos valores negativos.', campo);
            valido = false;
        } else {
            limparErro(id, campo);
        }
    });

    return valido;
}

/* ============================================================
   NAVEGAÇÃO ENTRE ETAPAS
   ============================================================ */

function ativarSecao(secaoAtiva) {
    [secaoCadastro, secaoOperacional, secaoResultados].forEach(s => {
        s.classList.add('hidden');
        s.classList.remove('active-form');
    });
    secaoAtiva.classList.remove('hidden');
    secaoAtiva.classList.add('active-form');

    // Mostra a headline e hero completa apenas na Etapa 1
    const heroHeadline = document.getElementById('hero-headline');
    const heroSection  = document.querySelector('.hero-section');
    if (secaoAtiva === secaoCadastro) {
        if (heroHeadline) heroHeadline.style.display = 'block';
        if (heroSection)  heroSection.classList.remove('hero-compact');
    } else {
        if (heroHeadline) heroHeadline.style.display = 'none';
        if (heroSection)  heroSection.classList.add('hero-compact');
    }

    secaoAtiva.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function atualizarStepper(etapa) {
    [step1, step2, step3].forEach(s => s.classList.remove('active', 'completed'));
    [line12, line23].forEach(l => l.classList.remove('active'));

    if (etapa === 1) {
        step1.classList.add('active');
    } else if (etapa === 2) {
        step1.classList.add('completed');
        step2.classList.add('active');
        line12.classList.add('active');
    } else if (etapa === 3) {
        step1.classList.add('completed');
        step2.classList.add('completed');
        step3.classList.add('active');
        line12.classList.add('active');
        line23.classList.add('active');
    }
}

/* ============================================================
   MOTOR DE CÁLCULO
   ============================================================ */

/**
 * Calcula o diagnóstico financeiro com base nos dados fornecidos.
 *
 * Faturamento é derivado automaticamente:
 *   faturamento = numClientes × ticketMedio
 *
 * Custo operacional é calculado pela estrutura da equipe:
 *   custoOperacional = (folhaBruta) × fatorCusto
 *
 * Resultados exibidos:
 *   1. Recuperação de inadimplência (R$)
 *   2. Recuperação de churn (R$)
 *   3. Ganho com novos contratos (R$)
 *   4. Redução percentual do custo operacional (%)
 *   5. Economia mensal (R$)
 */
function calcularDiagnostico() {
    // --- Leitura dos inputs ---
    const numClientes   = lerNumero(campoNumClientes);
    const ticketMedio   = lerNumero(campoTicketMedio);
    const inadimplencia = lerNumero(campoInadimplencia);
    const churn         = lerNumero(campoChurn);
    const numSDR        = lerNumero(campoSDR);
    const numCloser     = lerNumero(campoCloser);
    const numFinanceiro = lerNumero(campoFinanceiro);
    const numSuporte    = lerNumero(campoSuporte);
    const numPosVenda   = lerNumero(campoPosVenda);

    // --- 1. Faturamento (calculado automaticamente) ---
    const faturamento = numClientes * ticketMedio;

    // --- 2. Custo operacional (calculado pela equipe) ---
    const folhaBruta = (numSDR        * salarios.SDR)
                     + (numCloser     * salarios.Closer)
                     + (numFinanceiro * salarios.Financeiro)
                     + (numSuporte    * salarios.Suporte)
                     + (numPosVenda   * salarios.PosVenda);

    const custoOperacional = folhaBruta * fatorCusto;

    const perdaInadimplencia        = faturamento * (inadimplencia / 100);
    const recuperacaoInadimplencia  = perdaInadimplencia * reducaoInadimplencia;
    
    // Calcula a nova taxa de inadimplência (ex: de 12% reduz 40%, cai para 7.2%)
    const novaTaxaInad = inadimplencia - (inadimplencia * reducaoInadimplencia);
    
    // --- 4. Churn ---
    const perdaChurn        = faturamento * (churn / 100);
    const recuperacaoChurn  = perdaChurn * reducaoChurn;

    // --- 5. Redução de custo ---
    const economiaOperacional = custoOperacional * reducaoCustoOperacional;

    // --- 6. Impacto financeiro total (Economia + Churn, excluindo Inadimplência conforme solicitado) ---
    const retornoTotal = recuperacaoChurn + economiaOperacional;

    // --- 8. Comparativo ---
    const perdaAtual = perdaInadimplencia + perdaChurn;
    const custoNovo = custoOperacional - economiaOperacional;

    // --- 9. Cenários ---
    const valModerado = retornoTotal * 0.5;
    const valOtimista = retornoTotal * 1.5;

    // --- Exibição dos valores ---
    resultadoEmpresaNome.textContent = dadosCadastro.empresa;

    valRecuperacaoInad.textContent   = 'Cairá p/ ' + novaTaxaInad.toFixed(1).replace('.', ',') + '%';
    valRetencaoChurn.textContent     = formatarMoeda(recuperacaoChurn);
    valEconomiaCusto.textContent     = formatarMoeda(economiaOperacional);
    
    valImpactoTotal.textContent      = formatarMoeda(retornoTotal);

    compCustoAtual.textContent  = formatarMoeda(custoOperacional);
    compPerdaAtual.textContent  = formatarMoeda(perdaAtual);
    compCustoNovo.textContent   = formatarMoeda(custoNovo);
    compReceitaNova.textContent = formatarMoeda(retornoTotal);

    cenarioModerado.textContent      = formatarMoeda(valModerado);
    cenarioIntermediario.textContent = formatarMoeda(retornoTotal);
    cenarioOtimista.textContent      = formatarMoeda(valOtimista);

    // --- Animação de contagem progressiva ---
    // Passando true no terceiro parâmetro para prefixar "Cairá p/ " e adicionar o "%" ao final
    animarContador(valRecuperacaoInad,   novaTaxaInad, 800, true, 'Cairá p/ '); 
    animarContador(valRetencaoChurn,     recuperacaoChurn);
    animarContador(valEconomiaCusto,     economiaOperacional);
    
    animarContador(valImpactoTotal,      retornoTotal);

    animarContador(compCustoAtual,  custoOperacional);
    animarContador(compPerdaAtual,  perdaAtual);
    animarContador(compCustoNovo,   custoNovo);
    animarContador(compReceitaNova, retornoTotal);

    animarContador(cenarioModerado,      valModerado);
    animarContador(cenarioIntermediario, retornoTotal);
    animarContador(cenarioOtimista,      valOtimista);
}

/**
 * Anima um valor numérico de 0 até o valor final com efeito "contador"
 * @param {HTMLElement} elemento
 * @param {number} valorFinal
 * @param {number} [duracao=800]
 * @param {boolean} [isPercentual=false]
 * @param {string} [prefixo=""]
 */
function animarContador(elemento, valorFinal, duracao = 800, isPercentual = false, prefixo = "") {
    const inicio = performance.now();

    function passo(agora) {
        const decorrido = agora - inicio;
        const progresso = Math.min(decorrido / duracao, 1);
        const progressoSuave = 1 - Math.pow(1 - progresso, 3); // ease-out cúbico

        const valorAtual = valorFinal * progressoSuave;

        if (isPercentual) {
            elemento.textContent = prefixo + valorAtual.toFixed(1).replace('.', ',') + '%';
        } else {
            elemento.textContent = prefixo + formatarMoeda(valorAtual);
        }

        if (progresso < 1) {
            requestAnimationFrame(passo);
        } else {
            if (isPercentual) {
                elemento.textContent = prefixo + valorFinal.toFixed(1).replace('.', ',') + '%';
            } else {
                elemento.textContent = prefixo + formatarMoeda(valorFinal);
            }
        }
    }

    requestAnimationFrame(passo);
}

/* ============================================================
   ANIMAÇÃO DE ANÁLISE DE IA
   Simula o processamento dos dados antes de exibir os resultados
   ============================================================ */

function simulaAnalise() {
    const overlay    = document.getElementById('overlay-analise');
    const barra      = document.getElementById('analise-barra');
    const statusText = document.getElementById('analise-status-text');

    const etapas = [
        { id: 'astep-1', status: 'Calculando custo operacional...',     progresso: 25 },
        { id: 'astep-2', status: 'Mapeando inadimplência...',           progresso: 50 },
        { id: 'astep-3', status: 'Projetando redução de cancelamento...', progresso: 75 },
        { id: 'astep-4', status: 'Estimando crescimento de receita...', progresso: 95 },
    ];

    // Reseta estado inicial
    barra.style.width = '0%';
    statusText.textContent = 'Carregando dados operacionais...';
    etapas.forEach(e => {
        const el = document.getElementById(e.id);
        if (el) el.classList.remove('done');
    });

    overlay.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => { barra.style.width = '8%'; }, 150);

    etapas.forEach((etapa, index) => {
        setTimeout(() => {
            statusText.textContent = etapa.status;
            barra.style.width = etapa.progresso + '%';
            const el = document.getElementById(etapa.id);
            if (el) el.classList.add('done');
        }, (index + 1) * 750);
    });

    const duracaoTotal = (etapas.length + 1) * 750;

    setTimeout(() => {
        statusText.textContent = 'Diagnóstico concluído!';
        barra.style.width = '100%';
    }, duracaoTotal);

    setTimeout(() => {
        overlay.classList.add('hidden');
        calcularDiagnostico();
        ativarSecao(secaoResultados);
        atualizarStepper(3);
    }, duracaoTotal + 500);
}

/* ============================================================
   EVENT LISTENERS
   ============================================================ */

// Etapa 1 → Etapa 2
formCadastro.addEventListener('submit', function(evento) {
    evento.preventDefault();
    if (!validarCadastro()) return;

    dadosCadastro = {
        nome:     campoNome.value.trim(),
        email:    campoEmail.value.trim(),
        telefone: campoTelefone.value.trim(),
        empresa:  campoEmpresa.value.trim(),
        cargo:    campoCargo.value.trim(),
        erp:      campoErp.value
    };

    ativarSecao(secaoOperacional);
    atualizarStepper(2);
});

// Voltar: Etapa 2 → Etapa 1
btnVoltar.addEventListener('click', function() {
    ativarSecao(secaoCadastro);
    atualizarStepper(1);
});

// Etapa 2 → Animação IA → Etapa 3
formOperacional.addEventListener('submit', function(evento) {
    evento.preventDefault();
    if (!validarOperacional()) return;
    simulaAnalise();
});

// Recalcular — volta ao início
btnRecalcular.addEventListener('click', function() {
    formCadastro.reset();
    formOperacional.reset();
    dadosCadastro = { nome: '', email: '', telefone: '', empresa: '', cargo: '', erp: '' };
    ativarSecao(secaoCadastro);
    atualizarStepper(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Agendar Reunião — abre WhatsApp
btnAgendar.addEventListener('click', function() {
    const mensagem = encodeURIComponent(
        `Olá! Sou ${dadosCadastro.nome}, ${dadosCadastro.cargo} da empresa ${dadosCadastro.empresa} (ERP: ${dadosCadastro.erp}). ` +
        `Realizei o Diagnóstico Estratégico da Máquina.ISP e gostaria de agendar uma reunião.`
    );
    window.open(`https://wa.me/5599999999999?text=${mensagem}`, '_blank');
});

/* ============================================================
   LIMPEZA DE ERROS EM TEMPO REAL
   ============================================================ */

// Cadastro
campoNome.addEventListener('input',     () => limparErro('erro-nome', campoNome));
campoEmail.addEventListener('input',    () => limparErro('erro-email', campoEmail));
campoTelefone.addEventListener('input', (e) => {
    mascararTelefone(e);
    limparErro('erro-telefone', campoTelefone);
});
campoEmpresa.addEventListener('input',  () => limparErro('erro-empresa', campoEmpresa));
campoCargo.addEventListener('input',    () => limparErro('erro-cargo', campoCargo));
campoErp.addEventListener('change',     () => limparErro('erro-erp', campoErp));

// Dados do negócio
campoNumClientes.addEventListener('input',   () => limparErro('erro-num-clientes', campoNumClientes));
campoTicketMedio.addEventListener('input',   () => limparErro('erro-ticket-medio', campoTicketMedio));
campoInadimplencia.addEventListener('input', () => limparErro('erro-inadimplencia', campoInadimplencia));
campoChurn.addEventListener('input',         () => limparErro('erro-churn', campoChurn));

// Equipe
campoSDR.addEventListener('input',        () => limparErro('erro-num-sdr', campoSDR));
campoCloser.addEventListener('input',     () => limparErro('erro-num-closer', campoCloser));
campoFinanceiro.addEventListener('input', () => limparErro('erro-num-financeiro', campoFinanceiro));
campoSuporte.addEventListener('input',    () => limparErro('erro-num-suporte', campoSuporte));
campoPosVenda.addEventListener('input',   () => limparErro('erro-num-posvenda', campoPosVenda));


/* ============================================================
   EFEITO NAVBAR AO ROLAR
   ============================================================ */
window.addEventListener('scroll', function() {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 40) {
        navbar.style.background = 'rgba(255, 255, 255, 0.92)';
        navbar.style.boxShadow  = '0 1px 20px rgba(0,0,0,0.06)';
    } else {
        navbar.style.background = 'rgba(255, 255, 255, 0.70)';
        navbar.style.boxShadow  = 'none';
    }
});

/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */
document.addEventListener('DOMContentLoaded', function() {
    ativarSecao(secaoCadastro);
    atualizarStepper(1);
    campoNome.focus();
});
