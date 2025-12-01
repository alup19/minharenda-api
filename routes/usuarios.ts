import { PrismaClient } from '@prisma/client'
import { Router } from 'express'
import bcrypt from 'bcrypt'
import { z } from 'zod'

const prisma = new PrismaClient()
const router = Router()

const usuarioSchema = z.object({
  nome: z.string().min(3, { message: "Nome deve possuir, no mínimo, 3 caracteres" }),
  email: z.string().email({ message: "E-mail inválido" }).min(10, { message: "E-mail muito curto" }),
  senha: z.string().min(6, { message: "Senha deve possuir no mínimo 6 caracteres" }),
  cpf: z.string().min(11).max(11, { message: "CPF deve conter 11 dígitos (somente números)" }),
  celular: z.string().min(11).max(11, { message: "Celular deve conter 11 dígitos (somente números)" })
})

function validaSenha(senha: string): string[] {
  const erros: string[] = []

  if (senha.length < 8) {
    erros.push("A senha deve possuir, no mínimo, 8 caracteres")
  }

  let minusculas = 0, maiusculas = 0, numeros = 0, simbolos = 0

  for (const char of senha) {
    if (/[a-z]/.test(char)) minusculas++
    else if (/[A-Z]/.test(char)) maiusculas++
    else if (/[0-9]/.test(char)) numeros++
    else simbolos++
  }

  if (minusculas === 0) erros.push("A senha deve possuir letra(s) minúscula(s)")
  if (maiusculas === 0) erros.push("A senha deve possuir letra(s) maiúscula(s)")
  if (numeros === 0) erros.push("A senha deve possuir número(s)")
  if (simbolos === 0) erros.push("A senha deve possuir símbolo(s)")

  return erros
}

function formatarProdutoParaExibicao(produto: any) {
  let unidadeDisplay = "un";
  let saldoDisplay = Number(produto.saldoBase ?? 0);

  if (produto.unidadeBase === "G") {
    unidadeDisplay = "kg";
    saldoDisplay = Number((saldoDisplay / 1000));
  }
  else if (produto.unidadeBase === "ML") {
    unidadeDisplay = "L";
    saldoDisplay = Number((saldoDisplay / 1000));
  }
  else {
    unidadeDisplay = "un";
  }

  return {
    ...produto,
    saldoDisplay,
    unidadeDisplay,
  };
}

router.get("/", async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany()
    res.status(200).json(usuarios)
  } catch (error) {
    res.status(500).json({ erro: error })
  }
})

router.get("/:id", async (req, res) => {
  const { id } = req.params
  try {
    const usuarios = await prisma.usuario.findUnique({
      where: { id }
    })
    res.status(200).json(usuarios)
  } catch (error) {
    res.status(400).json(error)
  }
})

router.post("/", async (req, res) => {
  const valida = usuarioSchema.safeParse(req.body)
  if (!valida.success) {
    return res.status(400).json({ erro: valida.error })
  }

  const { nome, email, senha, cpf, celular } = valida.data

  const errosSenha = validaSenha(senha)
  if (errosSenha.length > 0) {
    return res.status(400).json({ erro: errosSenha })
  }

  const salt = bcrypt.genSaltSync(12)
  const senhaCriptografada = bcrypt.hashSync(senha, salt)

  try {
    const usuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senha: senhaCriptografada,
        cpf,
        celular
      }
    })
    res.status(201).json(usuario)
  } catch (error) {
    res.status(400).json({ error })
  }
})

router.put("/:id", async (req, res) => {
  const { id } = req.params

  const valida = usuarioSchema.safeParse(req.body)
  if (!valida.success) {
    return res.status(400).json({ erro: valida.error })
  }

  const { nome, email, senha, cpf, celular } = valida.data

  const errosSenha = validaSenha(senha)
  if (errosSenha.length > 0) {
    return res.status(400).json({ erro: errosSenha })
  }

  const senhaCriptografada = bcrypt.hashSync(senha, 12)

  try {
    const usuario = await prisma.usuario.update({
      where: { id: id },
      data: { nome, email, senha: senhaCriptografada, celular }
    })
    res.status(200).json(usuario)
  } catch (error) {
    res.status(400).json({ error })
  }
})

router.delete("/:id", async (req, res) => {
  const { id } = req.params

  try {
    const usuario = await prisma.usuario.delete({
      where: { id: id }
    })
    res.status(200).json(usuario)
  } catch (error) {
    res.status(400).json({ erro: error })
  }
})

