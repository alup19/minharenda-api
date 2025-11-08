import { PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { TipoMovimento } from '@prisma/client'
import { OrigemMovimento } from '@prisma/client'

const prisma = new PrismaClient()

const router = Router()

const estoqueSchema = z.object({
  origem: z.nativeEnum(OrigemMovimento).optional(),
  origemId: z.number().optional(),
  tipo: z.nativeEnum(TipoMovimento),
  total: z.number().positive({ message: "Valor total deve ser positivo"}),
  data: z.date(),
  anexo: z.string().url().optional(), // links, não especifica .png/jpg
  usuarioId: z.string()
})

router.get("/", async (req, res) => {
  try {
    const estoques = await prisma.estoqueMovimento.findMany()
    res.status(200).json(estoques)
  } catch (error) {
    res.status(500).json({ erro: error })
  }
})

router.post("/", async (req, res) => {

  const valida = estoqueSchema.safeParse(req.body)
  if (!valida.success) {
    res.status(400).json({ erro: valida.error })
    return
  }

  const { origem, origemId, tipo, total, data, anexo } = valida.data

  try {
    const estoque = await prisma.estoqueMovimento.create({
      data: { origem, origemId, tipo, total, data, anexo }
    })
    res.status(201).json(estoque)
  } catch (error) {
    res.status(400).json({ error })
  }
})

router.put("/:id", async (req, res) => {
    const { id } = req.params
    
    const valida = estoqueSchema.safeParse(req.body)
    if (!valida.success) {
        res.status(400).json({ erro: valida.error })
        return
    }
    
    const { origem, origemId, tipo, total, data, anexo } = valida.data
    
    try {
        const estoque = await prisma.estoqueMovimento.update({
            where: { id: Number(id) },
            data: { origem, origemId, tipo, total, data, anexo }
        })
    res.status(200).json(estoque)
} catch (error) {
    res.status(400).json({ error })
}
})

router.delete("/:id", async (req, res) => {
  const { id } = req.params

  try {
    const estoque = await prisma.estoqueMovimento.delete({
      where: { id: Number(id) }
    })
    res.status(200).json(estoque)
  } catch (error) {
    res.status(400).json({ erro: error })
  }
})
export default router
