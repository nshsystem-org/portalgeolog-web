import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hzpgfapvjwqtjclriisz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cGdmYXB2andxdGpjbHJpaXN6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ2OTMzOSwiZXhwIjoyMDkwMDQ1MzM5fQ.uzUbzhVFfyJxMYk2SpVoa38AsDy9KsN5eEp-MMncJ8Y';

console.log('Validando SUPABASE_SERVICE_ROLE_KEY...');

try {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase.from('app_versions').select('count').limit(1);
  
  if (error) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY inválido:', error.message);
    process.exit(1);
  }
  
  console.log('✅ SUPABASE_SERVICE_ROLE_KEY válido');
} catch (err) {
  console.error('❌ Erro ao validar SUPABASE_SERVICE_ROLE_KEY:', err.message);
  process.exit(1);
}

// Validar formato dos secrets da Meta
const RESEND_API_KEY = 're_SmsP3Qyv_6NqVfF8Wq1jLQRu8aMbZqSXS';
const META_PHONE_NUMBER_ID = '1098516980012123';
const META_BUSINESS_ACCOUNT_ID = '841855345050672';
const META_WHATSAPP_ACCESS_TOKEN = 'EAAVZAagJa3EcBRSR52LXbvT7HkhXq6LtEo8fpeAcQAiT9BeiU7zLAx55O258zyaj4uVZAV3cAWHZCjJyswHmb8Gi5hEkmZBeUPb14vgbaGDPJlnZC0phh4cdF1a3ZBJmPKmI7hAZCVMLBRpyw04QmcTPVfqRj4hZAWZARMrEBmIjEhaTG85k9LhNKUpkHoFWzsgZDZD';

console.log('Validando formato dos secrets...');

if (!RESEND_API_KEY.startsWith('re_')) {
  console.error('❌ RESEND_API_KEY formato inválido');
  process.exit(1);
}
console.log('✅ RESEND_API_KEY formato válido');

if (!/^\d+$/.test(META_PHONE_NUMBER_ID)) {
  console.error('❌ META_PHONE_NUMBER_ID formato inválido');
  process.exit(1);
}
console.log('✅ META_PHONE_NUMBER_ID formato válido');

if (!/^\d+$/.test(META_BUSINESS_ACCOUNT_ID)) {
  console.error('❌ META_BUSINESS_ACCOUNT_ID formato inválido');
  process.exit(1);
}
console.log('✅ META_BUSINESS_ACCOUNT_ID formato válido');

if (!META_WHATSAPP_ACCESS_TOKEN.startsWith('EAA')) {
  console.error('❌ META_WHATSAPP_ACCESS_TOKEN formato inválido');
  process.exit(1);
}
console.log('✅ META_WHATSAPP_ACCESS_TOKEN formato válido');

console.log('\n✅ Todos os secrets validados com sucesso!');
