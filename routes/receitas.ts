import { PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'

const prisma = new PrismaClient()
const router = Router()

const receitaSchema = z.object({
  descricao: z.string().min(2, {
    message: "Nome da descricão deve possuir, no mínimo, 2 caracteres",
  }).optional(),
  valor: z.coerce
    .number()
    .positive({ message: "Valor deve ser positivo" }),
  categoria: z
    .string()
    .min(2, {
      message: "Nome da categoria deve possuir, no mínimo, 2 caracteres",
    })
    .optional(),
  anexo: z.string().url().optional(),
  data: z.coerce.date(),
  clienteId: z.coerce.number().positive().optional(),
  usuarioId: z.string(),
})

const receitaItemSchema = z.object({
  produtoId: z.coerce.number().int().positive(),
  qtdBase: z.coerce.number().positive(),
  precoUnit: z.coerce.number().positive().optional(),
  subtotal: z.coerce.number().positive().optional(),
})

const loteItensSchema = z.object({
  itens: z.array(receitaItemSchema).min(1),
})

router.get("/", async (req, res) => {
  try {
    const receitas = await prisma.receita.findMany({
      include: {
        cliente: true,
        itens: {
          include: {
            produto: true,
          },
        },
      },
    })
    res.status(200).json(receitas)
  } catch (error) {
    res.status(500).json({ erro: error })
  }
})

router.get("/:usuarioId", async (req, res) => {
  const { usuarioId } = req.params

  try {
    const receitas = await prisma.receita.findMany({
      where: { usuarioId },
      orderBy: { data: 'desc' },
      include: {
        cliente: true,
        itens: {
          include: {
            produto: true,
          },
        },
      },
    })
    res.status(200).json(receitas)
  } catch (error) {
    res.status(500).json({ erro: error })
  }
})

router.get("/dashboard/:usuarioId", async (req, res) => {
  const { usuarioId } = req.params;

  try {
    const receitas = await prisma.receita.findMany({
      where: { usuarioId },
      orderBy: { data: "desc" },
      take: 10,
      include: {
        cliente: true,
        itens: {
          include: {
            produto: true,
          },
        },
      },
    });

    res.status(200).json(receitas);
  } catch (error) {
    res.status(500).json({ erro: error });
  }
});

router.post("/", async (req, res) => {
  const valida = receitaSchema.safeParse(req.body)
  if (!valida.success) {
    res.status(400).json({ erro: valida.error })
    return
  }

  const { descricao, valor, anexo, data, categoria, usuarioId, clienteId } =
    valida.data

  try {
    const receita = await prisma.receita.create({
      data: { descricao, valor, anexo, data, categoria, usuarioId, clienteId },
      include: {
        cliente: true,
        itens: {
          include: {
            produto: true,
          },
        },
      },
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

  const { descricao, valor, anexo, data, categoria, usuarioId, clienteId } =
    valida.data

  try {
    const receita = await prisma.receita.update({
      where: { id: Number(id) },
      data: { descricao, valor, anexo, data, categoria, usuarioId, clienteId },
      include: {
        cliente: true,
        itens: {
          include: {
            produto: true,
          },
        },
      },
    })
    res.status(200).json(receita)
  } catch (error) {
    res.status(400).json({ error })
  }
})

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const receitaId = Number(id);

  if (Number.isNaN(receitaId)) {
    return res.status(400).json({ error: "ID inválido" });
  }

  try {
    await prisma.$transaction(async (transacao) => {
      const itens = await transacao.receitaItem.findMany({
        where: { receitaId },
      });

      const mapaPorProduto = new Map<number, number>();

      for (const item of itens) {
        const atual = mapaPorProduto.get(item.produtoId) ?? 0;
        mapaPorProduto.set(item.produtoId, atual + Number(item.qtdBase));
      }

      for (const [produtoId, qtd] of mapaPorProduto.entries()) {
        await transacao.produto.update({
          where: { id: produtoId },
          data: {
            saldoBase: { increment: qtd },
          },
        });
      }

      await transacao.receita.deleteMany({
        where: { id: receitaId },
      });
    });

    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao excluir receita" });
  }
});

router.post("/:id/itens", async (req, res) => {
  const { id } = req.params

  const valida = loteItensSchema.safeParse(req.body)
  if (!valida.success) {
    res.status(400).json({ erro: valida.error })
    return
  }

  const { itens } = valida.data

  try {
    await prisma.receitaItem.createMany({
      data: itens.map((item) => ({
        receitaId: Number(id),
        produtoId: item.produtoId,
        qtdBase: Number(item.qtdBase),
        subtotal: Number(item.subtotal ?? 0),
        precoUnit:
          item.precoUnit == null ? null : Number(item.precoUnit),
      })),
    })

    const receita = await prisma.receita.findUnique({
      where: { id: Number(id) },
      include: {
        cliente: true,
        itens: {
          include: {
            produto: true,
          },
        },
      },
    })

    res.status(201).json(receita)
  } catch (error) {
    res.status(400).json({ erro: error })
  }
})

export default router
