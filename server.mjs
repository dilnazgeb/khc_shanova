import express from 'express';
import cors from 'cors';
import multer from 'multer';
import crypto from 'crypto';

const app = express();
const PORT = 5002;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

function generateProjectId(code, customer) {
  if (!code) return null;
  const key = `${code}:${customer || 'unknown'}`;
  const hash = crypto.createHash('md5').update(key).digest('hex').slice(0, 8);
  const cleanCode = code.replace(/[^a-z0-9-]/gi, '').toLowerCase();
  return `${cleanCode}-${hash}`;
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/analyze-report', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  const filename = req.file.originalname;
  const projectId = generateProjectId(filename.replace('.pdf', ''));

  res.json({
    projectId,
    project_info: {
      full_name: `Проект ${filename.replace('.pdf', '')}`,
      code: filename.replace('.pdf', ''),
      customer: 'Заказчик',
      report_period: '2025 декабря',
      location: 'Местоположение'
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
      'Статус проекта - ТРЕВОЖНЫЙ'
    ],
    triggered_conditions: ['low_smr', 'delayed_schedule']
  });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`API server running on http://127.0.0.1:${PORT}`);
});
