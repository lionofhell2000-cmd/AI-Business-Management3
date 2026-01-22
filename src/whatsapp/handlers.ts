import { Message } from 'whatsapp-web.js'
import { getClient } from './client'
import { supabase } from '../database/supabase'
import { processWithAI } from '../ai/processor'

export async function handleIncomingMessage(businessId: string, msg: Message) {
  try {
    const contact = await msg.getContact()
    const phoneNumber = contact.number.replace('@c.us', '').replace('@s.whatsapp.net', '')
    const messageText = msg.body

    // 1. Get or create customer
    let { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .eq('phone', phoneNumber)
      .single()

    if (!customer) {
      const { data: newCustomer } = await supabase
        .from('customers')
        .insert({
          business_id: businessId,
          name: contact.pushname || contact.number || phoneNumber,
          phone: phoneNumber,
          source: 'whatsapp',
        })
        .select()
        .single()
      customer = newCustomer
    }

    if (!customer) {
      console.error('Failed to create/get customer')
      return
    }

    // 2. Save message to database
    const { data: message } = await supabase
      .from('messages')
      .insert({
        business_id: businessId,
        customer_id: customer.id,
        customer_phone: phoneNumber,
        direction: 'incoming',
        content: messageText,
        platform: 'whatsapp',
        timestamp: new Date().toISOString(),
      })
      .select()
      .single()

    // 3. Check if AI mode is enabled
    const { data: settings } = await supabase
      .from('ai_settings')
      .select('enabled')
      .eq('business_id', businessId)
      .single()

    if (settings?.enabled) {
      // 4. Process with AI
      const aiResponse = await processWithAI(businessId, customer.id, messageText)
      
      // 5. Send AI response
      const client = getClient(businessId)
      if (client) {
        await client.sendMessage(msg.from, aiResponse.reply)
        
        // 6. Save AI response
        await supabase
          .from('messages')
          .insert({
            business_id: businessId,
            customer_id: customer.id,
            customer_phone: phoneNumber,
            direction: 'outgoing',
            content: aiResponse.reply,
            platform: 'whatsapp',
            is_ai: true,
            timestamp: new Date().toISOString(),
          })

        // 7. If order detected, create order
        if (aiResponse.intent === 'order' && aiResponse.orderData) {
          await createOrder(businessId, customer.id, aiResponse.orderData)
        }
      }
    }
  } catch (error) {
    console.error('Error handling incoming message:', error)
  }
}

async function createOrder(
  businessId: string,
  customerId: string,
  orderData: {
    product: string
    quantity: number
    address?: string
    phone?: string
  }
) {
  try {
    const totalAmount = orderData.quantity * 100 // Default price, should be from product catalog
    
    const { data: order } = await supabase
      .from('orders')
      .insert({
        business_id: businessId,
        customer_id: customerId,
        status: 'pending',
        total_amount: totalAmount,
        items: [{
          product: orderData.product,
          quantity: orderData.quantity,
          price: 100,
        }],
        delivery_address: orderData.address || null,
      })
      .select()
      .single()

    if (order) {
      // Check if payment is enabled
      const { isPaymentEnabled } = await import('../payments/stripe')
      const paymentEnabled = await isPaymentEnabled(businessId)
      
      if (paymentEnabled) {
        const { sendPaymentLinkViaWhatsApp } = await import('../payments/stripe')
        await sendPaymentLinkViaWhatsApp(order.id, orderData.phone || '', businessId)
      }
    }
  } catch (error) {
    console.error('Error creating order:', error)
  }
}
