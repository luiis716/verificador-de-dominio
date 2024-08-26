const express = require('express');
const whois = require('whois');

const app = express();
app.use(express.json());

function formatDate(dateString) {
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

    const privacyProtect = /Privacy Protect/i.test(data);

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

    const proprietario = responsavel !== 'Informação indisponível' ? responsavel : registrador;

    return { proprietario, dataExpiracao, rawData: data };
}

function verificarAviso(dataExpiracao) {
    if (dataExpiracao === 'Data indisponível') return false;

    const [day, month, year] = dataExpiracao.split('/');
    const expirationDate = new Date(`${year}-${month}-${day}`);
    const currentDate = new Date();
    const diffTime = expirationDate - currentDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays <= 7;
}

function consultarWhois(dominio) {
    return new Promise((resolve, reject) => {
        whois.lookup(dominio, (err, data) => {
            if (err) {
                return reject(err);
            }

            const { proprietario, dataExpiracao, rawData } = parseWhoisData(data);
            const aviso = verificarAviso(dataExpiracao);

            resolve({
                dominio_registrado: true,
                proprietario,
                data_expiracao: dataExpiracao,
                aviso,
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
