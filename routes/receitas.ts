import { PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'

const prisma = new PrismaClient()

const router = Router()

const receitaSchema = z.object({
    descricao: z.string().min(2,
        { message: "Nome da descricão deve possuir, no mínimo, 2 caracteres" }),
    valor: z.number().positive({ message: "Valor deve ser positivo"}),
    anexo: z.string().url().optional(), // links, não especifica .png/jpg
    categoria: z.string().min(2,
        { message: "Nome da categoria deve possuir, no mínimo, 2 caracteres" }).optional(),
    usuarioId: z.string(),
    clienteId: z.number().positive({ message: "ID deve ser um valor positivo"}).optional(),
})

router.get("/", async (req, res) => {
  try {
    const receitas = await prisma.receita.findMany({
      include: { cliente: true }
    })
    res.status(200).json(receitas)
  } catch (error) {
    res.status(500).json({ erro: error })
  }
})

router.post("/", async (req, res) => {

  const valida = receitaSchema.safeParse(req.body)
  if (!valida.success) {
    res.status(400).json({ erro: valida.error })
    return
  }

  const { descricao, valor, anexo, categoria, usuarioId, clienteId } = valida.data

  try {
    const receita = await prisma.receita.create({
      data: { descricao, valor, anexo, categoria, usuarioId, clienteId }
    })
    res.status(201).json(receita)
  } catch (error) {
    res.status(400).json({ error })
  }
})

router.put("/:id", async (req, res) => {
    const { id } = req.params
    
    const valida = receitaSchema.safeParse(req.body)
    if (!valida.success) {
        res.status(400).json({ erro: valida.error })
        return
    }
    
    const { descricao, valor, anexo, categoria, usuarioId, clienteId } = valida.data
    
    try {
        const receita = await prisma.receita.update({
            where: { id: Number(id) },
            data: { descricao, valor, anexo, categoria, usuarioId, clienteId }
        })
    res.status(200).json(receita)
} catch (error) {
    res.status(400).json({ error })
}
})

router.delete("/:id", async (req, res) => {
  const { id } = req.params

  try {
    const receita = await prisma.receita.delete({
      where: { id: Number(id) }
    })
    res.status(200).json(receita)
  } catch (error) {
    res.status(400).json({ erro: error })
  }
})
export default router
