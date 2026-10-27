# SendWPP

Conecta o WhatsApp ao Gestor para enviar mensagens e gerenciar a conta pelo sistema.

- Conexão por QR Code ou código de vinculação.
- Envio de textos, imagens, vídeos, áudios e documentos.
- Solicitação de cobrança Pix com valor pelo Baileys.
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
`order_details` / `review_and_pay` para solicitar pagamento com total em destaque
e Pix como forma de pagamento, em vez do cartão `payment_info` que apresenta a
chave para copiar. O pedido permanece pendente e usa a chave estática. Não processa dinheiro
nem confirma recebimento: `accepted: true` indica apenas confirmação de transporte
pelo servidor WhatsApp. Valide a exibição e a ação Pix no celular antes do uso;
a renderização depende da conta e do aplicativo. Não repita uma requisição que
terminou sem confirmação antes de conferir a conversa.

No Gestor, adicione `{cobranca_pix}` ao modelo sem anexo para usar a chave de
Minha Conta e o valor do cliente. Reinicie os dois serviços após atualizar.
