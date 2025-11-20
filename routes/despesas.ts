import { PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'

const prisma = new PrismaClient()
const router = Router()

const despesaSchema = z.object({
  descricao: z.string().min(2, {
    message: "Nome da descrição deve possuir, no mínimo, 2 caracteres",
  }),
  valor: z.coerce
    .number()
    .positive({ message: "Valor deve ser positivo" }),
  categoria: z
    .string()
    .min(2, { message: "Nome da categoria deve possuir, no mínimo, 2 caracteres" })
    .optional()
    .or(z.literal("")),
  anexo: z
    .string()
    .url()
    .optional()
    .or(z.literal("")),
  data: z.coerce.date(),
  usuarioId: z.string(),
})


router.get("/", async (req, res) => {
  try {
    const despesas = await prisma.despesa.findMany()
    res.status(200).json(despesas)
  } catch (error) {
    res.status(500).json({ erro: error })
  }
})

router.get("/:usuarioId", async (req, res) => {
  const { usuarioId } = req.params
  try {
    const despesas = await prisma.despesa.findMany({
      where: { usuarioId },
      orderBy: { createdAt: 'desc' }
    })
    res.status(200).json(despesas)
  } catch (error) {
    res.status(500).json({ erro: error })
  }
})

router.get("/dashboard/:usuarioId", async (req, res) => {
  const { usuarioId } = req.params;

  try {
    const despesas = await prisma.despesa.findMany({
      where: { usuarioId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    res.status(200).json(despesas);
  } catch (error) {
    res.status(500).json({ erro: error });
  }
});

router.post("/", async (req, res) => {
  const valida = despesaSchema.safeParse(req.body)
  if (!valida.success) {
    return res.status(400).json({ erro: valida.error })
  }

  const { categoria, anexo, ...resto } = valida.data

  const dadosFormatados = {
    ...resto,
    categoria: categoria && categoria.trim() !== "" ? categoria : undefined,
    anexo: anexo && anexo.trim() !== "" ? anexo : undefined,
  }

  try {
    const despesa = await prisma.despesa.create({
      data: dadosFormatados,
    })
    res.status(201).json(despesa)
  } catch (error) {
    res.status(400).json({ error })
  }
})

router.put("/:id", async (req, res) => {
  const { id } = req.params

  const valida = despesaSchema.safeParse(req.body)
  if (!valida.success) {
    return res.status(400).json({ erro: valida.error })
  }

  const { categoria, anexo, ...resto } = valida.data

  const dadosFormatados = {
    ...resto,
    categoria: categoria && categoria.trim() !== "" ? categoria : undefined,
    anexo: anexo && anexo.trim() !== "" ? anexo : undefined,
  }

  try {
    const despesa = await prisma.despesa.update({
      where: { id: Number(id) },
      data: dadosFormatados,
    })
    res.status(200).json(despesa)
  } catch (error) {
    res.status(400).json({ error })
  }
})

router.delete("/:id", async (req, res) => {
  const { id } = req.params

  try {
    const despesa = await prisma.despesa.delete({
      where: { id: Number(id) },
    })
    res.status(200).json(despesa)
  } catch (error) {
    res.status(400).json({ erro: error })
  }
})

export default router
