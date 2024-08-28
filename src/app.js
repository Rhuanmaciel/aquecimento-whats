const request = require('request');
const fs = require('fs').promises; // Utiliza fs.promises para operações assíncronas
const path = require('path');
const csvWriter = require('csv-writer').createObjectCsvWriter;

// Função para ler o JSON de instâncias de forma assíncrona
async function lerInstancias() {
    const rawData = await fs.readFile('instancias.json');
    return JSON.parse(rawData);
}

// Função para calcular dias ativos
function calcularDiasAtivos(dataCadastro) {
    const hoje = new Date();
    const dataCadastroDate = new Date(dataCadastro);
    return Math.floor((hoje - dataCadastroDate) / (1000 * 60 * 60 * 24));
}

// Função para atualizar o JSON com uma nova instância
async function atualizarInstancias(instancias) {
    const jsonPath = path.resolve(__dirname, 'instancias.json');
    await fs.writeFile(jsonPath, JSON.stringify(instancias, null, 2));
}

// Função para verificar o status de uma instância e atualizar o CSV
async function verificarStatusEAtualizarCSV(instancia) {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'GET',
            url: `${instancia.api_url}status`, // URL para status
            headers: {
                accept: 'application/json',
                'client-token': instancia.token
            }
        };

        request(options, function (error, response, body) {
            if (error) return reject(error);
            const status = JSON.parse(body);
            console.log(`Status da Instância ${instancia.nome}:`, status);

            const dataCadastro = new Date(instancia.cadastrado_em);
            const expiraEm = new Date(dataCadastro);
            expiraEm.setDate(expiraEm.getDate() + 2);

            const csvPath = path.resolve(__dirname, 'instancias.csv');
            const writer = csvWriter({
                path: csvPath,
                header: [
                    {id: 'nome', title: 'Nome da Instância'},
                    {id: 'numero', title: 'Número'},
                    {id: 'dias_ativos', title: 'Dias Ativos'},
                    {id: 'status', title: 'Status de Conexão'},
                    {id: 'ultima_atividade', title: 'Última Atividade'},
                    {id: 'expira_em', title: 'Expira em'}
                ],
                append: true // Adiciona aos dados existentes
            });

            const dadosCSV = [{
                nome: instancia.nome,
                numero: instancia.numero,
                dias_ativos: calcularDiasAtivos(instancia.cadastrado_em),
                status: status.connected ? 'Conectado' : 'Desconectado',
                ultima_atividade: new Date().toISOString(),
                expira_em: expiraEm.toISOString().split('T')[0] // Apenas a data no formato YYYY-MM-DD
            }];

            writer.writeRecords(dadosCSV).then(() => {
                console.log(`Dados da instância ${instancia.nome} atualizados no CSV.`);
                resolve(status);
            }).catch(reject);
        });
    });
}

// Função para enviar mensagens
function enviarMensagem(instancia, destinatario, mensagem) {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'POST',
            url: `${instancia.api_url}send-text-status`, // URL para enviar mensagens
            headers: {
                'content-type': 'application/json',
                'client-token': instancia.token
            },
            body: {
                phone: destinatario.numero,
                message: mensagem
            },
            json: true
        };

        request(options, function (error, response, body) {
            if (error) return reject(error);
            console.log(`Mensagem enviada de ${instancia.nome} para ${destinatario.nome}:`, body);
            resolve(body);
        });
    });
}

// Função para aquecer as contas
async function aquecerContas() {
    const instancias = await lerInstancias();

    // Verificar status e atualizar CSV para todas as instâncias
    for (const instancia of instancias) {
        await verificarStatusEAtualizarCSV(instancia);
    }

    // Enviar mensagens entre instâncias
    for (const instancia of instancias) {
        const status = await verificarStatusEAtualizarCSV(instancia);
        if (status.connected) {
            for (const outraInstancia of instancias) {
                if (instancia.nome !== outraInstancia.nome) {
                    await enviarMensagem(instancia, outraInstancia, 'Mensagem de aquecimento.');
                    const delay = Math.floor(Math.random() * 60 * 1000); // Delay randômico entre 0 e 60 segundos
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
    }
}

// Verificação de status e aquecimento contínuo
async function iniciarAquecimento() {
    while (true) {
        await aquecerContas();
        await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000)); // Espera de 5 minutos
    }
}

// Iniciar o processo de aquecimento
iniciarAquecimento().catch(console.error);
