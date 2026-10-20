import { conectar, esperar, log } from './whatsapp.js';

const conexao = await conectar({ permitirQR: true });
log('Conectado! Aguardando a sincronização inicial...');
await esperar(15_000);

const grupos = Object.values(await conexao.sock.groupFetchAllParticipating())
  .sort((a, b) => a.subject.localeCompare(b.subject, 'pt-BR'));

console.log('\nGrupos desta conta (copie o nome para NOME_GRUPO no .env):\n');
for (const grupo of grupos) {
  console.log(`${grupo.id}   ${grupo.subject}`);
}

conexao.fechar();
setTimeout(() => process.exit(0), 2000);
