// @root/src/index.js
require('dotenv').config()
require('module-alias/register')

// register extenders
require('@helpers/extenders/Message')
require('@helpers/extenders/Guild')
require('@helpers/extenders/GuildChannel')

const { checkForUpdates } = require('@helpers/BotUtils')
const { initializeMongoose } = require('@src/database/mongoose')
const { BotClient } = require('@src/structures')
const { validateConfiguration } = require('@helpers/Validator')
const express = require('express')
const path = require('path')

validateConfiguration()

async function initializeBot() {
  try {
    // initialize client
    const client = new BotClient()

    // check for updates
    await checkForUpdates()

    // Initialize mongoose first
    await initializeMongoose()

    // Load commands and events
    await client.loadCommands('./src/commands')
    client.loadContexts('./src/contexts')
    client.loadEvents('./src/events')

    // start the client
    await client.login(process.env.BOT_TOKEN)

    // Initialize dashboard last, after bot is ready
  if (client.config.DASHBOARD.enabled) {
    client.logger.log('Launching dashboard...')
    try {
      const app = express()
      const port = process.env.PORT || client.config.DASHBOARD.port || 8080

      // Parse cookies and add security middleware
      app.use(require('cookie-parser')())
      app.use(
        require('helmet')({
          contentSecurityPolicy: false, // You might need to configure this based on your needs
        })
      )

      // Import the Astro SSR handler
      const { handler } = await import('../astro/dist/server/entry.mjs')

      // Serve static files from the Astro build output
      app.use(
        '/_astro',
        express.static(
          path.join(__dirname, '..', 'astro', 'dist', 'client', '_astro')
        )
      )
      app.use(
        '/static',
        express.static(
          path.join(__dirname, '..', 'astro', 'dist', 'client', 'static')
        )
      )

      // Handle all other routes through Astro's SSR handler
      app.use(async (req, res, next) => {
        try {
          const response = await handler(req, res)

          // If Astro didn't handle the route (404), let Express continue to next middleware
          if (response.status === 404) {
            next()
          }
        } catch (error) {
          console.error('SSR Error:', error)
          next(error)
        }
      })

      // Final fallback for unhandled routes
      app.use((req, res) => {
        res.sendFile(
          path.join(__dirname, '..', 'astro', 'dist', 'client', '404.html')
        )
      })

      // Error handling middleware
      app.use((err, req, res, next) => {
        console.error('Server error:', err)
        res
          .status(500)
          .sendFile(
            path.join(__dirname, '..', 'astro', 'dist', 'client', '500.html')
          )
      })

      app.listen(port, () => {
        const baseURL = process.env.BASE_URL || `http://localhost:${port}`
        client.logger.success(`Dashboard is running on port ${port}`)
        client.logger.log(`Dashboard URL: ${baseURL}`)
      })
    } catch (ex) {
      client.logger.error('Failed to launch dashboard:', ex)
      client.logger.warn('Continuing bot operation without dashboard')
    }
  }

    return client
  } catch (error) {
    console.error('Failed to initialize bot:', error)
    process.exit(1)
  }
}

// Error handling
process.on('unhandledRejection', err => {
  console.error('Unhandled Rejection:', err)
})

process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err)
})

// Heroku specific handlers
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Performing graceful shutdown...')
  // Implement any cleanup needed
  process.exit(0)
})

// Initialize the bot
initializeBot().catch(error => {
  console.error('Failed to start bot:', error)
  process.exit(1)
})
