import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import pino from 'pino';
import express from 'express';
import { Boom } from '@hapi/boom';

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot Eljhoni RDC vivant 🤖'));
app.listen(PORT, () => console.log(`Server on ${PORT}`));

const NUMERO_PATRON = '243901173598@s.whatsapp.net';
const NOM_RESTO = '🎵 LUNE DE SATIN & TACOS DORÉS 🎵';
const HEURES_OUVERTURE = '11h - 23h';

const MENU = {
    '1': { nom: '🌮 Tacos Poulet', prix: 6, emoji: '🍗' },
    '2': { nom: '🌮 Tacos Viande Hachée', prix: 6.5, emoji: '🥩' },
    '3': { nom: '🌮 Tacos Mixte', prix: 7, emoji: '🔥' },
    '4': { nom: '🥤 Coca 50cl', prix: 1.5, emoji: '🥤' }
};

const BIENVENUE_MESSAGES = [
    `👋 Bienvenue chez ${NOM_RESTO}! Tape *menu* pour voir nos tacos.`,
    `🔥 Salut! Faim? Tape *menu* chez ${NOM_RESTO}`,
    `😋 Yo! ${NOM_RESTO} ici. Envoie *menu* pour commander`
];

let clientsConnus = new Set();
let commandes = new Map();

if (fs.existsSync('clients.json')) {
    try {
        clientsConnus = new Set(JSON.parse(fs.readFileSync('clients.json')));
    } catch(e) {
        console.log('Pas de clients.json, on démarre vide');
    }
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_v3');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        pairingCode: true
    });
    if(!sock.authState.creds.registered) {
        const code = await sock.requestPairingCode("243901173598");
        console.log('CODE PAIRING:', code);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if(connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode!== DisconnectReason.loggedOut;
            console.log('Connexion fermée, reconnexion:', shouldReconnect);
            if(shouldReconnect) startBot();
        } else if(connection === 'open') {
            console.log('✅ Bot connecté à WhatsApp!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if(!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const textLower = text.toLowerCase().trim();

        if(!clientsConnus.has(sender)) {
            clientsConnus.add(sender);
            sauvegarderClients();
            const bienvenue = BIENVENUE_MESSAGES[Math.floor(Math.random() * BIENVENUE_MESSAGES.length)];
            await sock.sendMessage(sender, { text: bienvenue });
            return;
        }

        if(textLower === 'menu') {
            let menuText = `📋 *MENU ${NOM_RESTO}*\n─────────────────\n\n`;
            for (const [num, item] of Object.entries(MENU)) {
                menuText += `${num}. ${item.emoji} ${item.nom} - ${item.prix}$\n`;
            }
            menuText += `\n🕐 Ouvert: ${HEURES_OUVERTURE}\n\n👉 Tape le numéro pour commander`;
            await sock.sendMessage(sender, { text: menuText });
            return;
        }

        if(textLower === 'stats' && sender === NUMERO_PATRON) {
            await sock.sendMessage(sender, { text: genererRapportStats() });
            return;
        }

        if(textLower === 'aide') {
            await sock.sendMessage(sender, {
                text: `🆘 *AIDE BOT*\n──────────────\n📋 *Commandes:*\n• menu - Voir le menu\n• aide - Cette aide\n\n👉 Tape un numéro pour commander`
            });
            return;
        }

        if(MENU[textLower]) {
            const item = MENU[textLower];
            commandes.set(sender, { item: item.nom, prix: item.prix, date: new Date() });
            await sock.sendMessage(sender, {
                text: `✅ Commande enregistrée:\n${item.emoji} ${item.nom} - ${item.prix}$\n\nLe patron te contacte pour la livraison.`
            });
            await sock.sendMessage(NUMERO_PATRON, {
                text: `🔔 NOUVELLE COMMANDE\nDe: ${sender.split('@')[0]}\n${item.emoji} ${item.nom} - ${item.prix}$`
            });
            return;
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

startBot();

function genererRapportStats() {
    return `📊 *STATS ${NOM_RESTO}*\n──────────────\n👥 Clients uniques: ${clientsConnus.size}\n📦 Commandes: ${commandes.size}\n🕐 Mise à jour: ${new Date().toLocaleString('fr-FR')}`;
}

function sauvegarderClients() {
    try {
        fs.writeFileSync('clients.json', JSON.stringify(Array.from(clientsConnus)));
    } catch (e) {
        console.log('Erreur sauvegarde:', e);
    }
            }
