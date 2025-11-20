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

export default router
