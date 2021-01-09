require('dotenv').config()
const URL = process.env.SYRCUS_WS_URL.trim()
const CHANNEL = process.env.TWITCH_CHANNEL.trim()
const USERNAME = process.env.TWITCH_USERNAME.trim()
const TOKEN =  process.env.TWITCH_OAUTH_TOKEN.trim()
const TYPE = parseInt(process.env.FFXIV_TARGET_TYPE)
const SENDER = process.env.FFXIV_TARGET_SENDER.trim()
const COLOR = parseInt(process.env.FFXIV_CHAT_COLOR) || 0
const PREFIX = (process.env.FFXIV_CHAT_PREFIX || '').trim()

const WS = require('ws')
const WebSocket = require('reconnecting-websocket')
const {Client} = require('tmi.js')
const {capitalCase} = require('change-case')

const syrcus = new WebSocket(`${URL}/chat`, [], {
  WebSocket: WS,
  maxRetries: 10,
  connectionTimeout: 1000
})

const panic = name => err => {
  console.error(name, 'connection failed:', err)
  process.exit(1)
}

syrcus.addEventListener('error', panic('Syrcus'))
syrcus.addEventListener('open', () => console.log('Syrcus connected'))

const twitch = new Client({
  connection: { secure: true, reconnect: true },
  identity: { username: USERNAME, password: TOKEN },
  channels: [CHANNEL]
})

twitch.connect()
  .then(() => console.log('Twitch connected'))
  .catch(panic('Twitch'))

// ffxiv -> twitch
syrcus.addEventListener('message', ({ data }) => {
  const chat = JSON.parse(data)
  if (chat.type !== TYPE || chat.sender !== SENDER) return

  twitch.say(`#${CHANNEL}`, chat.message)
})

// twitch -> ffxiv
twitch.on('message', (channel, tags, message, self) => {
  if (self) return
  if (tags['message-type'] !== 'chat') return

  const name = /[가-힣]/.test(tags['display-name'])
    ? name
    : capitalCase(tags['display-name'])

  syrcus.send(JSON.stringify({
    payloads: [
      ['UIForeground', COLOR],
      ['Text', `${PREFIX}<${name}`],
      ['Icon', 88], // CrossWorld
      ['Text', `Twitch> ${message}`],
      ['UIForeground', 0],
    ]
  }))
})