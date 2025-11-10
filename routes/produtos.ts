import { PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { Unidade } from '@prisma/client'

const prisma = new PrismaClient()

const router = Router()

const produtoSchema = z.object({
  nome: z.string(),
  unidadeBase: z.nativeEnum(Unidade),
  categoria: z.string().min(2,
    { message: "Nome da categoria deve possuir, no mínimo, 2 caracteres" }).optional(),
  anexo: z.string().url().optional(),
  data: z.string().date().optional(),
  usuarioId: z.string()
})

router.get("/", async (req, res) => {
  try {
    const produtos = await prisma.produto.findMany()
    res.status(200).json(produtos)
  } catch (error) {
    res.status(500).json({ erro: error })
  }
})

router.post("/", async (req, res) => {

  const valida = produtoSchema.safeParse(req.body)
  if (!valida.success) {
    res.status(400).json({ erro: valida.error })
    return
  }

  const { nome, unidadeBase, categoria, anexo, data, usuarioId } = valida.data

  try {
    const produto = await prisma.produto.create({
      data: { nome, unidadeBase, categoria, anexo, data, usuarioId }
    })
    res.status(201).json(produto)
  } catch (error) {
    res.status(400).json({ error })
  }
})

router.put("/:id", async (req, res) => {
  const { id } = req.params

  const valida = produtoSchema.safeParse(req.body)
  if (!valida.success) {
    res.status(400).json({ erro: valida.error })
    return
  }

  const { nome, unidadeBase, categoria, anexo, data, usuarioId } = valida.data

  try {
    const produto = await prisma.produto.update({
      where: { id: Number(id) },
      data: { nome, unidadeBase, categoria, anexo, data, usuarioId }
    })
    res.status(200).json(produto)
  } catch (error) {
    res.status(400).json({ error })
  }
})

router.delete("/:id", async (req, res) => {
  const { id } = req.params

  try {
    const produto = await prisma.produto.delete({
      where: { id: Number(id) }
    })
    res.status(200).json(produto)
  } catch (error) {
    res.status(400).json({ erro: error })
  }
})
export default router
