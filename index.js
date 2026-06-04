import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import fs from 'fs'
import pino from 'pino'
import express from 'express'

const app = express()
const PORT = process.env.PORT || 3000
app.get('/', (req, res) => res.send('Bot Eljhoni RDC vivant 👑'))
app.listen(PORT, () => console.log(`Server on ${PORT}`))

const NUMERO_PATRON = '243901173598@s.whatsapp.net'
const NOM_RESTO = '🌙 LUNE DE SATIN & TACOS DORÉS ✨'
const HEURES_OUVERTURE = '11h - 23h'

const MENU = {
    '1': { nom: '🌮 Tacos Poulet', prix: 6, emoji: '🍗' },
    '2': { nom: '🌮 Tacos Viande Hachée', prix: 6.5, emoji: '🥩' },
    '3': { nom: '🌮 Tacos Mixte', prix: 7, emoji: '🔥' },
    '4': { nom: '🥤 Boisson 33cl', prix: 2, emoji: '💧' }
}

const BIENVENUE_MESSAGES = [
    `🌙 *BIENVENUE CHEZ ${NOM_RESTO}* 🌙\n━━━━━━━━━━━━━━━━━━━\n\n✨ La poésie culinaire vous ouvre ses portes!\n\n🍽️ Tape *menu* pour découvrir nos délices\n💫 Tape *aide* si tu as besoin d'un guide\n\n_👑 Ta première commande t'attend..._`,
    `🌟 *SALUT NOUVEAU POÈTE* 🌟\n━━━━━━━━━━━━━━━━━━━\n\n${NOM_RESTO} te souhaite la bienvenue! 🎉\n\n🔥 Nos tacos sont prêts à réveiller tes papilles\n🥤 Une boisson fraîche pour accompagner?\n\n📋 *Commande facile :*\n➤ 1,2,3,4 → Ajouter au panier\n➤ valider → Commander\n\n_À toi de jouer!_`,
    `✨ *NOUVEAU CLIENT DÉTECTÉ* ✨\n━━━━━━━━━━━━━━━━━━━\n\nBienvenue dans l'univers ${NOM_RESTO} 🌙\n\n⭐ Ta première commande = première étoile\n🍽️ Tape *menu* pour commencer ton voyage\n💬 Tape *aide* pour tout comprendre\n\n_👑 Ici, on mange avec le cœur_`
]

let stats = { totalCommandes: 0, totalChiffreAffaire: 0, clientsUniques: [], platsPopulaires: {}, dernierReset: new Date().toISOString() }
if (fs.existsSync('stats.json')) {
    try { stats = JSON.parse(fs.readFileSync('stats.json', 'utf8')) } catch (err) {}
}

let clientsConnus = new Set()
if (fs.existsSync('clients.json')) {
    try { clientsConnus = new Set(JSON.parse(fs.readFileSync('clients.json', 'utf8'))) } catch (err) {}
}

function sauvegarderClients() {
    try { fs.writeFileSync('clients.json', JSON.stringify([...clientsConnus], null, 2)) } catch (err) {}
}

function sauvegarderStats() {
    try { fs.writeFileSync('stats.json', JSON.stringify(stats, null, 2)) } catch (err) {}
}

function getKinshasaTime() {
    return new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Kinshasa' })
}

function getPlatPopulaire() {
    if (Object.keys(stats.platsPopulaires).length === 0) return 'Aucune commande encore'
    let maxPlat = null, maxQte = 0
    for (const [plat, qte] of Object.entries(stats.platsPopulaires)) {
        if (qte > maxQte) { maxQte = qte; maxPlat = plat }
    }
    return `${maxPlat} (${maxQte} fois)`
}

function genererRapportStats() {
    return `📊 *RAPPORT ${NOM_RESTO}* 📊\n━━━━━━━━━━━━━━━━━━━\n\n📦 Commandes totales: ${stats.totalCommandes}\n💰 Chiffre d'affaire: ${stats.totalChiffreAffaire.toFixed(2)}$\n👥 Clients uniques: ${stats.clientsUniques.length}\n🔥 Plat populaire: ${getPlatPopulaire()}\n\n📅 MAJ: ${getKinshasaTime()}`
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['LUNE DE SATIN', 'Chrome', '1.0.0']
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
            if (shouldReconnect) startBot()
        } else if (connection === 'open') {
            console.log('✅ Bot connecté à WhatsApp!')
        }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message || msg.key.fromMe) return

        const sender = msg.key.remoteJid
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ''
        const textLower = text.toLowerCase()

        if (!clientsConnus.has(sender)) {
            clientsConnus.add(sender)
            sauvegarderClients()
            const bienvenue = BIENVENUE_MESSAGES[Math.floor(Math.random() * BIENVENUE_MESSAGES.length)]
            await sock.sendMessage(sender, { text: bienvenue })
            return
        }

        if (textLower === 'menu') {
            let menuText = `🍽️ *MENU ${NOM_RESTO}* 🍽️\n━━━━━━━━━━━━━━━━━━━\n\n`
            for (const [num, item] of Object.entries(MENU)) {
                menuText += `${num}. ${item.emoji} ${item.nom} - ${item.prix}$\n`
            }
            menuText += `\n⏰ Ouvert: ${HEURES_OUVERTURE}\n\n💬 Tape le numéro pour commander`
            await sock.sendMessage(sender, { text: menuText })
        }

        if (textLower === 'stats' && sender === NUMERO_PATRON) {
            await sock.sendMessage(sender, { text: genererRapportStats() })
        }

        if (textLower === 'aide') {
            await sock.sendMessage(sender, { 
                text: `🤖 *AIDE BOT*\n━━━━━━━━━━━━━━━━━━━\n\n📋 *Commandes:*\n• menu - Voir le menu\n• aide - Cette aide\n\n🛒 *Commander:*\nTape 1, 2, 3 ou 4\n👑 Patron: tape 'stats'` 
            })
        }
    })
}

startBot()