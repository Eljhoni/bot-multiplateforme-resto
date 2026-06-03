import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import fs from 'fs'
import pino from 'pino'

// ==================== CONFIG ELJHONI RDC 👑 ====================
const NUMERO_PATRON = '243901173598@s.whatsapp.net'
const NOM_RESTO = '🌙 LUNE DE SATIN & TACOS DORÉS ✨'
const HEURES_OUVERTURE = '11h - 23h'

// Menu structuré
const MENU = {
    '1': { nom: '🌮 Tacos Poulet', prix: 6, emoji: '🍗' },
    '2': { nom: '🌮 Tacos Viande Hachée', prix: 6.5, emoji: '🥩' },
    '3': { nom: '🌮 Tacos Mixte', prix: 7, emoji: '🔥' },
    '4': { nom: '🥤 Boisson 33cl', prix: 2, emoji: '💧' }
}

// Messages de bienvenue (3 différents)
const BIENVENUE_MESSAGES = [
    `🌙 *BIENVENUE CHEZ ${NOM_RESTO}* 🌙\n━━━━━━━━━━━━━━━━━━━\n\n✨ La poésie culinaire vous ouvre ses portes!\n\n🍽️ Tape *menu* pour découvrir nos délices\n💫 Tape *aide* si tu as besoin d'un guide\n\n_👑 Ta première commande t'attend..._`,

    `🌟 *SALUT NOUVEAU POÈTE* 🌟\n━━━━━━━━━━━━━━━━━━━\n\n${NOM_RESTO} te souhaite la bienvenue! 🎉\n\n🔥 Nos tacos sont prêts à réveiller tes papilles\n🥤 Une boisson fraîche pour accompagner?\n\n📋 *Commande facile :*\n➤ 1,2,3,4 → Ajouter au panier\n➤ valider → Commander\n\n_À toi de jouer!_`,

    `✨ *NOUVEAU CLIENT DÉTECTÉ* ✨\n━━━━━━━━━━━━━━━━━━━\n\nBienvenue dans l'univers ${NOM_RESTO} 🌙\n\n⭐ Ta première commande = première étoile\n🍽️ Tape *menu* pour commencer ton voyage\n💬 Tape *aide* pour tout comprendre\n\n_👑 Ici, on mange avec le cœur_`
]

// ==================== SYSTÈME DE STATISTIQUES ====================
let stats = {
    totalCommandes: 0,
    totalChiffreAffaire: 0,
    clientsUniques: [],
    platsPopulaires: {},
    dernierReset: new Date().toISOString()
}

// Charger les stats si fichier existe
if (fs.existsSync('stats.json')) {
    try {
        const data = fs.readFileSync('stats.json', 'utf8')
        stats = JSON.parse(data)
        console.log('📊 Statistiques chargées avec succès')
    } catch (err) {
        console.log('❌ Erreur chargement stats, création nouveau fichier')
    }
}

// ==================== SUIVI DES CLIENTS CONNUS (PERSISTANT) ====================
let clientsConnus = new Set()

// Charger les clients connus si fichier existe
if (fs.existsSync('clients.json')) {
    try {
        const clientsData = JSON.parse(fs.readFileSync('clients.json', 'utf8'))
        clientsConnus = new Set(clientsData)
        console.log(`👥 ${clientsConnus.size} clients connus chargés`)
    } catch (err) {
        console.log('❌ Erreur chargement clients.json')
    }
}

// Sauvegarder les clients connus
function sauvegarderClients() {
    try {
        fs.writeFileSync('clients.json', JSON.stringify([...clientsConnus], null, 2))
        console.log('💾 Clients sauvegardés')
    } catch (err) {
        console.log('❌ Erreur sauvegarde clients')
    }
}

// Sauvegarder les stats
function sauvegarderStats() {
    try {
        fs.writeFileSync('stats.json', JSON.stringify(stats, null, 2))
        console.log('💾 Statistiques sauvegardées')
    } catch (err) {
        console.log('❌ Erreur sauvegarde stats')
    }
}

