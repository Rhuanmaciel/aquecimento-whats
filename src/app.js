const chokidar = require('chokidar');
const request = require('request');
const fs = require('fs').promises;
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

// Função para verificar o status de uma instância e atualizar o CSV
async function verificarStatusEAtualizarCSV(instancia) {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'GET',
            url: `${instancia.api_url}status`,
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
                append: true
            });

            const dadosCSV = [{
                nome: instancia.nome,
                numero: instancia.numero,
                dias_ativos: calcularDiasAtivos(instancia.cadastrado_em),
                status: status.connected ? 'Conectado' : 'Desconectado',
                ultima_atividade: new Date().toISOString(),
                expira_em: expiraEm.toISOString().split('T')[0]
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
            url: `${instancia.api_url}send-text-status`,
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
    const instanciasAquecidas = [];

    // Verifica o status de todas as instâncias e coloca na fila de aquecimento
    for (const instancia of instancias) {
        try {
            const status = await verificarStatusEAtualizarCSV(instancia);
            if (status.connected) {
                instanciasAquecidas.push(instancia);
            }
        } catch (error) {
            console.error(`Erro ao verificar status da instância ${instancia.nome}:`, error);
        }
    }

    // Envia mensagens de aquecimento com atrasos específicos para cada instância
    const promises = instanciasAquecidas.map(instancia => {
        return (async () => {
            for (const outraInstancia of instancias) {
                if (instancia.nome !== outraInstancia.nome) {
                    try {
                        await enviarMensagem(instancia, outraInstancia, 'Mensagem de aquecimento.');
                        // Define um atraso específico para cada instância
                        const delay = Math.floor(Math.random() * 60 * 1000);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    } catch (error) {
                        console.error(`Erro ao enviar mensagem de ${instancia.nome} para ${outraInstancia.nome}:`, error);
                    }
                }
            }
        })();
    });

    // Aguarda todas as promessas serem resolvidas
    await Promise.all(promises);
    console.log('Aquecimento concluído para todas as instâncias.');
}

// Monitorar alterações no arquivo JSON e aquecer contas quando houver mudanças
const watcher = chokidar.watch('instancias.json', { persistent: true });

watcher.on('change', async () => {
    console.log('Arquivo instancias.json alterado. Atualizando...');
    try {
        await aquecerContas();
    } catch (error) {
        console.error('Erro ao aquecer contas:', error);
    }
});

// Função para verificar novas instâncias periodicamente
async function verificarNovasInstancias() {
    let instanciasAnteriores = [];
    try {
        instanciasAnteriores = await lerInstancias();
    } catch (error) {
        console.error('Erro ao ler instâncias:', error);
        return;
    }

    while (true) {
        try {
            const instanciasAtuais = await lerInstancias();
            const novasInstancias = instanciasAtuais.filter(instancia => 
                !instanciasAnteriores.some(antiga => antiga.nome === instancia.nome)
            );

            if (novasInstancias.length > 0) {
                console.log('Novas instâncias detectadas:', novasInstancias);
                await aquecerContas(); // Atualiza com as novas instâncias
            }
            instanciasAnteriores = instanciasAtuais;
        } catch (error) {
            console.error('Erro ao verificar novas instâncias:', error);
        }
        // Espera uma hora antes de verificar novamente
        await new Promise(resolve => setTimeout(resolve, 60 * 60 * 1000));
    }
}

// Iniciar a verificação de novas instâncias
verificarNovasInstancias().catch(console.error);
