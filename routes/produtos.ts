import { Router } from "express";
import { PrismaClient, Unidade, Categoria_Estoque } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();
const router = Router();

const criarProdutoSchema = z.object({
  nome: z.string().min(2, { message: "Nome deve ter pelo menos 2 caracteres" }),
  unidadeBase: z.nativeEnum(Unidade),
  usuarioId: z.string(),
  categoria: z.nativeEnum(Categoria_Estoque).optional().nullable(),
});

const atualizarProdutoSchema = z.object({
  nome: z.string().min(2).optional(),
  categoria: z.nativeEnum(Categoria_Estoque).optional().nullable(),
  saldoBase: z.coerce.number().optional(),
  custoMedio: z.coerce.number().optional(),
  anexo: z.string().url().optional().nullable(),
  data: z.coerce.date().optional(),
  ativo: z.boolean().optional(),
});

function formatarProdutoParaExibicao(produto: any) {
  let unidadeDisplay = "un";
  let saldoDisplay = Number(produto.saldoBase ?? 0);
  let precoMedioDisplay = Number(produto.custoMedio ?? 0);

  // Conversão de gramas pra KG (preço e quantidade estoque).
  if (produto.unidadeBase === "G") {
    unidadeDisplay = "kg";
    saldoDisplay = Number((saldoDisplay / 1000).toFixed(3));
    precoMedioDisplay = Number((precoMedioDisplay * 1000).toFixed(6));
  }
  // Conversão de milimitros pra L (preço e quantidade estoque).
  else if (produto.unidadeBase === "ML") {
    unidadeDisplay = "L";
    saldoDisplay = Number((saldoDisplay / 1000).toFixed(3));
    precoMedioDisplay = Number((precoMedioDisplay * 1000).toFixed(6));
  }
  else {
    unidadeDisplay = "un";
  }

  return {
    ...produto,
    saldoDisplay,
    unidadeDisplay,
    precoMedioDisplay,
  };
}

router.get("/:usuarioId", async (req, res) => {
  const { usuarioId } = req.params;

  try {
    const produtos = await prisma.produto.findMany({
      where: {
        usuarioId,
        ativo: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const produtosFormatados = produtos.map(formatarProdutoParaExibicao);

    res.json(produtosFormatados);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao listar produtos" });
  }
});

router.get("/top/10/:usuarioId", async (req, res) => {
  const { usuarioId } = req.params;

  try {
    const itensVendidos = await prisma.receitaItem.groupBy({
      by: ["produtoId"],
      where: {
        receita: {
          usuarioId,
        },
      },
      _count: {
        produtoId: true,
      },
      orderBy: {
        _count: { produtoId: "desc" },
      },
      take: 10,
    });

    const idsVendidos = itensVendidos.map((i) => i.produtoId);

    const produtosVendidos = await prisma.produto.findMany({
      where: { id: { in: idsVendidos } },
    });

    const topVendidos = itensVendidos.map((i) => {
      const prod = produtosVendidos.find((p) => p.id === i.produtoId);
      return {
        ...prod,
        totalVendido: i._count.produtoId,
      };
    });

    const produtosSemVendas = await prisma.produto.findMany({
      where: {
        usuarioId,
        id: { notIn: idsVendidos },
        ativo: true,
      },
      take: 10 - topVendidos.length,
      orderBy: { createdAt: "desc" },
    });

    const restantes = produtosSemVendas.map((p) => ({
      ...p,
      totalVendido: 0,
    }));

    const resposta = [...topVendidos, ...restantes];

    res.json(resposta);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao listar top produtos" });
  }
});

router.post("/", async (req, res) => {
  try {
    const dadosValidados = criarProdutoSchema.parse(req.body);

    const novoProduto = await prisma.produto.create({
      data: {
        nome: dadosValidados.nome,
        unidadeBase: dadosValidados.unidadeBase,
        usuarioId: dadosValidados.usuarioId,
        categoria: dadosValidados.categoria ?? null,
        saldoBase: 0,
        custoMedio: 0,  
        ativo: true,
      },
    });

    res.status(201).json(formatarProdutoParaExibicao(novoProduto));
  } catch (erro: any) {
    console.error(erro);

    if (erro instanceof z.ZodError) {
      return res
        .status(400)
        .json({ erro: "Dados inválidos", detalhes: erro.errors });
    }

    res.status(500).json({ erro: "Erro ao criar produto" });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const corpoValido = atualizarProdutoSchema.parse(req.body);

    const dadosAtualizacao: any = {};

    if (typeof corpoValido.nome !== "undefined") {
      dadosAtualizacao.nome = corpoValido.nome;
    }

    if (typeof corpoValido.categoria !== "undefined") {
      dadosAtualizacao.categoria = corpoValido.categoria;
    }

    if (typeof corpoValido.saldoBase !== "undefined") {
      dadosAtualizacao.saldoBase = corpoValido.saldoBase;
    }

    if (typeof corpoValido.custoMedio !== "undefined") {
      dadosAtualizacao.custoMedio = corpoValido.custoMedio;
    }

    if (typeof corpoValido.anexo !== "undefined") {
      dadosAtualizacao.anexo = corpoValido.anexo;
    }

    if (typeof corpoValido.data !== "undefined") {
      dadosAtualizacao.data = corpoValido.data;
    }

    if (typeof corpoValido.ativo !== "undefined") {
      dadosAtualizacao.ativo = corpoValido.ativo;
    }

    const produtoAtualizado = await prisma.produto.update({
      where: { id: Number(id) },
      data: dadosAtualizacao,
    });

    res.json(formatarProdutoParaExibicao(produtoAtualizado));
  } catch (erro: any) {
    console.error(erro);

    if (erro instanceof z.ZodError) {
      return res
        .status(400)
        .json({ erro: "Dados inválidos", detalhes: erro.errors });
    }

    res.status(500).json({ erro: "Erro ao atualizar produto" });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const produtoExcluido = await prisma.produto.delete({
      where: { id: Number(id) },
    });

    res.json(produtoExcluido);
  } catch (erro: any) {
    console.error(erro);

    if (erro.code === "P2003") {
      return res.status(400).json({
        erro: "Erro ao excluir",
        detail:
          "Não é possível excluir este produto porque ele já foi usado em receitas/vendas.",
      });
    }

    res.status(500).json({ erro: "Erro ao excluir produto" });
  }
});

export default router;