// Fonction pour avoir l'heure de Kinshasa
function getKinshasaTime() {
    return new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Kinshasa' })
}

// Enregistrer une commande
function enregistrerCommande(articles, clientId) {
    stats.totalCommandes++
    const totalCommande = articles.reduce((sum, item) => sum + item.prix, 0)
    stats.totalChiffreAffaire += totalCommande

    if (!stats.clientsUniques.includes(clientId)) {
        stats.clientsUniques.push(clientId)
    }

    articles.forEach(item => {
        const nomPlat = item.nom
        if (!stats.platsPopulaires[nomPlat]) {
            stats.platsPopulaires[nomPlat] = 0
        }
        stats.platsPopulaires[nomPlat]++
    })

    sauvegarderStats()
}

// Obtenir le plat le plus populaire
function getPlatPopulaire() {
    if (Object.keys(stats.platsPopulaires).length === 0) return 'Aucune commande encore'

    let maxPlat = null
    let maxQte = 0

    for (const [plat, qte] of Object.entries(stats.platsPopulaires)) {
        if (qte > maxQte) {
            maxQte = qte
            maxPlat = plat
        }
    }

    return `${maxPlat} (${maxQte} fois)`
}

// Générer rapport stats
function genererRapportStats() {
    return `
📊 *STATISTIQUES ${NOM_RESTO}* 📊
━━━━━━━━━━━━━━━━━━━━━━━

🍽️ *Total commandes* : ${stats.totalCommandes}
💰 *Chiffre d'affaires* : ${stats.totalChiffreAffaire}$
👥 *Clients uniques* : ${stats.clientsUniques.length}
🏆 *Plat star* : ${getPlatPopulaire()}

━━━━━━━━━━━━━━━━━━━━━━━
📅 *Depuis le* : ${new Date(stats.dernierReset).toLocaleDateString('fr-FR', { timeZone: 'Africa/Kinshasa' })}
👑 *Bot SaaS Eljhoni RDC*

Tape *resetstats* pour réinitialiser (admin)
`
}

// Menu formaté pour affichage
const menuResto = `
🌙✨ *${NOM_RESTO}* ✨🌙
⏰ *${HEURES_OUVERTURE}*

━━━━━━━━━━━━━━━━━━━
🍽️ *NOTRE CARTE* 🍽️
━━━━━━━━━━━━━━━━━━━

${Object.entries(MENU).map(([id, item]) =>
    `*${id}.* ${item.emoji} ${item.nom} ─ *${item.prix}$*`
).join('\n')}

━━━━━━━━━━━━━━━━━━━
💡 *COMMENT COMMANDER?*
➤ Envoie le *numéro* du plat
➤ Exemple : *1* pour Tacos Poulet

📋 *AUTRES COMMANDES*
▸ *menu* → Voir la carte
▸ *panier* → Voir ma commande
▸ *supprimer X* → Enlever un article
▸ *annuler* → Vider le panier
▸ *valider* → Passer commande

_🌙 La poésie se mange ici 👑_
`

// ==================== MÉMOIRE DES PANIERS ====================
const paniers = {}

// ==================== FONCTIONS UTILES ====================
function formaterPanier(sender) {
    const items = paniers[sender]
    if (!items || items.length === 0) return null

    let recap = `🛒 *VOTRE COMMANDE* 🛒\n━━━━━━━━━━━━━━━━\n`
    let total = 0

    items.forEach((item, idx) => {
        recap += `\n${idx+1}. ${item.emoji} ${item.nom}\n └─ *${item.prix}$*`
        total += item.prix
    })

    recap += `\n\n━━━━━━━━━━━━━━━━\n💰 *TOTAL : ${total}$*\n━━━━━━━━━━━━━━━━\n\n✅ *Pour valider* : tape *valider*\n❌ *Pour annuler* : tape *annuler*`
    return recap
}

// Sélectionner message de bienvenue aléatoire
function getMessageBienvenue(numero) {
    const index = Math.floor(Math.random() * BIENVENUE_MESSAGES.length)
    return BIENVENUE_MESSAGES[index] + `\n\n📱 *Ton numéro :* +${numero}`
}

