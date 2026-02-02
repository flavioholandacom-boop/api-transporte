require('dotenv').config()
const express = require('express')
const cors = require('cors')

const app = express()

app.use(cors())
app.use(express.json())

// Banco de dados temporário (em memória)
let viagens = []
let idCounter = 1 // para gerar IDs automáticos

// ➕ ADICIONAR VIAGEM (POST)
app.post('/viagens', (req, res) => {
    const { motorista, placa, origem, destino, data, combustivel, pedagio, frete } = req.body

    if (!motorista || !placa || !origem || !destino || !data || !combustivel || !pedagio || !frete) {
        return res.status(400).json({ erro: 'Todos os campos são obrigatórios' })
    }

    const viagem = {
        id: idCounter++,
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

// ➕ LISTAR TODAS AS VIAGENS (GET)
app.get('/viagens', (req, res) => {
    res.json(viagens)
})

// 📅 RELATÓRIO POR DIA
app.get('/relatorio/dia', (req, res) => {
    const { data } = req.query
    if (!data) return res.status(400).json({ erro: 'Data é obrigatória (YYYY-MM-DD)' })

    const viagensDia = viagens.filter(v => v.data === data)
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

// 📆 RELATÓRIO POR MÊS
app.get('/relatorio/mes', (req, res) => {
    const { mes, ano } = req.query
    if (!mes || !ano) return res.status(400).json({ erro: 'Mes e ano são obrigatórios' })

    const viagensMes = viagens.filter(v => {
        const d = new Date(v.data)
        return d.getFullYear() === parseInt(ano) && (d.getMonth() + 1) === parseInt(mes)
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

// ROTA PRINCIPAL
app.get('/', (req, res) => {
  res.json({ status: 'Api2 Transporte rodando' })
})

// ✅ PORTA DINÂMICA
const PORT = process.env.PORT || 3002
app.listen(PORT, () => {
  console.log('Api2 rodando na porta', PORT)
})
