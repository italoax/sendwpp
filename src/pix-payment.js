import { randomUUID } from 'node:crypto';

function invalid(message) {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
}

// Recebe reais como decimal; nunca arredonda silenciosamente uma cobrança.
export function pixPaymentParameters(payload) {
  const amount = String(payload?.amount ?? '').trim();
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(amount))
    invalid('Informe amount em reais, com até duas casas decimais.');
  const [whole, fraction = ''] = amount.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0)
    invalid('O valor da cobrança deve ser maior que zero.');

  const merchantName = String(payload?.pix?.merchantName ?? '').trim();
  let key = String(payload?.pix?.key ?? '').trim();
  const type = String(payload?.pix?.keyType ?? '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  const keyType = ({ CELULAR: 'PHONE', TELEFONE: 'PHONE', ALEATORIA: 'EVP' })[type] || type;
  if (!merchantName || merchantName.length > 100)
    invalid('Informe o nome do titular Pix (até 100 caracteres).');
  if (!['CPF', 'CNPJ', 'PHONE', 'EMAIL', 'EVP'].includes(keyType))
    invalid('Informe o tipo da chave Pix: CPF, CNPJ, Celular, Email ou Aleatória.');
  if (['CPF', 'CNPJ', 'PHONE'].includes(keyType)) {
    if (!/^[+\d()./\s-]+$/.test(key)) invalid('Chave Pix inválida.');
    key = key.replace(/\D/g, '');
    if (keyType === 'PHONE') {
      if (key.length === 10 || key.length === 11) key = `55${key}`;
      if (!/^55\d{10,11}$/.test(key)) invalid('Informe um celular Pix brasileiro com DDD.');
      key = `+${key}`;
    } else if (key.length !== (keyType === 'CPF' ? 11 : 14)) {
      invalid('Chave Pix inválida para o tipo informado.');
    }
  } else if (keyType === 'EMAIL') {
    if (key.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) invalid('Email Pix inválido.');
  } else if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(key)) {
    invalid('Chave Pix aleatória inválida.');
  }
  const body = String(payload?.body ?? '').trim() || 'Você recebeu uma solicitação de pagamento.';
  if (body.length > 4096) invalid('O texto da cobrança deve ter até 4096 caracteres.');
  const total = { value: cents, offset: 100 };
  return {
    body,
    parameters: {
      currency: 'BRL',
      total_amount: total,
      reference_id: randomUUID(),
      type: 'digital-goods',
      order: {
        status: 'pending',
        order_type: 'PAYMENT_REQUEST',
        subtotal: total,
        items: [{ name: 'Cobrança Pix', amount: total, quantity: 1 }],
      },
      payment_settings: [{
        type: 'pix_static_code',
        pix_static_code: { merchant_name: merchantName, key, key_type: keyType },
      }],
      share_payment_status: false,
      referral: 'chat_attachment',
    },
  };
}
