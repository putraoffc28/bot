const { makeWASocket, useMultiFileAuthState, downloadMediaMessage } = require("@whiskeysockets/baileys")
const pino = require("pino")
const chalk = require("chalk")
const fs = require("fs")
const ytdl = require("ytdl-core")
const axios = require("axios")

// Konfigurasi Owner & Prefix
const prefix = "!"
const ownerNumber = "62xxxxxxxxxx" // ganti nomor kamu

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./PutraoffcSesi")
    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: true,
        auth: state,
        browser: ["PutraOffc", "Chrome", "1.0.0"]
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", ({ connection }) => {
        if (connection === "open") {
            console.log(chalk.green("✅ Bot berhasil tersambung!"))
        }
    })

    // 📌 Welcome & Goodbye
    sock.ev.on("group-participants.update", async (anu) => {
        try {
            const metadata = await sock.groupMetadata(anu.id)
            if (anu.action === "add") {
                const msg = `👋 Selamat datang @${anu.participants[0].split("@")[0]} di grup *${metadata.subject}*`
                sock.sendMessage(anu.id, { text: msg, mentions: anu.participants })
            } else if (anu.action === "remove") {
                const msg = `👋 Selamat tinggal @${anu.participants[0].split("@")[0]}`
                sock.sendMessage(anu.id, { text: msg, mentions: anu.participants })
            }
        } catch (e) {
            console.log("Error welcome/goodbye:", e)
        }
    })

    // 📌 Pesan Masuk
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0]
        if (!m.message || m.key.fromMe) return
        const from = m.key.remoteJid
        const type = Object.keys(m.message)[0]
        const body =
            type === "conversation" ? m.message.conversation :
            type === "extendedTextMessage" ? m.message.extendedTextMessage.text : ""
        const command = body.startsWith(prefix) ? body.slice(1).trim().split(" ")[0].toLowerCase() : null
        const args = body.split(" ").slice(1)
        const isOwner = m.key.participant === ownerNumber + "@s.whatsapp.net" || from === ownerNumber + "@s.whatsapp.net"

        // 🔒 Anti-link grup
        if (body.includes("chat.whatsapp.com")) {
            const metadata = from.endsWith("@g.us") ? await sock.groupMetadata(from) : null
            if (metadata) {
                const sender = m.key.participant || m.key.remoteJid
                await sock.sendMessage(from, { text: "🚫 Dilarang kirim link grup di sini!" }, { quoted: m })
                try {
                    await sock.groupParticipantsUpdate(from, [sender], "remove")
                } catch {
                    console.log("Gagal kick, mungkin bukan admin.")
                }
            }
        }

        // AUTO REPLY
        if (!command) {
            if (body.toLowerCase() === "halo") {
                await sock.sendMessage(from, { text: "Halo juga 👋" }, { quoted: m })
            }
            return
        }

        // MENU
        if (command === "menu") {
            let menu = `
*🤖 PutraOffc Bot WhatsApp*
Prefix: ${prefix}

📌 Menu Fitur:
- !menu
- !sticker / !s
- !toimg
- !ytmp3 [url]
- !ytmp4 [url]
- !tiktok [url]
- !quote
- !joke
- !bc [teks] (owner)
- !shutdown (owner)

⚡ Extra:
- Welcome / Goodbye otomatis
- Anti-link grup
            `
            return sock.sendMessage(from, { text: menu }, { quoted: m })
        }

        // STICKER
        if (command === "sticker" || command === "s") {
            if (m.message.imageMessage || m.message.videoMessage) {
                const buffer = await downloadMediaMessage(m, "buffer", {}, { logger: pino() })
                await sock.sendMessage(from, { sticker: buffer }, { quoted: m })
            } else {
                sock.sendMessage(from, { text: "Kirim gambar/video dengan caption !sticker" }, { quoted: m })
            }
        }

        // TOIMG
        if (command === "toimg") {
            if (m.message.stickerMessage) {
                const buffer = await downloadMediaMessage(m, "buffer", {}, { logger: pino() })
                fs.writeFileSync("./sticker.jpg", buffer)
                await sock.sendMessage(from, { image: fs.readFileSync("./sticker.jpg") }, { quoted: m })
            } else {
                sock.sendMessage(from, { text: "Balas stiker dengan perintah !toimg" }, { quoted: m })
            }
        }

        // YT MP3
        if (command === "ytmp3") {
            if (!args[0]) return sock.sendMessage(from, { text: "Contoh: !ytmp3 https://youtu.be/xxxx" }, { quoted: m })
            const info = await ytdl.getInfo(args[0])
            ytdl(args[0], { filter: "audioonly" })
                .pipe(fs.createWriteStream("./yt.mp3"))
                .on("finish", async () => {
                    await sock.sendMessage(from, { audio: fs.readFileSync("./yt.mp3"), mimetype: "audio/mp4" }, { quoted: m })
                })
        }

        // YT MP4
        if (command === "ytmp4") {
            if (!args[0]) return sock.sendMessage(from, { text: "Contoh: !ytmp4 https://youtu.be/xxxx" }, { quoted: m })
            ytdl(args[0], { filter: "videoandaudio" })
                .pipe(fs.createWriteStream("./yt.mp4"))
                .on("finish", async () => {
                    await sock.sendMessage(from, { video: fs.readFileSync("./yt.mp4") }, { quoted: m })
                })
        }

        // TIKTOK
        if (command === "tiktok") {
            if (!args[0]) return sock.sendMessage(from, { text: "Contoh: !tiktok https://vt.tiktok.com/xxxx" }, { quoted: m })
            try {
                let res = await axios.get(`https://api.tiklydown.me/api/download?url=${args[0]}`)
                let url = res.data.video.noWatermark
                await sock.sendMessage(from, { video: { url } }, { quoted: m })
            } catch (e) {
                sock.sendMessage(from, { text: "Gagal download TikTok" }, { quoted: m })
            }
        }

        // QUOTE
        if (command === "quote") {
            let res = await axios.get("https://api.quotable.io/random")
            sock.sendMessage(from, { text: `"${res.data.content}"\n— ${res.data.author}` }, { quoted: m })
        }

        // JOKE
        if (command === "joke") {
            let res = await axios.get("https://official-joke-api.appspot.com/random_joke")
            sock.sendMessage(from, { text: `${res.data.setup}\n${res.data.punchline}` }, { quoted: m })
        }

        // BROADCAST (Owner Only)
        if (command === "bc") {
            if (!isOwner) return sock.sendMessage(from, { text: "Khusus owner!" }, { quoted: m })
            const text = args.join(" ")
            let chats = await sock.groupFetchAllParticipating()
            for (let id in chats) {
                await sock.sendMessage(id, { text })
            }
        }

        // SHUTDOWN (Owner Only)
        if (command === "shutdown") {
            if (!isOwner) return sock.sendMessage(from, { text: "Khusus owner!" }, { quoted: m })
            await sock.sendMessage(from, { text: "Bot dimatikan..." }, { quoted: m })
            process.exit(0)
        }
    })
}

startBot()
