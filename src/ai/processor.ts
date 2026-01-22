import axios from 'axios'
import { supabase } from '../database/supabase'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const DEFAULT_MODEL = process.env.OPENROUTER_DEFAULT_MODEL || 'deepseek/deepseek-chat'

export interface AIResponse {
  reply: string
  intent: 'question' | 'order' | 'complaint'
  orderData?: {
    product: string
    quantity: number
    address?: string
    phone?: string
  }
}

export async function processWithAI(
  businessId: string,
  customerId: string,
  message: string
): Promise<AIResponse> {
  try {
    // 1. Get knowledge base
    const { data: knowledge } = await supabase
      .from('ai_knowledge_base')
      .select('*')
      .eq('business_id', businessId)

    // 2. Get conversation history
    const { data: history } = await supabase
      .from('messages')
      .select('*')
      .eq('business_id', businessId)
      .eq('customer_id', customerId)
      .order('timestamp', { ascending: false })
      .limit(10)

    // 3. Get AI settings
    const { data: settings } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('business_id', businessId)
      .single()

    // 4. Get business profile
    const { data: business } = await supabase
      .from('businesses')
      .select('name')
      .eq('id', businessId)
      .single()

    // 5. Build prompt
    const knowledgeText = knowledge && knowledge.length > 0
      ? knowledge.map((k: any) => `Q: ${k.question}\nA: ${k.answer}`).join('\n\n')
      : 'No knowledge base entries yet.'

    const systemPrompt = `You are a helpful customer service AI for "${business?.name || 'an e-commerce business'}".

Your job is to:
1. Answer customer questions professionally and helpfully
2. Help customers place orders by collecting: product name, quantity, delivery address, and phone number
3. Always respond in the same language as the customer (Arabic or English)
4. Be ${settings?.personality || 'friendly'} in your tone

Knowledge Base:
${knowledgeText}

When the customer wants to order, collect all required info through conversation, then return JSON in this exact format (no markdown, no code blocks):
{
  "reply": "your response to customer",
  "intent": "question|order|complaint",
  "orderData": {
    "product": "product name",
    "quantity": number,
    "address": "delivery address",
    "phone": "phone number"
  }
}

If it's not an order, set orderData to null.
Always return valid JSON only.`

    // 6. Build conversation history
    const messages: Array<{ role: string; content: string }> = []
    
    if (history && history.length > 0) {
      history.reverse().forEach((h: any) => {
        messages.push({
          role: h.direction === 'incoming' ? 'user' : 'assistant',
          content: h.content,
        })
      })
    }
    
    // Add current message
    messages.push({
      role: 'user',
      content: message,
    })

    // 7. Call Open Router API
    if (!OPENROUTER_API_KEY) {
      throw new Error('Open Router API key not configured')
    }

    const response = await axios.post(
      `${OPENROUTER_BASE_URL}/chat/completions`,
      {
        model: DEFAULT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: settings?.temperature || 0.7,
        max_tokens: 1000,
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.FRONTEND_URL || 'https://localhost:3000',
          'X-Title': 'AI Business Platform',
          'Content-Type': 'application/json',
        },
      }
    )

    const aiResponse = response.data.choices[0].message.content
    
    // Parse JSON response
    let result: AIResponse
    try {
      // Remove markdown code blocks if present
      const cleanResponse = aiResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      
      result = JSON.parse(cleanResponse)
    } catch (parseError) {
      // If JSON parsing fails, treat as plain text response
      result = {
        reply: aiResponse,
        intent: 'question',
        orderData: undefined,
      }
    }

    return result
    
  } catch (error: any) {
    console.error('Open Router API Error:', error.response?.data || error.message)
    
    // Fallback response
    const fallbackMessage = settings?.language === 'ar' 
      ? 'عذراً، حدث خطأ مؤقت. يرجى المحاولة مرة أخرى.'
      : settings?.language === 'en'
      ? 'Sorry, a temporary error occurred. Please try again.'
      : 'عذراً، حدث خطأ مؤقت. يرجى المحاولة مرة أخرى.\nSorry, a temporary error occurred. Please try again.'
    
    return {
      reply: fallbackMessage,
      intent: 'question',
      orderData: undefined,
    }
  }
}
