# SendWPP

Conecta o WhatsApp ao Gestor para enviar mensagens e gerenciar a conta pelo sistema.

- Conexão por QR Code ou código de vinculação.
- Envio de textos, imagens, vídeos, áudios e documentos.
- Mensagem de cobrança com botão para copiar a chave Pix pelo Baileys.
- Publicação e exclusão de status.
- Verificação de números que possuem WhatsApp.
- Acompanhamento da conexão e troca da conta vinculada.
- Rejeição automática de chamadas, quando ativada.

## Cobrança Pix

`POST /api/messages/send/pix`, com a autenticação habitual (`Authorization: Bearer TOKEN`):

```json
{
  "session": "default",
  "number": "5511999999999",
  "amount": "30.00",
  "body": "Sua mensalidade está disponível para pagamento.",
  "pix": {
    "key": "recebimentos@exemplo.com.br",
    "keyType": "Email",
    "merchantName": "Nome do titular"
  }
}
```

`amount` é o valor em reais, positivo, com até duas casas decimais. Os tipos
aceitos são CPF, CNPJ, Celular/PHONE, Email e Aleatória/EVP. A mensagem usa
`cta_copy` para mostrar o texto do modelo e o botão **Copiar chave Pix**. O botão
copia a chave cadastrada, sem gerar um código Pix com valor embutido. O valor
deve aparecer no texto (no Gestor, use `{valor}`). Não envia resumo de pedido,
número de cobrança, quantidade, total no cabeçalho ou ação de atualizar status.
`referenceId` identifica a requisição apenas na resposta da API e não vai na
mensagem. Não processa dinheiro nem confirma recebimento:
`accepted: true` indica apenas confirmação de transporte
pelo servidor WhatsApp. Valide a exibição e a ação Pix no celular antes do uso;
a renderização depende da conta e do aplicativo. Não repita uma requisição que
terminou sem confirmação antes de conferir a conversa.

No Gestor, adicione `{cobranca_pix}` ao modelo sem anexo para usar a chave de
Minha Conta. Use `{valor}` no texto para apresentar o valor do cliente.
Para esta alteração, atualize e reinicie a `whatsapp-api`; o marcador e o
endpoint do Gestor continuam os mesmos. Apenas os novos envios usam o formato.