// ==================== DÉMARRAGE DU BOT ====================
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info')
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }) // ✅ FIX BAILEYS V6+
    })

    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', ({ connection, qr }) => {
        if(qr) qrcode.generate(qr, {small: true})
        if(connection === 'open') console.log(`✅ ${NOM_RESTO} - Bot SaaS Eljhoni en ligne!`)
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0]
        if(!m.message || m.key.fromMe) return

        const text = m.message.conversation || m.message.extendedTextMessage?.text || ''
        const sender = m.key.remoteJid
        const numeroClient = sender.split('@')[0]

        // === MESSAGE DE BIENVENUE POUR NOUVEAU CLIENT ===
        if (!clientsConnus.has(sender)) {
            clientsConnus.add(sender)
            sauvegarderClients()
            const msgBienvenue = getMessageBienvenue(numeroClient)
            await sock.sendMessage(sender, { text: msgBienvenue })
            console.log(`👋 Nouveau client : +${numeroClient}`)
        }

        // Initialiser panier si inexistant
        if (!paniers[sender]) paniers[sender] = []

        const texteLower = text.toLowerCase().trim()

        // ==================== COMMANDES ADMIN ====================

        // STATISTIQUES (seulement pour le patron)
        if(texteLower === 'stats' && sender === NUMERO_PATRON) {
            await sock.sendMessage(sender, { text: genererRapportStats() })
        }

        // RESET STATS (admin uniquement)
        else if(texteLower === 'resetstats' && sender === NUMERO_PATRON) {
            stats = {
                totalCommandes: 0,
                totalChiffreAffaire: 0,
                clientsUniques: [],
                platsPopulaires: {},
                dernierReset: new Date().toISOString()
            }
            sauvegarderStats()
            await sock.sendMessage(sender, {
                text: `✅ *STATISTIQUES RÉINITIALISÉES*\n\nToutes les stats ont été remises à zéro.\n📅 Nouvelle référence : ${getKinshasaTime()}`
            })
        }

        // ==================== COMMANDES PRINCIPALES ====================

        // PING
        else if(texteLower === 'ping') {
            await sock.sendMessage(sender, {
                text: `🏓 *Pong!*\n\n✅ Bot opérationnel\n⏰ ${getKinshasaTime()}\n\n_👑 SaaS by Eljhoni RDC_`
            })
        }

        // MENU
        else if(texteLower === 'menu') {
            await sock.sendMessage(sender, { text: menuResto })
        }

        // AJOUT AU PANIER (1,2,3,4)
        else if(MENU[text]) {
            const article = MENU[text]
            paniers[sender].push({
                nom: article.nom,
                prix: article.prix,
                emoji: article.emoji
            })
            await sock.sendMessage(sender, {
                text: `✅ *AJOUTÉ AU PANIER*\n━━━━━━━━━━━━━━━━\n${article.emoji} ${article.nom}\n💰 *${article.prix}$*\n━━━━━━━━━━━━━━━━\n\n📋 Tape *panier* pour voir\n💳 Tape *valider* pour commander`
            })
        }

        // VOIR PANIER
        else if(texteLower === 'panier') {
            const recap = formaterPanier(sender)
            if (!recap) {
                await sock.sendMessage(sender, {
                    text: `🛒 *PANIER VIDE*\n\nAjoute des plats avec leur numéro :\n*1*, *2*, *3* ou *4*\n\nTape *menu* pour voir la carte 🌙`
                })
            } else {
                await sock.sendMessage(sender, { text: recap })
            }
        }

        // SUPPRIMER UN ARTICLE
        else if(texteLower.startsWith('supprimer')) {
            if (paniers[sender].length === 0) {
                await sock.sendMessage(sender, {
                    text: `🛒 *PANIER VIDE*\n\nRien à supprimer. Tape *menu* pour commander 🌙`
                })
                return
            }

            const parts = text.split(' ')
            const index = parseInt(parts[1])

            if (isNaN(index) || index < 1 || index > paniers[sender].length) {
                await sock.sendMessage(sender, {
                    text: `❌ *Numéro invalide*\n\nTape *panier* pour voir les articles à supprimer.\nExemple : *supprimer 1*`
                })
            } else {
                const removed = paniers[sender].splice(index-1, 1)[0]
                await sock.sendMessage(sender, {
                    text: `🗑️ *SUPPRIMÉ*\n━━━━━━━━━━━━━━━━\n${removed.emoji} ${removed.nom}\n💰 *-${removed.prix}$*\n━━━━━━━━━━━━━━━━\n\nTape *panier* pour voir la mise à jour`
                })
            }
        }

        // ANNULER TOUT LE PANIER
        else if(texteLower === 'annuler') {
            const nbArticles = paniers[sender].length
            if (nbArticles === 0) {
                await sock.sendMessage(sender, { text: `🛒 *Panier déjà vide*` })
            } else {
                paniers[sender] = []
                await sock.sendMessage(sender, {
                    text: `🗑️ *PANIER ANNULÉ*\n\n${nbArticles} article(s) supprimé(s).\n\nTape *menu* pour recommander 🌙`
                })
            }
        }

        // VALIDER LA COMMANDE
        else if(texteLower === 'valider') {
            if (paniers[sender].length === 0) {
                await sock.sendMessage(sender, {
                    text: `❌ *PANIER VIDE*\n\nAjoute des plats avant de valider.\nTape *menu* pour commander 🌙`
                })
                return
            }

            enregistrerCommande(paniers[sender], sender)

            let recap = `🔥 *NOUVELLE COMMANDE* 🔥\n━━━━━━━━━━━━━━━━━━━\n📅 ${getKinshasaTime()}\n━━━━━━━━━━━━━━━━━━━\n\n`
            let total = 0
            paniers[sender].forEach((item, idx) => {
                recap += `${idx+1}. ${item.emoji} ${item.nom}\n └─ ${item.prix}$\n\n`
                total += item.prix
            })
            recap += `━━━━━━━━━━━━━━━━━━━\n💰 *TOTAL : ${total}$*\n📱 *Client :* +${numeroClient}\n━━━━━━━━━━━━━━━━━━━\n\n_Bot SaaS by Eljhoni RDC 👑_`

            await sock.sendMessage(sender, {
                text: `✅ *COMMANDE VALIDÉE* ✅\n\n🌙 *${NOM_RESTO}* 🌙\n━━━━━━━━━━━━━━━━\n\n${recap}\n\n⏰ *Préparation en cours*\n🚚 Livraison sous 30-45 min\n💵 Paiement à la livraison\n\n_👑 Merci pour votre confiance!_`
            })

            await sock.sendMessage(NUMERO_PATRON, {
                text: `🔔 *NOUVELLE COMMANDE*\n━━━━━━━━━━━━━━━━━━━\n${recap}\n\n✅ À préparer rapidement!`
            })

            paniers[sender] = []
        }

        // AIDE
        else if(texteLower === 'aide' || texteLower === 'help') {
            await sock.sendMessage(sender, {
                text: `📖 *AIDE - ${NOM_RESTO}* 📖\n━━━━━━━━━━━━━━━━━━━\n\n🍽️ *Commander* :\n➤ *1,2,3,4* → Ajouter au panier\n\n📋 *Gérer panier* :\n➤ *panier* → Voir ma commande\n➤ *supprimer X* → Enlever article\n➤ *annuler* → Vider panier\n➤ *valider* → Passer commande\n\nℹ️ *Infos* :\n➤ *menu* → Voir la carte\n➤ *aide* → Ce message\n\n🌙 *Bonne dégustation!*`
            })
        }

        // COMMANDE NON RECONNUE
        else if(text) {
            await sock.sendMessage(sender, {
                text: `❓ *Commande non reconnue*\n\nTape *menu* pour voir la carte\nTape *aide* pour la liste des commandes\n\n_🌙 ${NOM_RESTO}_`
            })
        }
    })
}

startBot()