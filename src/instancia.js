const fs = require('fs');
const readline = require('readline');

// Função para solicitar dados ao usuário
function solicitarDados() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question('URL da API: ', (apiUrl) => {
            rl.question('Token de Segurança: ', (token) => {
                rl.question('Nome da Instância: ', (nome) => {
                    rl.question('Número do WhatsApp: ', (numero) => {
                        const dataCadastro = new Date().toISOString();

                        const novaInstancia = {
                            nome: nome,
                            api_url: apiUrl,
                            token: token,
                            numero: numero,
                            cadastrado_em: dataCadastro
                        };

                        // Ler instâncias existentes
                        const rawData = fs.readFileSync('instancias.json');
                        const instancias = JSON.parse(rawData);

                        // Verificar se a instância já existe
                        const existeInstancia = instancias.some(instancia => instancia.nome === nome);

                        if (existeInstancia) {
                            console.log('Instância já existe.');
                        } else {
                            instancias.push(novaInstancia);
                            fs.writeFileSync('instancias.json', JSON.stringify(instancias, null, 2));
                            console.log('Instância adicionada ao JSON.');
                        }

                        rl.close();
                        resolve();
                    });
                });
            });
        });
    });
}

// Executar função de solicitação de dados
solicitarDados().catch(console.error);
