import express, { Request, Response } from 'express'
import { supabase } from '../database/supabase'

const router = express.Router()

// Get messages for a conversation
router.get('/conversation/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params
    const { limit = 50, offset = 0 } = req.query

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('customer_id', customerId)
      .order('timestamp', { ascending: false })
      .limit(parseInt(limit as string))
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1)

    if (error) throw error

    res.json({ messages: data || [] })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get all conversations for a business
router.get('/conversations/:businessId', async (req: Request, res: Response) => {
  try {
    const { businessId } = req.params

    // Get unique customers with their latest message
    const { data, error } = await supabase
      .from('messages')
      .select(`
        customer_id,
        customer_phone,
        content,
        timestamp,
        direction,
        customers (
          id,
          name,
          phone
        )
      `)
      .eq('business_id', businessId)
      .order('timestamp', { ascending: false })

    if (error) throw error

    // Group by customer
    const conversations = new Map()
    data?.forEach((msg: any) => {
      const customerId = msg.customer_id || msg.customer_phone
      if (!conversations.has(customerId)) {
        conversations.set(customerId, {
          customerId: msg.customer_id,
          customerPhone: msg.customer_phone,
          customer: msg.customers,
          lastMessage: msg.content,
          lastMessageTime: msg.timestamp,
          lastMessageDirection: msg.direction,
        })
      }
    })

    res.json({ conversations: Array.from(conversations.values()) })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
