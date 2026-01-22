const fetch = require('node-fetch');

async function getSuggestion(customerMessage, companyContext) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'WhatsApp AI Manager'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-r1-distill-llama-70b',
        messages: [
          {
            role: 'system',
            content: companyContext
          },
          {
            role: 'user',
            content: `رسالة العميل: ${customerMessage}\n\nاقترح رد احترافي يتناسب مع سياق شركتنا.`
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to get AI suggestion');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('AI Service Error:', error);
    throw error;
  }
}

module.exports = { getSuggestion };
