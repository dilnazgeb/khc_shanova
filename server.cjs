const http = require('http');
const url = require('url');
const crypto = require('crypto');

const PORT = 5002;

function generateProjectId(code, customer) {
  if (!code) return null;
  const key = `${code}:${customer || 'unknown'}`;
  const hash = crypto.createHash('md5').update(key).digest('hex').slice(0, 8);
  const cleanCode = code.replace(/[^a-z0-9-]/gi, '').toLowerCase();
  return `${cleanCode}-${hash}`;
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  if (pathname === '/api/health' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (pathname === '/api/analyze-report' && req.method === 'POST') {
    // Simplified: just return demo data
    const projectId = generateProjectId('ДПГ-21-01');
    const response = {
      projectId,
      project_info: {
        full_name: 'Демо Проект',
        code: 'ДПГ-21-01-039098',
        customer: 'ООО Заказчик',
        report_period: '2025 декабря',
        location: 'Нурсултан'
      },
      project_status: 'тревожный',
      metrics: {
        SMR_completion: 46.69,
        GPR_delay_percent: 13.33,
        GPR_delay_days: 40,
        DDU_payments_percent: [47.07],
        guarantee_extension: false
      },
      reasoning: [
        'Выполнение СМР составляет 46.69% - ниже планового уровня',
        'Отставание от графика составляет 13.33% (40 дней)',
        'Платежи по ДДУ составляют только 47.07%',
        'Гарантийный случай не выявлен',
        'Статус проекта - ТРЕВОЖНЫЙ: требуется внимание'
      ],
      triggered_conditions: ['low_smr', 'delayed_schedule', 'low_ddu']
    };
    res.writeHead(200);
    res.end(JSON.stringify(response));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`API server running on http://127.0.0.1:${PORT}`);
});
