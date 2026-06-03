async function fetchJsonOrFail(url, sourceName) {
  if (typeof fetch !== 'function') {
    throw new Error('Runtime sem suporte ao fetch nativo do Node.js.');
  }

  const response = await fetch(url);
  if (!response.ok) {
    let message = '';
    try {
      const body = await response.json();
      message = body?.message ? `: ${body.message}` : '';
    } catch {
      message = '';
    }
    throw new Error(`${sourceName} retornou status ${response.status}${message}`);
  }

  return response.json();
}

export { fetchJsonOrFail };
