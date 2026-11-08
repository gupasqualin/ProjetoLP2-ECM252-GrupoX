// Liga este microsservico ao barramento de eventos sem depender de nenhum
// outro microsservico:
//  - registra a URL de eventos deste servico no barramento (POST /subscribe);
//  - recupera os eventos que perdeu enquanto estava fora do ar (GET /events);
//  - repete isso periodicamente, para se recuperar se o barramento reiniciar
//    ou se alguma entrega falhar.
// O mesmo arquivo existe em cada microsservico que consome eventos.

const INTERVALO_SINCRONIZACAO_MS = 10000;

// Qual dado cada evento altera, ex.: "MARKET_DATA:3". Serve para um evento
// antigo que chegue atrasado nao sobrescrever um dado mais novo.
function chavesDoEvento(evento) {
  const tipo = String(evento?.eventType || '').trim().toUpperCase();
  const companyId = evento?.companyId ?? evento?.payload?.companyId ?? evento?.payload?.id;

  if (tipo === 'COMPANY_DELETED') {
    return ['COMPANY', 'MARKET_DATA', 'ASSUMPTIONS'].map((dado) => `${dado}:${companyId}`);
  }

  const dado = tipo.replace(/_(UPSERTED|DELETED)$/, '');
  return dado === tipo ? [] : [`${dado}:${companyId}`];
}

export function criarAssinatura({ nome, eventBusUrl, urlDeEventos, tipos, aplicar }) {
  // O barramento entrega eventos em paralelo, entao eles podem chegar fora de
  // ordem. Guardamos quais ja foram aplicados (e nao so o maior numero), para
  // nao descartar um evento atrasado por engano.
  let aplicadosAte = 0; // todos os eventos de 1 ate aqui ja foram aplicados
  let aplicadosDepois = new Set(); // aplicados com numero maior que aplicadosAte
  let versaoDoDado = {}; // chave do dado -> numero do ultimo evento que o alterou

  function jaAplicado(id) {
    return id <= aplicadosAte || aplicadosDepois.has(id);
  }

  function marcarAplicado(id) {
    aplicadosDepois.add(id);
    while (aplicadosDepois.has(aplicadosAte + 1)) {
      aplicadosAte += 1;
      aplicadosDepois.delete(aplicadosAte);
    }
  }

  function receber(evento) {
    const id = Number(evento?.id);
    if (!Number.isInteger(id)) {
      return aplicar(evento);
    }
    if (jaAplicado(id)) {
      return { value: { ignorado: true, motivo: 'evento ja aplicado', id } };
    }

    marcarAplicado(id);
    const chaves = chavesDoEvento(evento);
    const [chavePrincipal] = chaves;
    if (chavePrincipal && (versaoDoDado[chavePrincipal] ?? 0) > id) {
      return { value: { ignorado: true, motivo: 'ja existe um dado mais novo', id } };
    }

    const resultado = aplicar(evento);
    for (const chave of chaves) {
      versaoDoDado[chave] = Math.max(versaoDoDado[chave] ?? 0, id);
    }
    return resultado;
  }

  async function registrar() {
    for (const eventType of tipos) {
      const resposta = await fetch(`${eventBusUrl}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType, url: urlDeEventos })
      });
      if (!resposta.ok) {
        throw new Error(`falha ao assinar ${eventType} (HTTP ${resposta.status})`);
      }
    }
  }

  async function recuperarPerdidos() {
    const url = `${eventBusUrl}/events?after=${aplicadosAte}&types=${tipos.join(',')}`;
    const resposta = await fetch(url);
    if (!resposta.ok) {
      throw new Error(`falha ao buscar eventos (HTTP ${resposta.status})`);
    }

    const { lastEventId, events } = await resposta.json();

    // O barramento guarda os eventos em memoria: se ele reiniciou, a contagem
    // recomeca do 1 e precisamos voltar a contar junto com ele.
    const maiorAplicado = Math.max(aplicadosAte, ...aplicadosDepois);
    if (Number(lastEventId) < maiorAplicado) {
      console.warn(`[${nome}] Barramento reiniciou; voltando a contar eventos do zero.`);
      aplicadosAte = 0;
      aplicadosDepois = new Set();
      versaoDoDado = {};
      return recuperarPerdidos();
    }

    let recuperados = 0;
    for (const evento of events) {
      if (jaAplicado(Number(evento.id))) continue;
      const resultado = receber(evento);
      recuperados += 1;
      if (resultado?.error) {
        console.warn(`[${nome}] Evento ${evento.id} (${evento.eventType}) ignorado: ${resultado.error}`);
      }
    }

    // Eventos de tipos que este servico nao assina tambem contam como
    // "vistos", para a contagem continuar andando.
    for (let id = aplicadosAte + 1; id <= Number(lastEventId); id += 1) {
      if (!events.some((evento) => Number(evento.id) === id)) {
        marcarAplicado(id);
      }
    }
    return recuperados;
  }

  async function sincronizar() {
    try {
      await registrar();
      const recuperados = await recuperarPerdidos();
      if (recuperados > 0) {
        console.log(`[${nome}] ${recuperados} evento(s) recuperado(s) do barramento.`);
      }
    } catch (erro) {
      console.warn(`[${nome}] Barramento indisponivel (${erro.message}). Tentando de novo em breve.`);
    }
  }

  function iniciar() {
    sincronizar();
    setInterval(sincronizar, INTERVALO_SINCRONIZACAO_MS);
  }

  return { receber, iniciar, ultimoEventoAplicado: () => aplicadosAte };
}
