const express = require('express');
const whois = require('whois');

const app = express();
app.use(express.json());

function formatDate(dateString) {
    // Verifica se a string de data está no formato esperado
    const datePattern = /^\d{4}-\d{2}-\d{2}/;
    if (datePattern.test(dateString)) {
        const [year, month, day] = dateString.split(/[-T]/);
        return `${day}/${month}/${year}`;
    } else if (/^\d{8}$/.test(dateString)) {
        const year = dateString.slice(0, 4);
        const month = dateString.slice(4, 6);
        const day = dateString.slice(6, 8);
        return `${day}/${month}/${year}`;
    } else {
        return 'Data indisponível';
    }
}

function parseWhoisData(data) {
    let responsavel = 'Informação indisponível';
    let dataExpiracao = 'Data indisponível';
    let registrador = 'Informação indisponível';

    // Verifica se o domínio usa proteção de privacidade
    const privacyProtect = /Privacy Protect/i.test(data);

    // Padrões para extração de informações
    const responsavelPatterns = [
        /responsible:\s*(.*)/i,
        /Registrant Name:\s*(.*)/i
    ];

    const expirationPatterns = [
        /Registrar Registration Expiration Date:\s*(.*)/i,
        /expires:\s*(.*)/i
    ];

    const registrarPatterns = [
        /Registrar:\s*(.*)/i,
        /Registrar Name:\s*(.*)/i
    ];

    responsavelPatterns.some((pattern) => {
        const match = data.match(pattern);
        if (match && !privacyProtect) {
            responsavel = match[1].trim();
            return true;
        }
        return false;
    });

    expirationPatterns.some((pattern) => {
        const match = data.match(pattern);
        if (match) {
            dataExpiracao = formatDate(match[1].trim());
            return true;
        }
        return false;
    });

    registrarPatterns.some((pattern) => {
        const match = data.match(pattern);
        if (match) {
            registrador = match[1].trim();
            return true;
        }
        return false;
    });

    // Se o campo 'responsavel' for 'Informação indisponível', usa o valor de 'registrador'
    const proprietario = responsavel !== 'Informação indisponível' ? responsavel : registrador;

    return { proprietario, dataExpiracao, rawData: data };
}

function consultarWhois(dominio) {
    return new Promise((resolve, reject) => {
        whois.lookup(dominio, (err, data) => {
            if (err) {
                return reject(err);
            }

            const { proprietario, dataExpiracao, rawData } = parseWhoisData(data);

            resolve({
                dominio_registrado: true,
                proprietario,
                data_expiracao: dataExpiracao,
                rawData
            });
        });
    });
}

app.post('/verificar', async (req, res) => {
    const { dominio } = req.body;

    if (!dominio) {
        return res.status(400).json({ erro: "Domínio não fornecido" });
    }

    try {
        const resultado = await consultarWhois(dominio);
        res.json(resultado);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
