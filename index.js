import makeWASocket, { useMultiFileAuthState, DisconnectReason, initAuthCreds, BufferJSON } from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import fs from 'fs'
import pino from 'pino'
import express from 'express'

// ==================== SERVER RENDER POUR GARDER VIVANT ====================
const app = express()
const PORT = process.env.PORT || 3000
app.get('/', (req, res) => res.send('Bot Eljhoni RDC vivant 👑'))
app.listen(PORT, () => console.log(`Server on ${PORT}`))

// ==================== CONFIG ELJHONI RDC 👑 ====================
const NUMERO_PATRON = '243901173598@s.whatsapp.net'
const NOM_RESTO = '🌙 LUNE DE SATIN & TACOS DORÉS ✨'
const HEURES_OUVERTURE = '11h - 23h'
const NUMERO_POUR_CODE = '243901173598'

// Menu structuré
const MENU = {
    '1': { nom: '🌮 Tacos Poulet', prix: 6, emoji: '🍗' },
    '2': { nom: '🌮 Tacos Viande Hachée', prix: 6.5, emoji: '🥩' },
    '3': { nom: '🌮 Tacos Mixte', prix: 7, emoji: '🔥' },
    '4': { nom: '🥤 Boisson 33cl', prix: 2, emoji: '💧' }
}

// Messages de bienvenue
const BIENVENUE_MESSAGES = [
    `🌙 *BIENVENUE CHEZ ${NOM_RESTO}* 🌙\n━━━━━━━━━━━━━━━━━━━\n\n✨ La poésie culinaire vous ouvre ses portes!\n\n🍽️ Tape *menu* pour découvrir nos délices\n💫 Tape *aide* si tu as besoin d'un guide\n\n_👑 Ta première commande t'attend..._`,
    `🌟 *SALUT NOUVEAU POÈTE* 🌟\n━━━━━━━━━━━━━━━━━━━\n\n${NOM_RESTO} te souhaite la bienvenue! 🎉\n\n🔥 Nos tacos sont prêts à réveiller tes papilles\n🥤 Une boisson fraîche pour accompagner?\n\n📋 *Commande facile :*\n➤ 1,2,3,4 → Ajouter au panier\n➤ valider → Commander\n\n_À toi de jouer!_`,
    `✨ *NOUVEAU CLIENT DÉTECTÉ* ✨\n━━━━━━━━━━━━━━━━━━━\n\nBienvenue dans l'univers ${NOM_RESTO} 🌙\n\n⭐ Ta première commande = première étoile\n🍽️ Tape *menu* pour commencer ton voyage\n💬 Tape *aide* pour tout comprendre\n\n_👑 Ici, on mange avec le cœur_`
]

// ==================== STATS ====================
let stats = { totalCommandes: 0, totalChiffreAffaire: 0, clientsUniques: [], platsPopulaires: {}, dernierReset: new Date().toISOString() }
if (fs.existsSync('stats.json')) {
    try { stats = JSON.parse(fs.readFileSync('stats.json', 'utf8')) } catch (err) {}
}

// ==================== CLIENTS CONNUS ====================
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

function enregistrerCommande(articles, clientId) {
    stats.totalCommandes++
    const totalCommande = articles.reduce((sum, item) => sum + item.prix, 0)
    stats.totalChiffreAffaire += totalCommande
    if (!stats.clientsUniques.includes(clientId)) stats.clientsUniques.push(clientId)
    articles.forEach(item => {
        if (!stats.platsPopulaires[item.nom]) stats.platsPopulaires[item.nom] = 0
        stats.platsPopulaires[item.nom]++
    })
    sauvegarderStats()
}

function getPlatPopulaire() {
    if (Object.keys(stats.platsPopulaires).length === 0) return 'Aucune commande encore'
    let maxPlat = null, maxQte = 0
    for (const [plat, qte] of Object.entries(stats.platsPopulaires)) {
        if (qte > maxQte) { maxQte = qte; maxPlat = plat }
    }
    return `${maxPlat} (${maxQte} fois)`
}

function genererRapportStats()