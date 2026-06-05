import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 1. LISTA DE SERVIÇOS
 * Agora TODOS os serviços rodam usando 'npm run dev'.
 * O caminho (cwd) continua apontando para a pasta correta de cada um.
 */
const servicos = [
  { 
    nome: 'Barramento ', 
    cor: '\x1b[35m', 
    comando: 'npm', 
    args: ['run', 'dev'], 
    cwd: path.join(__dirname, 'barramento-eventos') 
  },
  { 
    nome: 'Empresas   ', 
    cor: '\x1b[32m', 
    comando: 'npm', 
    args: ['run', 'dev'], 
    cwd: path.join(__dirname, 'gestao-empresas') 
  },
  { 
    nome: 'Mercado    ', 
    cor: '\x1b[33m', 
    comando: 'npm', 
    args: ['run', 'dev'], 
    cwd: path.join(__dirname, 'dados-mercado') 
  },
  { 
    nome: 'Premissas  ', 
    cor: '\x1b[34m', 
    comando: 'npm', 
    args: ['run', 'dev'], 
    cwd: path.join(__dirname, 'premissas-projecao') 
  },
  { 
    nome: 'Valuation  ', 
    cor: '\x1b[36m', 
    comando: 'npm', 
    args: ['run', 'dev'], 
    cwd: path.join(__dirname, 'valuation') 
  },
  { 
    nome: 'Matriz     ', 
    cor: '\x1b[90m', 
    comando: 'npm', 
    args: ['run', 'dev'], 
    cwd: path.join(__dirname, 'análise-sensibilidade') 
  },
  { 
    nome: 'Frontend   ', 
    cor: '\x1b[31m', 
    comando: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(__dirname, '..', 'front') 
  }
];

/**
 * 2. FUNÇÃO DE INICIALIZAÇÃO
 */
function iniciarServicos() {
  console.log('\x1b[1m\x1b[37mIniciando todos os serviços do Valuation via NPM...\x1b[0m\n');

  servicos.forEach((servico) => {
    const processo = spawn(servico.comando, servico.args, {
      cwd: servico.cwd, 
      env: process.env,
      shell: true // Mantém a compatibilidade com comandos do Windows (.cmd)
    });

    processo.stdout.on('data', (data) => {
      const linhas = data.toString().trim().split('\n');
      linhas.forEach(linha => {
        if (linha) console.log(`${servico.cor}[${servico.nome}]\x1b[0m ${linha}`);
      });
    });

    processo.stderr.on('data', (data) => {
      const linhas = data.toString().trim().split('\n');
      linhas.forEach(linha => {
        if (linha) console.error(`${servico.cor}[${servico.nome} ERROR]\x1b[0m ${linha}`);
      });
    });

    processo.on('close', (code) => {
      console.log(`${servico.cor}[${servico.nome}]\x1b[0m Processo encerrado com código ${code}`);
    });
  });
}

iniciarServicos();