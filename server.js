require('dotenv').config()
const express = require('express')
const cors = require('cors')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const ExcelJS = require('exceljs')

const app = express()
app.use(cors())
app.use(express.json())

// ----------------------------
// Configuração JWT
// ----------------------------
const JWT_SECRET = process.env.JWT_SECRET || "segredo123"

// ----------------------------
// Armazenamento temporário
// ----------------------------
let users = []         // Usuários
let userIdCounter = 1
let viagens = []       // Viagens
let idCounter = 1      // IDs automáticos de viagens

// ----------------------------
// Middleware de autenticação
// ----------------------------
function autenticar(req, res, next) {
    const authHeader = req.headers['authorization']
    if (!authHeader) return res.status(401).json({ erro: "Token não fornecido" })

    const token = authHeader.split(' ')[1] // Bearer <token>
    if (!token) return res.status(401).json({ erro: "Token inválido" })

    try {
        const payload = jwt.verify(token, JWT_SECRET)
        req.userId = payload.userId
        next()
    } catch (err) {
        return res.status(401).json({ erro: "Token inválido ou expirado" })
    }
}

// ----------------------------
// Rotas de usuários
// ----------------------------

// Registrar usuário
app.post('/register', async (req, res) => {
    const { nome, email, senha } = req.body
    if (!nome || !email || !senha) return res.status(400).json({ erro: "Todos os campos são obrigatórios" })

    const userExist = users.find(u => u.email === email)
    if (userExist) return res.status(400).json({ erro: "Email já cadastrado" })

    const senhaHash = await bcrypt.hash(senha, 10)
    const user = { id: userIdCounter++, nome, email, senhaHash }
    users.push(user)

    res.json({ mensagem: "Usuário registrado com sucesso", userId: user.id })
})

// Login
app.post('/login', async (req, res) => {
    const { email, senha } = req.body
    if (!email || !senha) return res.status(400).json({ erro: "Email e senha são obrigatórios" })

    const user = users.find(u => u.email === email)
    if (!user) return res.status(401).json({ erro: "Email ou senha inválidos" })

    const senhaValida = await bcrypt.compare(senha, user.senhaHash)
    if (!senhaValida) return res.status(401).json({ erro: "Email ou senha inválidos" })

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '2h' })
    res.json({ mensagem: "Login bem-sucedido", token })
})

// ----------------------------
// Rotas de viagens (protegidas)
// ----------------------------

// Adicionar viagem
app.post('/viagens', autenticar, (req, res) => {
    const { motorista, placa, origem, destino, data, combustivel, pedagio, frete } = req.body
    if (!motorista || !placa || !origem || !destino || !data || !combustivel || !pedagio || !frete) {
        return res.status(400).json({ erro: 'Todos os campos são obrigatórios' })
    }

    const viagem = {
        id: idCounter++,
        userId: req.userId,
        motorista,
        placa,
        origem,
        destino,
        data,
        combustivel,
        pedagio,
        frete
    }

    viagens.push(viagem)
    res.json({ mensagem: 'Viagem adicionada', viagem })
})

// Listar todas as viagens do usuário
app.get('/viagens', autenticar, (req, res) => {
    const minhasViagens = viagens.filter(v => v.userId === req.userId)
    res.json(minhasViagens)
})

// ----------------------------
// Relatórios (protegidos)
// ----------------------------

// Relatório diário
app.get('/relatorio/dia', autenticar, (req, res) => {
    const { data } = req.query
    if (!data) return res.status(400).json({ erro: 'Data é obrigatória (YYYY-MM-DD)' })

    const viagensDia = viagens.filter(v => v.userId === req.userId && v.data === data)
    const totalCombustivel = viagensDia.reduce((acc, v) => acc + v.combustivel, 0)
    const totalPedagio = viagensDia.reduce((acc, v) => acc + v.pedagio, 0)
    const totalFrete = viagensDia.reduce((acc, v) => acc + v.frete, 0)
    const lucro = totalFrete - (totalCombustivel + totalPedagio)

    res.json({
        data,
        totalViagens: viagensDia.length,
        totalCombustivel,
        totalPedagio,
        totalFrete,
        lucro
    })
})

// Relatório mensal
app.get('/relatorio/mes', autenticar, (req, res) => {
    const { mes, ano } = req.query
    if (!mes || !ano) return res.status(400).json({ erro: 'Mes e ano são obrigatórios' })

    const viagensMes = viagens.filter(v => {
        const d = new Date(v.data)
        return v.userId === req.userId && d.getFullYear() === parseInt(ano) && (d.getMonth() + 1) === parseInt(mes)
    })

    const totalCombustivel = viagensMes.reduce((acc, v) => acc + v.combustivel, 0)
    const totalPedagio = viagensMes.reduce((acc, v) => acc + v.pedagio, 0)
    const totalFrete = viagensMes.reduce((acc, v) => acc + v.frete, 0)
    const lucro = totalFrete - (totalCombustivel + totalPedagio)

    res.json({
        mes,
        ano,
        totalViagens: viagensMes.length,
        totalCombustivel,
        totalPedagio,
        totalFrete,
        lucro
    })
})

// ----------------------------
// Gerar planilha individual (exemplo)
// ----------------------------
app.get('/planilha', autenticar, async (req, res) => {
    const minhasViagens = viagens.filter(v => v.userId === req.userId)
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Viagens')

    sheet.columns = [
        { header: 'Motorista', key: 'motorista' },
        { header: 'Placa', key: 'placa' },
        { header: 'Origem', key: 'origem' },
        { header: 'Destino', key: 'destino' },
        { header: 'Data', key: 'data' },
        { header: 'Combustível', key: 'combustivel' },
        { header: 'Pedágio', key: 'pedagio' },
        { header: 'Frete', key: 'frete' }
    ]

    sheet.addRows(minhasViagens)

    res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
        'Content-Disposition',
        `attachment; filename=viagens_usuario_${req.userId}.xlsx`
    )

    await workbook.xlsx.write(res)
    res.end()
})

// ----------------------------
// Rota principal
// ----------------------------
app.get('/', (req, res) => {
    res.json({ status: 'API-Transporte rodando' })
})

// ----------------------------
// Iniciar servidor
// ----------------------------
const PORT = process.env.PORT || 3002
app.listen(PORT, () => {
    console.log('API-Transporte rodando na porta', PORT)
})
