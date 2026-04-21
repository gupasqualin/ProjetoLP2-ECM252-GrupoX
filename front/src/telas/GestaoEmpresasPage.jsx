import { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = '/api';

function GestaoEmpresasPage() {
  const [companies, setCompanies] = useState([]);
  const [companyForm, setCompanyForm] = useState({
    name: '',
    ticker: '',
    sector: ''
  });
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyError, setCompanyError] = useState('');
  const [companySuccess, setCompanySuccess] = useState('');

  const loadCompanies = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/empresas`);
      setCompanies(response.data);
    } catch {
      setCompanyError('Nao foi possivel carregar as empresas. Verifique se o microservico esta ativo.');
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const handleCompanyChange = (event) => {
    const { name, value } = event.target;
    setCompanyForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCompanySubmit = async (event) => {
    event.preventDefault();
    setCompanyLoading(true);
    setCompanyError('');
    setCompanySuccess('');

    try {
      const payload = {
        name: companyForm.name.trim(),
        ticker: companyForm.ticker.trim().toUpperCase(),
        sector: companyForm.sector.trim()
      };

      const response = await axios.post(`${API_BASE_URL}/empresas`, payload);
      setCompanies((prev) => [...prev, response.data]);
      setCompanyForm({ name: '', ticker: '', sector: '' });
      setCompanySuccess('Empresa cadastrada com sucesso.');
    } catch (error) {
      const message = error?.response?.data?.message
        || 'Erro ao cadastrar empresa. Verifique se o microservico esta ativo.';
      setCompanyError(message);
    } finally {
      setCompanyLoading(false);
    }
  };

  const handleCompanyDelete = async (id) => {
    setCompanyError('');
    setCompanySuccess('');

    try {
      await axios.delete(`${API_BASE_URL}/empresas/${id}`);
      setCompanies((prev) => prev.filter((company) => company.id !== id));
      setCompanySuccess('Empresa removida com sucesso.');
    } catch (error) {
      const message = error?.response?.data?.message || 'Erro ao remover empresa.';
      setCompanyError(message);
    }
  };

  return (
    <section className="company-section">
      <article className="panel company-panel">
        <h2>Catalogo de Empresas</h2>

        <form className="company-form" onSubmit={handleCompanySubmit}>
          <input
            name="name"
            placeholder="Nome da empresa"
            value={companyForm.name}
            onChange={handleCompanyChange}
            required
          />
          <input
            name="ticker"
            placeholder="Ticker"
            value={companyForm.ticker}
            onChange={handleCompanyChange}
            required
          />
          <input
            name="sector"
            placeholder="Setor"
            value={companyForm.sector}
            onChange={handleCompanyChange}
            required
          />
          <button type="submit" disabled={companyLoading}>
            {companyLoading ? 'Salvando...' : 'Cadastrar empresa'}
          </button>
        </form>

        {companyError && <p className="feedback error">{companyError}</p>}
        {companySuccess && <p className="feedback success">{companySuccess}</p>}

        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome</th>
              <th>Ticker</th>
              <th>Setor</th>
              <th className="action-cell"></th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 ? (
              <tr>
                <td colSpan="5">Sem empresas cadastradas.</td>
              </tr>
            ) : (
              companies.map((company) => (
                <tr key={company.id}>
                  <td>{company.id}</td>
                  <td>{company.name}</td>
                  <td>{company.ticker}</td>
                  <td>{company.sector}</td>
                  <td className="action-cell">
                    <button
                      type="button"
                      className="delete-company-btn"
                      onClick={() => handleCompanyDelete(company.id)}
                      title="Remover empresa"
                      aria-label={`Remover ${company.name}`}
                    >
                      x
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </article>
    </section>
  );
}

export default GestaoEmpresasPage;
