// BR Code estático: Manual de Padrões para Iniciação do Pix, seção 2.6.
// https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf
function invalid(message) {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
}

function field(id, value) {
  const size = Buffer.byteLength(value, 'utf8');
  if (size < 1 || size > 99) invalid('Campo Pix excede o tamanho permitido pelo BR Code.');
  return id + String(size).padStart(2, '0') + value;
}

function merchantText(value, maxLength, label) {
  const text = String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 $%*+\-./:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength).trim();
  if (!text) invalid(`Informe ${label} com letras ou números para gerar o código Pix.`);
  return text;
}

function checksum(text) {
  let crc = 0xFFFF;
  for (const byte of Buffer.from(text, 'utf8')) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++)
      crc = ((crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function createPixCode({ key, merchantName, merchantCity = 'NAO INFORMADO', amountCents, txid = '***' }) {
  if (typeof key !== 'string' || !key || /[^\x21-\x7E]/.test(key) || Buffer.byteLength(key, 'utf8') > 77)
    invalid('A chave Pix deve ter até 77 bytes para gerar o BR Code.');
  if (txid !== '***' && !/^[A-Za-z0-9]{1,25}$/.test(txid))
    invalid('Identificador Pix inválido.');
  let amount = '';
  if (amountCents !== undefined) {
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 999999999999)
      invalid('Valor Pix inválido.');
    const decimal = `${Math.trunc(amountCents / 100)}.${String(amountCents % 100).padStart(2, '0')}`;
    amount = field('54', decimal);
  }
  const content = field('00', '01')
    + field('26', field('00', 'br.gov.bcb.pix') + field('01', key))
    + field('52', '0000') + field('53', '986') + amount + field('58', 'BR')
    + field('59', merchantText(merchantName, 25, 'o nome do titular'))
    + field('60', merchantText(merchantCity, 15, 'a cidade do titular'))
    + field('62', field('05', txid)) + '6304';
  return content + checksum(content);
}
