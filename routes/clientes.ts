import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

const prisma = new PrismaClient();
const router = Router();

const clienteSchema = z.object({
  nome: z.string().min(3, { message: "Nome deve ter no mínimo 3 caracteres" }),
  notas: z.string().optional().nullable(),
  endereco: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  // no teu schema usuarioId é String (uuid)
  usuarioId: z.string(),
});

function clienteInfosAdicionais(cliente: any) {
  const receitasDoCliente = Array.isArray(cliente.receitas)
    ? cliente.receitas
    : [];

  const totalGasto = receitasDoCliente.reduce(
    (acumulado: number, receita: any) => {
      const valorDaReceita = receita.valorTotal ?? receita.valor ?? 0;
      return acumulado + Number(valorDaReceita);
    },
    0
  );

  const totalCompras = receitasDoCliente.length;

  return {
    ...cliente,
    totalGasto,
    totalCompras,
  };
}

/**
 * GET /clientes
 * Lista todos os clientes (independente de usuário)
 */
router.get("/", async (req, res) => {
  try {
    const clientes = await prisma.cliente.findMany({
      include: {
        usuario: true,
        receitas: {
          include: {
            itens: {
              include: {
                produto: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const clientesComTotais = clientes.map(clienteInfosAdicionais);

    res.status(200).json(clientesComTotais);
  } catch (error) {
    console.error("Erro ao buscar clientes:", error);
    res.status(500).json({ erro: "Erro ao buscar clientes" });
  }
});

/**
 * GET /clientes/dashboard/:usuarioId
 * Dashboard de clientes para um usuário específico
 */
router.get("/dashboard/:usuarioId", async (req, res) => {
  const { usuarioId } = req.params;

  try {
    const clientes = await prisma.cliente.findMany({
      where: { usuarioId },
      include: {
        receitas: {
          include: {
            itens: {
              include: {
                produto: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const clientesComTotais = clientes.map(clienteInfosAdicionais);

    const totalClientes = clientesComTotais.length;
    const totalGastoGeral = clientesComTotais.reduce(
      (acc: number, c: any) => acc + (c.totalGasto ?? 0),
      0
    );
    const totalComprasGeral = clientesComTotais.reduce(
      (acc: number, c: any) => acc + (c.totalCompras ?? 0),
      0
    );

    res.status(200).json({
      totalClientes,
      totalGastoGeral,
      totalComprasGeral,
      clientes: clientesComTotais,
    });
  } catch (error) {
    console.error("Erro ao buscar dashboard de clientes:", error);
    res.status(500).json({ erro: "Erro ao buscar dashboard de clientes" });
  }
});

/**
 * GET /clientes/:usuarioId
 * Lista clientes de um usuário específico
 */
router.get("/:usuarioId", async (req, res) => {
  const { usuarioId } = req.params; // string (uuid)

  try {
    const clientes = await prisma.cliente.findMany({
      where: {
        usuarioId, // aqui é string MESMO, nada de Number()
      },
      include: {
        usuario: true,
        receitas: {
          include: {
            itens: {
              include: {
                produto: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const clientesComTotais = clientes.map(clienteInfosAdicionais);

    res.status(200).json(clientesComTotais);
  } catch (error) {
    console.error("Erro ao buscar clientes por usuário:", error);
    res.status(500).json({ erro: "Erro ao buscar clientes por usuário" });
  }
});

/**
 * POST /clientes
 * Cria um novo cliente
 */
router.post("/", async (req, res) => {
  const parseResult = clienteSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ erro: parseResult.error.flatten() });
  }

  const { nome, notas, endereco, telefone, usuarioId } = parseResult.data;

  try {
    const novoCliente = await prisma.cliente.create({
      data: {
        nome,
        notas: notas ?? null,
        endereco: endereco ?? null,
        telefone: telefone ?? null,
        usuarioId, // string uuid
      },
      include: {
        usuario: true,
        receitas: {
          include: {
            itens: {
              include: {
                produto: true,
              },
            },
          },
        },
      },
    });

    const clienteComTotais = clienteInfosAdicionais(novoCliente);

    res.status(201).json(clienteComTotais);
  } catch (error) {
    console.error("Erro ao criar cliente:", error);
    res.status(400).json({ erro: "Erro ao criar cliente" });
  }
  
});
router.get("/top/10/:usuarioId", async (req, res) => {
  const { usuarioId } = req.params;

  try {
    const clientes = await prisma.cliente.findMany({
      where: { usuarioId },
      include: {
        receitas: {
          include: {
            itens: true,
          },
        },
      },
    });

    const clientesComTotais = clientes.map((cliente) => {
      const totalGasto = cliente.receitas.reduce((acc, receita) => {
        const somaReceita = receita.itens.reduce((soma, item) => {
          return soma + Number(item.subtotal);
        }, 0);
        return acc + somaReceita;
      }, 0);

      return {
        id: cliente.id,
        nome: cliente.nome,
        totalGasto,
      };
    });

    const top10 = clientesComTotais
      .sort((a, b) => b.totalGasto - a.totalGasto)
      .slice(0, 10);

    return res.json(top10);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao listar top 10 clientes" });
  }
});

/**
 * PUT /clientes/:id
 * Atualiza um cliente
 */
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const parseResult = clienteSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ erro: parseResult.error.flatten() });
  }

  const { nome, notas, endereco, telefone, usuarioId } = parseResult.data;

  try {
    const cliente = await prisma.cliente.update({
      where: { id: Number(id) }, // id do cliente é Int (autoincrement)
      data: {
        nome,
        notas: notas ?? null,
        endereco: endereco ?? null,
        telefone: telefone ?? null,
        usuarioId, // continua string
      },
      include: {
        usuario: true,
        receitas: {
          include: {
            itens: {
              include: {
                produto: true,
              },
            },
          },
        },
      },
    });

    const clienteComTotais = clienteInfosAdicionais(cliente);

    res.status(200).json(clienteComTotais);
  } catch (error) {
    console.error("Erro ao atualizar cliente:", error);
    res.status(400).json({ erro: "Erro ao atualizar cliente" });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const cliente = await prisma.cliente.delete({
      where: { id: Number(id) },
    });
    res.status(200).json(cliente);
  } catch (error) {
    console.error("Erro ao excluir cliente:", error);
    res.status(400).json({ erro: "Erro ao excluir cliente" });
  }
});

export default router;
