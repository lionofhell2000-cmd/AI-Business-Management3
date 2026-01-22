import { Client, LocalAuth, Message } from 'whatsapp-web.js'
import qrcode from 'qrcode'
import { io } from '../server'
import path from 'path'
import fs from 'fs'

// Map to store clients per business
const clients = new Map<string, Client>()

const SESSION_PATH = process.env.SESSION_PATH || path.join(__dirname, '../../sessions')

// Ensure sessions directory exists
if (!fs.existsSync(SESSION_PATH)) {
  fs.mkdirSync(SESSION_PATH, { recursive: true })
}

export async function initWhatsAppClient(businessId: string) {
  // If client already exists, return it
  if (clients.has(businessId)) {
    return clients.get(businessId)!
  }

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: businessId,
      dataPath: path.join(SESSION_PATH, businessId),
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  })

  // QR code event
  client.on('qr', async (qr) => {
    try {
      const qrImage = await qrcode.toDataURL(qr)
      // Emit to frontend via WebSocket
      io.to(businessId).emit('qr-code', qrImage)
      console.log(`QR code generated for business: ${businessId}`)
    } catch (error) {
      console.error('Error generating QR code:', error)
    }
  })

  // Ready event
  client.on('ready', async () => {
    console.log('WhatsApp ready for business:', businessId)
    const phoneNumber = client.info?.wid?.user || 'unknown'
    
    // Save to database
    const { supabase } = await import('../database/supabase')
    await supabase
      .from('whatsapp_connections')
      .upsert({
        business_id: businessId,
        phone_number: phoneNumber,
        status: 'connected',
        last_connected: new Date().toISOString(),
      })
    
    io.to(businessId).emit('connection-status', { 
      status: 'connected', 
      phoneNumber 
    })
  })

  // Disconnected event
  client.on('disconnected', async (reason) => {
    console.log('WhatsApp disconnected for business:', businessId, reason)
    
    const { supabase } = await import('../database/supabase')
    await supabase
      .from('whatsapp_connections')
      .update({ status: 'disconnected' })
      .eq('business_id', businessId)
    
    io.to(businessId).emit('connection-status', { 
      status: 'disconnected' 
    })

    // Remove from map
    clients.delete(businessId)
  })

  // Authentication failure
  client.on('auth_failure', (msg) => {
    console.error('WhatsApp auth failure for business:', businessId, msg)
    io.to(businessId).emit('connection-status', { 
      status: 'error',
      error: msg 
    })
  })

  // Message event
  client.on('message', async (msg) => {
    if (!msg.fromMe) {
      const { handleIncomingMessage } = await import('./handlers')
      await handleIncomingMessage(businessId, msg)
    }
  })

  try {
    await client.initialize()
    clients.set(businessId, client)
    return client
  } catch (error) {
    console.error('Error initializing WhatsApp client:', error)
    throw error
  }
}

export function getClient(businessId: string): Client | undefined {
  return clients.get(businessId)
}

export async function disconnectClient(businessId: string) {
  const client = clients.get(businessId)
  if (client) {
    await client.logout()
    clients.delete(businessId)
  }
}