router.get("/dashboard/:usuarioId", async (req, res) => {
  const { usuarioId } = req.params

  try {
    const receitas = await prisma.receita.findMany({
      where: { usuarioId },
      select: { valor: true },
    })

    const despesas = await prisma.despesa.findMany({
      where: { usuarioId },
      select: { valor: true },
    })

    const totalReceitas = receitas.reduce((acc, r) => acc + Number(r.valor), 0)
    const totalDespesas = despesas.reduce((acc, d) => acc + Number(d.valor), 0)

    const lucroLiquido = totalReceitas - totalDespesas

    res.status(200).json({
      totalReceitas,
      totalDespesas,
      lucroLiquido,
    })
  } catch (error) {
    res.status(500).json({ erro: error })
  }
})


router.get("/relatorio/:usuarioId", async (req, res) => {
  const { usuarioId } = req.params;

  try {
    const receitas = await prisma.receita.findMany({
      where: { usuarioId },
      select: { id: true, valor: true, categoria: true, anexo: true, clienteId: true },
    });

    const despesas = await prisma.despesa.findMany({
      where: { usuarioId },
      select: { valor: true, categoria: true, anexo: true, createdAt: true },
    });

    const totalReceitas = receitas.reduce((acc, r) => acc + Number(r.valor), 0);
    const totalDespesas = despesas.reduce((acc, d) => acc + Number(d.valor), 0);
    const lucroLiquido = totalReceitas - totalDespesas;

    const vendasSemAnexo = receitas.filter(r => !r.anexo || r.anexo.trim() === "").length;
    const totalVendas = receitas.length;

    const categoriasReceitasMap = new Map<string, number>();
    receitas.forEach(r => {
        if (r.categoria) {
            const cat = r.categoria;
            categoriasReceitasMap.set(cat, (categoriasReceitasMap.get(cat) ?? 0) + 1);
        }
    });
    const categoriasMaisVendidas = Array.from(categoriasReceitasMap.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([categoria, contagem]) => ({ categoria, contagem }));

    const despesasSemAnexo = despesas.filter(d => !d.anexo || d.anexo.trim() === "").length;

    const categoriasDespesasMap = new Map<string, { count: number, total: number }>();
    despesas.forEach(d => {
        const cat = d.categoria && d.categoria.trim() !== "" ? d.categoria : "Sem Categoria";
        const valor = Number(d.valor);
        const atual = categoriasDespesasMap.get(cat) ?? { count: 0, total: 0 };
        categoriasDespesasMap.set(cat, {
            count: atual.count + 1,
            total: atual.total + valor,
        });
    });

    const categoriasMaisDespesas = Array.from(categoriasDespesasMap.entries())
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 3)
        .map(([categoria, data]) => ({ categoria, contagem: data.count }));

    const valorGastoCategorias = Array.from(categoriasDespesasMap.entries())
        .sort(([, a], [, b]) => b.total - a.total)
        .slice(0, 3)
        .map(([categoria, data]) => ({ categoria, valor: data.total }));


    const receitasComCliente = receitas.filter(r => r.clienteId);
    const clientesIds = receitasComCliente.map(r => r.clienteId!).filter((v, i, a) => a.indexOf(v) === i);

    const clientesData = await prisma.cliente.findMany({
        where: { id: { in: clientesIds } },
        select: { id: true, nome: true }
    });
    const clienteNomeMap = new Map<number, string>();
    clientesData.forEach(c => clienteNomeMap.set(c.id, c.nome));

    const clientesMap = new Map<number, { nome: string, totalGasto: number, contagem: number }>();
    receitasComCliente.forEach(r => {
        const id = r.clienteId!;
        const nome = clienteNomeMap.get(id) ?? `Cliente ID ${id}`;
        const valor = Number(r.valor);

        const atual = clientesMap.get(id) ?? { nome, totalGasto: 0, contagem: 0 };
        clientesMap.set(id, {
            ...atual,
            totalGasto: atual.totalGasto + valor,
            contagem: atual.contagem + 1,
        });
    });

    const clientesQueMaisGastaram = Array.from(clientesMap.values())
        .sort((a, b) => b.totalGasto - a.totalGasto)
        .slice(0, 5);

    const clientesComMaisCompras = Array.from(clientesMap.values())
        .sort((a, b) => b.contagem - a.contagem)
        .slice(0, 3);

    const totalClientes = await prisma.cliente.count({
        where: { usuarioId }
    });


    const produtosVendidosAgg = await prisma.receitaItem.groupBy({
        by: ["produtoId"],
        where: {
            receita: { usuarioId }
        },
        _sum: { qtdBase: true },
        orderBy: { _sum: { qtdBase: "desc" } },
        take: 3,
    });

    const idsVendidos = produtosVendidosAgg.map(i => i.produtoId);

    const produtosVendidosInfo = await prisma.produto.findMany({
        where: { id: { in: idsVendidos } },
        select: { id: true, nome: true, unidadeBase: true }
    });

    const produtosMaisVendidos = produtosVendidosAgg.map(item => {
        const produtoInfo = produtosVendidosInfo.find(p => p.id === item.produtoId);

        const produtoFormatado = formatarProdutoParaExibicao({
            ...produtoInfo,
            saldoBase: item._sum.qtdBase ?? 0,
        });

        return {
            nome: produtoFormatado.nome,
            quantidade: produtoFormatado.saldoDisplay,
            unidade: produtoFormatado.unidadeDisplay,
        };
    });


    const receitasIds = receitas.map(r => r.id);
    const receitasComItens = await prisma.receitaItem.findMany({
        where: { receitaId: { in: receitasIds } },
        distinct: ['receitaId'],
        select: { receitaId: true },
    });
    const receitasComItensIds = new Set(receitasComItens.map(i => i.receitaId));
    const vendasSemItens = receitasIds.filter(id => !receitasComItensIds.has(id)).length;


    const produtosEmEstoque = await prisma.produto.findMany({
        where: { usuarioId, ativo: true },
        select: { nome: true, saldoBase: true, unidadeBase: true, categoria: true }
    });

    const produtosFormatadosEstoque = produtosEmEstoque.map(formatarProdutoParaExibicao);

    const categoriasEstoqueMap = new Map<string, number>();
    produtosFormatadosEstoque.forEach(p => {
        if (p.categoria) {
            const cat = p.categoria;
            categoriasEstoqueMap.set(cat, (categoriasEstoqueMap.get(cat) ?? 0) + p.saldoDisplay);
        }
    });

    const categoriasEstoque = Array.from(categoriasEstoqueMap.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([categoria, quantidade]) => ({ categoria, quantidade: Number(quantidade.toFixed(2)) }));


    const estoquePorUnidade = produtosFormatadosEstoque.filter(p => p.unidadeDisplay === 'un')
        .sort((a, b) => b.saldoDisplay - a.saldoDisplay)
        .slice(0, 3)
        .map(p => ({ produto: p.nome, quantidade: Number(p.saldoDisplay.toFixed(0)) }));

    const estoquePorKg = produtosFormatadosEstoque.filter(p => p.unidadeDisplay === 'kg')
        .sort((a, b) => b.saldoDisplay - a.saldoDisplay)
        .slice(0, 3)
        .map(p => ({ produto: p.nome, quantidade: Number(p.saldoDisplay.toFixed(2)), unidade: 'Kg' }));

    const estoquePorL = produtosFormatadosEstoque.filter(p => p.unidadeDisplay === 'L')
        .sort((a, b) => b.saldoDisplay - a.saldoDisplay)
        .slice(0, 3)
        .map(p => ({ produto: p.nome, quantidade: Number(p.saldoDisplay.toFixed(2)), unidade: 'L' }));


    res.status(200).json({
      totais: {
        totalReceitas,
        totalDespesas,
        lucroLiquido,
      },
      receitas: {
        categoriasMaisVendidas,
        produtosMaisVendidos,
        totalVendas,
        valorTotalVendas: totalReceitas,
        vendasSemItens,
        vendasSemAnexo,
      },
      despesas: {
        categoriasMaisDespesas,
        valorGastoCategorias,
        despesasSemAnexo,
      },
      clientes: {
        clientesQueMaisGastaram,
        clientesComMaisCompras,
        totalClientesRegistrados: totalClientes,
      },
      estoque: {
        categoriasEstoque,
        maiorQtdUnidade: estoquePorUnidade,
        maiorQtdKg: estoquePorKg,
        maiorQtdMl: estoquePorL,
      },
    });

  } catch (error) {
    console.error("Erro ao gerar relatório:", error);
    res.status(500).json({ erro: "Erro ao gerar relatório" });
  }
});

export default router
