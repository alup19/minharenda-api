import { PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'

const prisma = new PrismaClient()
const router = Router()

const clienteSchema = z.object({
  nome: z.string().min(3, { message: "Nome deve ter no mínimo 3 caracteres" }),
  notas: z.string().optional().nullable(),
  endereco: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  usuarioId: z.string()
})

function clienteInfosAdicionais(cliente: any) {
  const receitasDoCliente = Array.isArray(cliente.receitas) ? cliente.receitas : []

  const totalGasto = receitasDoCliente.reduce((acumulado: number, receita: any) => {
    const valorDaReceita = receita.valorTotal ?? receita.valor ?? 0
    return acumulado + Number(valorDaReceita)
  }, 0)

  const totalCompras = receitasDoCliente.length

  return {
    ...cliente,
    totalGasto,
    totalCompras,
  }
}

router.get("/", async (req, res) => {
  try {
    const clientes = await prisma.cliente.findMany({
      include: {
        usuario: true,
        receitas: true,
      }
    })

    const clientesComTotais = clientes.map(clienteInfosAdicionais)

    res.status(200).json(clientesComTotais)
  } catch (error) {
    res.status(500).json({ erro: error })
  }
})

router.get("/:usuarioId", async (req, res) => {
  const { usuarioId } = req.params
  try {
    const clientes = await prisma.cliente.findMany({
      include: {
        usuario: true,
        receitas: true,
      },
      where: {
        usuarioId: usuarioId
      }
    })

    const clientesComTotais = clientes.map(clienteInfosAdicionais)

    res.status(200).json(clientesComTotais)
  } catch (error) {
    res.status(500).json({ erro: error })
  }
})

router.post("/", async (req, res) => {
  const valida = clienteSchema.safeParse(req.body)
  if (!valida.success) {
    return res.status(400).json({ erro: valida.error })
  }

  const { nome, notas, endereco, telefone, usuarioId } = valida.data

  try {
    const cliente = await prisma.cliente.create({
      data: { nome, notas, endereco, telefone, usuarioId }
    })
    res.status(201).json(cliente)
  } catch (error) {
    res.status(400).json({ erro: error })
  }
})

router.put("/:id", async (req, res) => {
  const { id } = req.params

  const valida = clienteSchema.safeParse(req.body)
  if (!valida.success) {
    return res.status(400).json({ erro: valida.error })
  }

  const { nome, notas, endereco, telefone, usuarioId } = valida.data

  try {
    const cliente = await prisma.cliente.update({
      where: { id: Number(id) },
      data: { nome, notas, endereco, telefone, usuarioId },
      include: {
        usuario: true,
        receitas: true,
      }
    })

    const clienteComTotais = clienteInfosAdicionais(cliente)

    res.status(200).json(clienteComTotais)
  } catch (error) {
    res.status(400).json({ erro: error })
  }
})

router.delete("/:id", async (req, res) => {
  const { id } = req.params

  try {
    const cliente = await prisma.cliente.delete({
      where: { id: Number(id) }
    })
    res.status(200).json(cliente)
  } catch (error) {
    res.status(400).json({ erro: error })
  }
})

export default router
