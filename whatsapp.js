import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from 'baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';

const AUTH_DIR = './auth_info';
const MAX_RECONEXOES = 5;

// A biblioteca de criptografia do WhatsApp (libsignal) imprime as sessões inteiras,
// com chaves privadas, via console.info/console.warn. Isso não pode ir para os logs.
const AVISOS_DE_SESSAO = /^(Closing session|Opening session|Removing old closed session|Session already)/;
for (const metodo of ['info', 'warn']) {
  const original = console[metodo].bind(console);
  console[metodo] = (primeiro, ...resto) => {
    if (typeof primeiro === 'string' && AVISOS_DE_SESSAO.test(primeiro)) return;
    original(primeiro, ...resto);
  };
}

export const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const log = (...args) => console.log(`[${new Date().toISOString()}]`, ...args);

/**
 * Conecta ao WhatsApp e resolve quando a conexão abrir.
 *
 * - permitirQR: true só no pareamento manual. Na execução agendada, pedir QR Code
 *   significa que a sessão não existe mais, então vira erro (ninguém vai escanear).
 * - aoCriarSocket: registra listeners em cada socket criado, inclusive após reconexão.
 *
 * Retorna { sock, fechar }. Use sempre conexao.sock (ele muda se houver reconexão).
 */
export async function conectar({ permitirQR = false, aoCriarSocket } = {}) {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const conexao = {
    sock: null,
    encerrado: false,
    fechar() {
      this.encerrado = true;
      this.sock?.end(undefined);
    },
  };
  let reconexoes = 0;

  return new Promise((resolve, reject) => {
    const iniciar = () => {
      const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        markOnlineOnConnect: false, // não "rouba" as notificações do celular
      });
      conexao.sock = sock;

      sock.ev.on('creds.update', saveCreds);
      aoCriarSocket?.(sock);

      sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
        if (qr) {
          if (!permitirQR) {
            conexao.fechar();
            reject(new Error('SEM_SESSAO: a sessão não existe ou expirou. Rode "node parear.js".'));
            return;
          }
          console.log('\nNo celular do bot: WhatsApp > Aparelhos conectados > Conectar um aparelho\n');
          qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {
          reconexoes = 0;
          resolve(conexao);
        }

        if (connection === 'close') {
          if (conexao.encerrado) return;

          const codigo = lastDisconnect?.error?.output?.statusCode;
          if (codigo === DisconnectReason.loggedOut) {
            reject(new Error('LOGOUT: o aparelho foi desconectado pelo celular. Rode "node parear.js".'));
            return;
          }
          if (++reconexoes > MAX_RECONEXOES) {
            reject(new Error(`A conexão caiu ${MAX_RECONEXOES} vezes seguidas (último código: ${codigo}).`));
            return;
          }

          // Logo após escanear o QR, o WhatsApp derruba a conexão de propósito
          // (restartRequired) e espera uma reconexão imediata.
          log(`Conexão fechada (código ${codigo}). Reconectando...`);
          setTimeout(iniciar, codigo === DisconnectReason.restartRequired ? 0 : 3000);
        }
      });
    };

    iniciar();
  });
}
