import express, { Request, Response } from 'express'
import { Server } from 'socket.io'
import { initWhatsAppClient, getClient, disconnectClient } from '../whatsapp/client'
import { supabase } from '../database/supabase'

export default function whatsappRoutes(io: Server) {
  const router = express.Router()

  // Initialize WhatsApp client
  router.post('/connect', async (req: Request, res: Response) => {
    try {
      const { businessId } = req.body
      
      if (!businessId) {
        return res.status(400).json({ error: 'businessId is required' })
      }

      // Join socket room for this business
      const socketId = req.headers['x-socket-id'] as string
      if (socketId) {
        const socket = io.sockets.sockets.get(socketId)
        if (socket) {
          socket.join(businessId)
        }
      }

      const client = await initWhatsAppClient(businessId)
      
      res.json({ 
        success: true,
        status: client.info ? 'connected' : 'connecting'
      })
    } catch (error: any) {
      console.error('Error connecting WhatsApp:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // Get connection status
  router.get('/status/:businessId', async (req: Request, res: Response) => {
    try {
      const { businessId } = req.params
      
      const { data: connection } = await supabase
        .from('whatsapp_connections')
        .select('*')
        .eq('business_id', businessId)
        .single()

      const client = getClient(businessId)
      const isConnected = client && client.info ? true : false

      res.json({
        status: isConnected ? 'connected' : connection?.status || 'disconnected',
        phoneNumber: connection?.phone_number || null,
        lastConnected: connection?.last_connected || null,
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // Disconnect WhatsApp
  router.post('/disconnect', async (req: Request, res: Response) => {
    try {
      const { businessId } = req.body
      
      await disconnectClient(businessId)
      
      await supabase
        .from('whatsapp_connections')
        .update({ status: 'disconnected' })
        .eq('business_id', businessId)

      res.json({ success: true })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // Send message
  router.post('/send', async (req: Request, res: Response) => {
    try {
      const { businessId, phoneNumber, message } = req.body
      
      if (!businessId || !phoneNumber || !message) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      const client = getClient(businessId)
      if (!client) {
        return res.status(400).json({ error: 'WhatsApp not connected' })
      }

      const chatId = `${phoneNumber}@c.us`
      await client.sendMessage(chatId, message)

      // Save message to database
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('business_id', businessId)
        .eq('phone', phoneNumber)
        .single()

      if (customer) {
        await supabase
          .from('messages')
          .insert({
            business_id: businessId,
            customer_id: customer.id,
            customer_phone: phoneNumber,
            direction: 'outgoing',
            content: message,
            platform: 'whatsapp',
            is_ai: false,
            timestamp: new Date().toISOString(),
          })
      }

      res.json({ success: true })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  return router
}
