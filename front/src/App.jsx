import { useState } from 'react';
import axios from 'axios';

function App() {
  // 1. Estado para armazenar a lista de empresas (Mock inicial)
  const [companies, setCompanies] = useState([
    { id: 1, name: 'Weg SA', ticker: 'WEGE3', sector: 'Bens Industriais' },
    { id: 2, name: 'Petrobras', ticker: 'PETR4', sector: 'Energia' }
  ]);

  // 2. Estado para controlar os dados digitados no formulário
  const [formData, setFormData] = useState({ name: '', ticker: '', sector: '' });
  
  // 3. Estado para controlar o botão de carregamento
  const [loading, setLoading] = useState(false);

  // 4. Função que atualiza o estado conforme o usuário digita
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 5. Função acionada ao clicar em "Salvar Empresa"
  const handleSubmit = async (e) => {
    e.preventDefault(); // Impede a página de recarregar
    setLoading(true);

    try {
      // Deixamos a estrutura do Axios pronta para a integração futura.
      // const response = await axios.post('http://localhost:3001/empresas', formData);
      
      // Simulando o tempo de resposta do servidor (1 segundo)
      await new Promise(resolve => setTimeout(resolve, 1000)); 

      // Adicionando a nova empresa à tabela localmente
      const newCompany = {
        id: companies.length + 1,
        ...formData
      };

      setCompanies([...companies, newCompany]);
      setFormData({ name: '', ticker: '', sector: '' }); // Limpa os campos
      alert("Empresa cadastrada com sucesso na DecisionDCF!");

    } catch (error) {
      console.error("Erro na requisição Axios:", error);
      alert("Erro ao conectar com o Microsserviço de Gestão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '30px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>DecisionDCF</h1>
      <p>Módulo: <strong>Gestão de Empresas (Catálogo Central)</strong></p>
      
      <hr style={{ margin: '20px 0' }}/>

      {/* Seção do Formulário */}
      <section style={{ marginBottom: '40px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', maxWidth: '400px' }}>
        <h2>Cadastrar Nova Empresa</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          <input type="text" name="name" placeholder="Nome da Empresa (ex: Vale)" 
                 value={formData.name} onChange={handleChange} required 
                 style={{ padding: '10px', fontSize: '16px' }}/>
                 
          <input type="text" name="ticker" placeholder="Ticker (ex: VALE3)" 
                 value={formData.ticker} onChange={handleChange} required 
                 style={{ padding: '10px', fontSize: '16px' }}/>
                 
          <input type="text" name="sector" placeholder="Setor (ex: Mineração)" 
                 value={formData.sector} onChange={handleChange} required 
                 style={{ padding: '10px', fontSize: '16px' }}/>
                 
          <button type="submit" disabled={loading} style={{ padding: '10px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#0056b3', color: 'white', border: 'none', borderRadius: '4px' }}>
            {loading ? 'Salvando no banco...' : 'Salvar Empresa'}
          </button>

        </form>
      </section>

      {/* Seção da Tabela de Listagem */}
      <section>
        <h2>Empresas Analisadas</h2>
        <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: '800px', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f4f4f4', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '12px' }}>ID</th>
              <th style={{ padding: '12px' }}>Nome</th>
              <th style={{ padding: '12px' }}>Ticker</th>
              <th style={{ padding: '12px' }}>Setor</th>
            </tr>
          </thead>
          <tbody>
            {companies.map(empresa => (
              <tr key={empresa.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '12px' }}>{empresa.id}</td>
                <td style={{ padding: '12px' }}>{empresa.name}</td>
                <td style={{ padding: '12px' }}>{empresa.ticker}</td>
                <td style={{ padding: '12px' }}>{empresa.sector}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default App;